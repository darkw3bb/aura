use rusqlite::{params, Connection, OptionalExtension};
use std::path::PathBuf;

use crate::subsonic::models::{Album, AlbumDetail, Artist, ArtistDetail, FlatSong, Genre, Song};

pub struct CacheDb {
    conn: Connection,
}

impl CacheDb {
    pub fn open(app_dir: &PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(app_dir).map_err(|e| format!("Failed to create dir: {}", e))?;
        let db_path = app_dir.join("library.db");
        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open DB: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")
            .map_err(|e| format!("Pragma error: {}", e))?;

        let db = Self { conn };
        db.init_schema()?;
        Ok(db)
    }

    fn init_schema(&self) -> Result<(), String> {
        self.conn
            .execute_batch(
                "
            CREATE TABLE IF NOT EXISTS artists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                album_count INTEGER,
                cover_art TEXT
            );
            CREATE TABLE IF NOT EXISTS albums (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                artist TEXT,
                artist_id TEXT,
                cover_art TEXT,
                song_count INTEGER,
                duration INTEGER,
                year INTEGER,
                genre TEXT
            );
            CREATE TABLE IF NOT EXISTS tracks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                album TEXT,
                album_id TEXT,
                artist TEXT,
                artist_id TEXT,
                track_num INTEGER,
                year INTEGER,
                genre TEXT,
                duration INTEGER,
                bit_rate INTEGER,
                cover_art TEXT,
                user_rating INTEGER DEFAULT 0,
                disc_number INTEGER
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
                title, album, artist, genre,
                content='tracks',
                content_rowid='rowid'
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS artists_fts USING fts5(
                name,
                content='artists',
                content_rowid='rowid'
            );
            CREATE VIRTUAL TABLE IF NOT EXISTS albums_fts USING fts5(
                name, artist,
                content='albums',
                content_rowid='rowid'
            );
            CREATE INDEX IF NOT EXISTS idx_tracks_rating ON tracks(user_rating DESC);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
            ",
            )
            .map_err(|e| format!("Schema error: {}", e))?;

        // Rebuild FTS indexes so existing caches get populated
        self.conn
            .execute_batch(
                "
            INSERT INTO artists_fts(artists_fts) VALUES('rebuild');
            INSERT INTO albums_fts(albums_fts) VALUES('rebuild');
            ",
            )
            .map_err(|e| format!("FTS rebuild error: {}", e))?;

        Ok(())
    }

    pub fn upsert_artist(&self, a: &Artist) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO artists (id, name, album_count, cover_art) VALUES (?1, ?2, ?3, ?4)",
                params![a.id, a.name, a.album_count, a.cover_art],
            )
            .map_err(|e| format!("Insert artist error: {}", e))?;

        self.conn
            .execute(
                "DELETE FROM artists_fts WHERE rowid = (SELECT rowid FROM artists WHERE id = ?1)",
                params![a.id],
            )
            .ok();

        self.conn
            .execute(
                "INSERT INTO artists_fts (rowid, name)
                 SELECT rowid, name FROM artists WHERE id = ?1",
                params![a.id],
            )
            .map_err(|e| format!("Artist FTS update error: {}", e))?;

        Ok(())
    }

    pub fn upsert_album(&self, a: &Album) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO albums (id, name, artist, artist_id, cover_art, song_count, duration, year, genre) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![a.id, a.name, a.artist, a.artist_id, a.cover_art, a.song_count, a.duration, a.year, a.genre],
            )
            .map_err(|e| format!("Insert album error: {}", e))?;

        self.conn
            .execute(
                "DELETE FROM albums_fts WHERE rowid = (SELECT rowid FROM albums WHERE id = ?1)",
                params![a.id],
            )
            .ok();

        self.conn
            .execute(
                "INSERT INTO albums_fts (rowid, name, artist)
                 SELECT rowid, name, artist FROM albums WHERE id = ?1",
                params![a.id],
            )
            .map_err(|e| format!("Album FTS update error: {}", e))?;

        Ok(())
    }

    pub fn upsert_track(&self, s: &Song) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO tracks (id, title, album, album_id, artist, artist_id, track_num, year, genre, duration, bit_rate, cover_art, user_rating, disc_number) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
                params![
                    s.id, s.title, s.album, s.album_id, s.artist, s.artist_id,
                    s.track, s.year, s.genre, s.duration, s.bit_rate,
                    s.cover_art, s.user_rating.unwrap_or(0), s.disc_number
                ],
            )
            .map_err(|e| format!("Insert track error: {}", e))?;

        // Update FTS index: delete old entry then insert fresh one
        // (FTS5 external content tables don't support INSERT OR REPLACE)
        self.conn
            .execute(
                "DELETE FROM tracks_fts WHERE rowid = (SELECT rowid FROM tracks WHERE id = ?1)",
                params![s.id],
            )
            .ok();

        self.conn
            .execute(
                "INSERT INTO tracks_fts (rowid, title, album, artist, genre)
                 SELECT rowid, title, album, artist, genre FROM tracks WHERE id = ?1",
                params![s.id],
            )
            .map_err(|e| format!("FTS update error: {}", e))?;

        Ok(())
    }

    pub fn search_artists(&self, query: &str) -> Result<Vec<Artist>, String> {
        let fts_query = query
            .split_whitespace()
            .map(|w| format!("{}*", w))
            .collect::<Vec<_>>()
            .join(" ");

        let mut stmt = self
            .conn
            .prepare(
                "SELECT a.id, a.name, a.album_count, a.cover_art
                 FROM artists_fts fts
                 JOIN artists a ON a.rowid = fts.rowid
                 WHERE artists_fts MATCH ?1
                   AND a.name NOT LIKE '% & %'
                 LIMIT 20",
            )
            .map_err(|e| format!("Artist search prepare error: {}", e))?;

        let rows = stmt
            .query_map(params![fts_query], |row| {
                Ok(Artist {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    album_count: row.get(2)?,
                    cover_art: row.get(3)?,
                    artist_image_url: None,
                })
            })
            .map_err(|e| format!("Artist search query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn search_albums(&self, query: &str) -> Result<Vec<Album>, String> {
        let fts_query = query
            .split_whitespace()
            .map(|w| format!("{}*", w))
            .collect::<Vec<_>>()
            .join(" ");

        let mut stmt = self
            .conn
            .prepare(
                "SELECT a.id, a.name, a.artist, a.artist_id, a.cover_art,
                        a.song_count, a.duration, a.year, a.genre
                 FROM albums_fts fts
                 JOIN albums a ON a.rowid = fts.rowid
                 WHERE albums_fts MATCH ?1
                   AND (a.artist IS NULL OR LOWER(a.artist) != 'various artists')
                 LIMIT 20",
            )
            .map_err(|e| format!("Album search prepare error: {}", e))?;

        let rows = stmt
            .query_map(params![fts_query], |row| {
                Ok(Album {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    artist: row.get(2)?,
                    artist_id: row.get(3)?,
                    cover_art: row.get(4)?,
                    song_count: row.get(5)?,
                    duration: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    created: None,
                    user_rating: None,
                })
            })
            .map_err(|e| format!("Album search query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn search_tracks(&self, query: &str) -> Result<Vec<FlatSong>, String> {
        let fts_query = query
            .split_whitespace()
            .map(|w| format!("{}*", w))
            .collect::<Vec<_>>()
            .join(" ");

        let mut stmt = self
            .conn
            .prepare(
                "SELECT t.id, t.title, t.album, t.album_id, t.artist, t.artist_id,
                        t.track_num, t.year, t.genre, t.duration, t.bit_rate, t.cover_art,
                        t.user_rating, t.disc_number
                 FROM tracks_fts fts
                 JOIN tracks t ON t.rowid = fts.rowid
                 WHERE tracks_fts MATCH ?1
                 LIMIT 100",
            )
            .map_err(|e| format!("Search prepare error: {}", e))?;

        let rows = stmt
            .query_map(params![fts_query], |row| {
                Ok(FlatSong {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    album: row.get(2)?,
                    album_id: row.get(3)?,
                    artist: row.get(4)?,
                    artist_id: row.get(5)?,
                    track: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    duration: row.get(9)?,
                    bit_rate: row.get(10)?,
                    cover_art: row.get(11)?,
                    user_rating: row.get(12)?,
                    disc_number: row.get(13)?,
                })
            })
            .map_err(|e| format!("Search query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn get_tracks_by_rating(
        &self,
        offset: i32,
        limit: i32,
    ) -> Result<Vec<FlatSong>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, title, album, album_id, artist, artist_id,
                        track_num, year, genre, duration, bit_rate, cover_art,
                        user_rating, disc_number
                 FROM tracks
                 WHERE user_rating > 0
                 ORDER BY user_rating DESC, title ASC
                 LIMIT ?1 OFFSET ?2",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map(params![limit, offset], |row| {
                Ok(FlatSong {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    album: row.get(2)?,
                    album_id: row.get(3)?,
                    artist: row.get(4)?,
                    artist_id: row.get(5)?,
                    track: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    duration: row.get(9)?,
                    bit_rate: row.get(10)?,
                    cover_art: row.get(11)?,
                    user_rating: row.get(12)?,
                    disc_number: row.get(13)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn get_artist_detail(&self, id: &str) -> Result<Option<ArtistDetail>, String> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, name, album_count, cover_art FROM artists WHERE id = ?1")
            .map_err(|e| format!("Prepare error: {}", e))?;

        let artist = stmt
            .query_row(params![id], |row| {
                Ok(ArtistDetail {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    album_count: row.get(2)?,
                    cover_art: row.get(3)?,
                    album: None,
                })
            })
            .optional()
            .map_err(|e| format!("Query error: {}", e))?;

        let mut artist = match artist {
            Some(a) => a,
            None => return Ok(None),
        };

        let mut album_stmt = self
            .conn
            .prepare(
                "SELECT id, name, artist, artist_id, cover_art, song_count, duration, year, genre
                 FROM albums WHERE artist_id = ?1
                 ORDER BY year, name",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let albums = album_stmt
            .query_map(params![id], |row| {
                Ok(Album {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    artist: row.get(2)?,
                    artist_id: row.get(3)?,
                    cover_art: row.get(4)?,
                    song_count: row.get(5)?,
                    duration: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    created: None,
                    user_rating: None,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut album_list = Vec::new();
        for row in albums {
            album_list.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        artist.album = Some(album_list);
        Ok(Some(artist))
    }

    pub fn get_album_detail(&self, id: &str) -> Result<Option<AlbumDetail>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, artist, artist_id, cover_art, song_count, duration, year, genre
                 FROM albums WHERE id = ?1",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let album = stmt
            .query_row(params![id], |row| {
                Ok(AlbumDetail {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    artist: row.get(2)?,
                    artist_id: row.get(3)?,
                    cover_art: row.get(4)?,
                    song_count: row.get(5)?,
                    duration: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    song: None,
                    user_rating: None,
                })
            })
            .optional()
            .map_err(|e| format!("Query error: {}", e))?;

        let mut album = match album {
            Some(a) => a,
            None => return Ok(None),
        };

        let mut track_stmt = self
            .conn
            .prepare(
                "SELECT id, title, album, album_id, artist, artist_id,
                        track_num, year, genre, duration, bit_rate, cover_art,
                        user_rating, disc_number
                 FROM tracks WHERE album_id = ?1
                 ORDER BY disc_number, track_num",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let tracks = track_stmt
            .query_map(params![id], |row| {
                Ok(Song {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    album: row.get(2)?,
                    album_id: row.get(3)?,
                    artist: row.get(4)?,
                    artist_id: row.get(5)?,
                    track: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    duration: row.get(9)?,
                    bit_rate: row.get(10)?,
                    cover_art: row.get(11)?,
                    user_rating: row.get(12)?,
                    disc_number: row.get(13)?,
                    size: None,
                    content_type: None,
                    suffix: None,
                    path: None,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut song_list = Vec::new();
        for row in tracks {
            song_list.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        album.song = Some(song_list);
        Ok(Some(album))
    }

    pub fn get_genres(&self) -> Result<Vec<Genre>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT genre, COUNT(*) as song_count, COUNT(DISTINCT album_id) as album_count
                 FROM tracks
                 WHERE genre IS NOT NULL AND genre != ''
                 GROUP BY genre
                 ORDER BY genre",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
                Ok(Genre {
                    value: row.get(0)?,
                    song_count: row.get(1)?,
                    album_count: row.get(2)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn get_tracks_by_genre(
        &self,
        genre: &str,
        offset: i32,
        limit: i32,
    ) -> Result<Vec<FlatSong>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, title, album, album_id, artist, artist_id,
                        track_num, year, genre, duration, bit_rate, cover_art,
                        user_rating, disc_number
                 FROM tracks
                 WHERE genre = ?1
                 ORDER BY artist, album, track_num
                 LIMIT ?2 OFFSET ?3",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map(params![genre, limit, offset], |row| {
                Ok(FlatSong {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    album: row.get(2)?,
                    album_id: row.get(3)?,
                    artist: row.get(4)?,
                    artist_id: row.get(5)?,
                    track: row.get(6)?,
                    year: row.get(7)?,
                    genre: row.get(8)?,
                    duration: row.get(9)?,
                    bit_rate: row.get(10)?,
                    cover_art: row.get(11)?,
                    user_rating: row.get(12)?,
                    disc_number: row.get(13)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn update_track_rating(&self, track_id: &str, rating: i32) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE tracks SET user_rating = ?1 WHERE id = ?2",
                params![rating, track_id],
            )
            .map_err(|e| format!("Update rating error: {}", e))?;
        Ok(())
    }
}
