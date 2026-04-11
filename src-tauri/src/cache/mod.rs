use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

use crate::subsonic::models::{
    Album, AlbumDetail, AlbumStat, Artist, ArtistDetail, ArtistStat, DailyPlay, FlatSong, Genre,
    GenreStat, PlaylistSummary, Song, StatsData, TrackStat,
};

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
                genre TEXT,
                user_rating INTEGER DEFAULT 0
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
            CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count DESC);
            CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist_id);
            CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
            CREATE TABLE IF NOT EXISTS sync_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );
            CREATE TABLE IF NOT EXISTS play_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                track_id TEXT NOT NULL,
                played_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at);
            CREATE INDEX IF NOT EXISTS idx_play_history_track ON play_history(track_id);
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                playlist_id TEXT NOT NULL,
                track_id TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (playlist_id, track_id)
            );
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_track ON playlist_tracks(track_id);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pl_pos ON playlist_tracks(playlist_id, position);
            ",
            )
            .map_err(|e| format!("Schema error: {}", e))?;

        // Migrate existing databases: add columns if missing
        self.conn
            .execute_batch("ALTER TABLE albums ADD COLUMN user_rating INTEGER DEFAULT 0")
            .ok();
        self.conn
            .execute_batch("ALTER TABLE tracks ADD COLUMN play_count INTEGER DEFAULT 0")
            .ok();
        self.conn
            .execute_batch("ALTER TABLE tracks ADD COLUMN created TEXT")
            .ok();

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
                "INSERT INTO albums (id, name, artist, artist_id, cover_art, song_count, duration, year, genre, user_rating)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   artist = excluded.artist,
                   artist_id = excluded.artist_id,
                   cover_art = excluded.cover_art,
                   song_count = excluded.song_count,
                   duration = excluded.duration,
                   year = excluded.year,
                   genre = excluded.genre,
                   user_rating = CASE
                     WHEN excluded.user_rating IS NOT NULL AND excluded.user_rating > 0
                     THEN excluded.user_rating
                     ELSE albums.user_rating
                   END",
                params![a.id, a.name, a.artist, a.artist_id, a.cover_art, a.song_count, a.duration, a.year, a.genre, a.user_rating],
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
                "INSERT INTO tracks (id, title, album, album_id, artist, artist_id, track_num, year, genre, duration, bit_rate, cover_art, user_rating, disc_number, play_count, created)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                 ON CONFLICT(id) DO UPDATE SET
                   title = excluded.title,
                   album = excluded.album,
                   album_id = excluded.album_id,
                   artist = excluded.artist,
                   artist_id = excluded.artist_id,
                   track_num = excluded.track_num,
                   year = excluded.year,
                   genre = excluded.genre,
                   duration = excluded.duration,
                   bit_rate = excluded.bit_rate,
                   cover_art = excluded.cover_art,
                   user_rating = CASE
                     WHEN excluded.user_rating IS NOT NULL AND excluded.user_rating > 0
                     THEN excluded.user_rating
                     ELSE tracks.user_rating
                   END,
                   disc_number = excluded.disc_number,
                   play_count = COALESCE(excluded.play_count, tracks.play_count),
                   created = COALESCE(excluded.created, tracks.created)",
                params![
                    s.id, s.title, s.album, s.album_id, s.artist, s.artist_id,
                    s.track, s.year, s.genre, s.duration, s.bit_rate,
                    s.cover_art, s.user_rating, s.disc_number, s.play_count, s.created
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
                        a.song_count, a.duration, a.year, a.genre, a.user_rating
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
                    user_rating: row.get(9)?,
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
                        t.user_rating, t.disc_number, t.play_count, t.created
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
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
                        user_rating, disc_number, play_count, created
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
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
                "SELECT id, name, artist, artist_id, cover_art, song_count, duration, year, genre, user_rating
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
                    user_rating: row.get(9)?,
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
                "SELECT id, name, artist, artist_id, cover_art, song_count, duration, year, genre, user_rating
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
                    user_rating: row.get(9)?,
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
                        user_rating, disc_number, play_count, created
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
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
                        user_rating, disc_number, play_count, created
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn get_all_tracks(
        &self,
        offset: i32,
        limit: i32,
        sort_field: &str,
        sort_dir: &str,
    ) -> Result<Vec<FlatSong>, String> {
        let col = match sort_field {
            "title" => "title",
            "artist" => "artist",
            "user_rating" => "user_rating",
            "play_count" => "play_count",
            "created" => "created",
            _ => "title",
        };
        let dir = if sort_dir == "desc" { "DESC" } else { "ASC" };

        let sql = format!(
            "SELECT id, title, album, album_id, artist, artist_id,
                    track_num, year, genre, duration, bit_rate, cover_art,
                    user_rating, disc_number, play_count, created
             FROM tracks
             ORDER BY {} {} NULLS LAST, title ASC
             LIMIT ?1 OFFSET ?2",
            col, dir
        );

        let mut stmt = self
            .conn
            .prepare(&sql)
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
                })
            })
            .map_err(|e| format!("Query error: {}", e))?;

        let mut results = Vec::new();
        for row in rows {
            results.push(row.map_err(|e| format!("Row error: {}", e))?);
        }
        Ok(results)
    }

    pub fn get_all_albums(&self) -> Result<Vec<Album>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, name, artist, artist_id, cover_art,
                        song_count, duration, year, genre, user_rating
                 FROM albums
                 ORDER BY year DESC NULLS LAST, name ASC",
            )
            .map_err(|e| format!("Prepare error: {}", e))?;

        let rows = stmt
            .query_map([], |row| {
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
                    user_rating: row.get(9)?,
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

    pub fn get_sync_meta(&self, key: &str) -> Result<Option<String>, String> {
        self.conn
            .query_row(
                "SELECT value FROM sync_meta WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| format!("sync_meta read error: {}", e))
    }

    pub fn set_sync_meta(&self, key: &str, value: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?1, ?2)",
                params![key, value],
            )
            .map_err(|e| format!("sync_meta write error: {}", e))?;
        Ok(())
    }

    pub fn album_exists(&self, id: &str) -> Result<bool, String> {
        let count: i64 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM albums WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .map_err(|e| format!("album_exists error: {}", e))?;
        Ok(count > 0)
    }

    pub fn track_count(&self) -> Result<i64, String> {
        self.conn
            .query_row("SELECT COUNT(*) FROM tracks", [], |row| row.get(0))
            .map_err(|e| format!("track_count error: {}", e))
    }

    pub fn update_album_rating(&self, album_id: &str, rating: i32) -> Result<(), String> {
        self.conn
            .execute(
                "UPDATE albums SET user_rating = ?1 WHERE id = ?2",
                params![rating, album_id],
            )
            .map_err(|e| format!("Update album rating error: {}", e))?;
        Ok(())
    }

    pub fn record_play(&self, track_id: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO play_history (track_id) VALUES (?1)",
                params![track_id],
            )
            .map_err(|e| format!("Record play error: {}", e))?;
        Ok(())
    }

    fn period_aggregate(
        &self,
        start: &str,
        end: &str,
    ) -> Result<(i64, i64, i64, i64, i64), String> {
        self.conn
            .query_row(
                "SELECT COUNT(*),
                        COUNT(DISTINCT ph.track_id),
                        COUNT(DISTINCT t.artist_id),
                        COUNT(DISTINCT t.album_id),
                        COALESCE(SUM(COALESCE(t.duration, 0)), 0)
                 FROM play_history ph
                 LEFT JOIN tracks t ON t.id = ph.track_id
                 WHERE ph.played_at >= ?1 AND ph.played_at < ?2",
                params![start, end],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
            )
            .map_err(|e| format!("Period aggregate error: {}", e))
    }

    pub fn get_stats(
        &self,
        period_start: &str,
        period_end: &str,
        prev_start: &str,
        prev_end: &str,
        all_time: bool,
    ) -> Result<StatsData, String> {
        let total_tracks: i64 = self.conn
            .query_row("SELECT COUNT(*) FROM tracks", [], |r| r.get(0))
            .unwrap_or(0);
        let total_albums: i64 = self.conn
            .query_row("SELECT COUNT(*) FROM albums", [], |r| r.get(0))
            .unwrap_or(0);
        let total_artists: i64 = self.conn
            .query_row("SELECT COUNT(*) FROM artists", [], |r| r.get(0))
            .unwrap_or(0);
        let total_genres: i64 = self.conn
            .query_row(
                "SELECT COUNT(DISTINCT genre) FROM tracks WHERE genre IS NOT NULL AND genre != ''",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        let total_play_count: i64 = self.conn
            .query_row("SELECT COALESCE(SUM(play_count), 0) FROM tracks", [], |r| r.get(0))
            .unwrap_or(0);
        let total_play_duration_secs: i64 = self.conn
            .query_row(
                "SELECT COALESCE(SUM(COALESCE(duration,0) * COALESCE(play_count,0)), 0) FROM tracks",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);

        let (period_plays, period_unique_tracks, period_unique_artists, period_unique_albums, period_duration_secs) =
            if all_time {
                (total_play_count, total_tracks, total_artists, total_albums, total_play_duration_secs)
            } else {
                self.period_aggregate(period_start, period_end)?
            };

        let (prev_plays, prev_unique_tracks, prev_unique_artists, prev_unique_albums, prev_duration_secs) =
            if all_time { (0, 0, 0, 0, 0) } else { self.period_aggregate(prev_start, prev_end)? };

        let top_tracks = if all_time {
            self.top_tracks_all_time()?
        } else {
            self.top_tracks_period(period_start, period_end)?
        };
        let top_artists = if all_time {
            self.top_artists_all_time()?
        } else {
            self.top_artists_period(period_start, period_end)?
        };
        let top_albums = if all_time {
            self.top_albums_all_time()?
        } else {
            self.top_albums_period(period_start, period_end)?
        };
        let top_genres = if all_time {
            self.top_genres_all_time()?
        } else {
            self.top_genres_period(period_start, period_end)?
        };
        let daily_plays = if all_time {
            Vec::new()
        } else {
            self.daily_plays(period_start, period_end)?
        };

        Ok(StatsData {
            total_tracks,
            total_albums,
            total_artists,
            total_genres,
            total_play_count,
            total_play_duration_secs,
            period_plays,
            period_unique_tracks,
            period_unique_artists,
            period_unique_albums,
            period_duration_secs,
            prev_plays,
            prev_unique_tracks,
            prev_unique_artists,
            prev_unique_albums,
            prev_duration_secs,
            top_tracks,
            top_artists,
            top_albums,
            top_genres,
            daily_plays,
        })
    }

    fn top_tracks_all_time(&self) -> Result<Vec<TrackStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, artist, album, cover_art, album_id, artist_id,
                    COALESCE(play_count, 0) as plays
             FROM tracks WHERE play_count > 0
             ORDER BY play_count DESC LIMIT 10",
        ).map_err(|e| format!("top_tracks_all_time: {}", e))?;
        let rows = stmt.query_map([], |r| {
            Ok(TrackStat {
                id: r.get(0)?, title: r.get(1)?, artist: r.get(2)?,
                album: r.get(3)?, cover_art: r.get(4)?, album_id: r.get(5)?,
                artist_id: r.get(6)?, plays: r.get(7)?,
            })
        }).map_err(|e| format!("top_tracks_all_time query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_tracks_all_time row: {}", e))
    }

    fn top_tracks_period(&self, start: &str, end: &str) -> Result<Vec<TrackStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.title, t.artist, t.album, t.cover_art, t.album_id, t.artist_id,
                    COUNT(*) as plays
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             WHERE ph.played_at >= ?1 AND ph.played_at < ?2
             GROUP BY t.id ORDER BY plays DESC LIMIT 10",
        ).map_err(|e| format!("top_tracks_period: {}", e))?;
        let rows = stmt.query_map(params![start, end], |r| {
            Ok(TrackStat {
                id: r.get(0)?, title: r.get(1)?, artist: r.get(2)?,
                album: r.get(3)?, cover_art: r.get(4)?, album_id: r.get(5)?,
                artist_id: r.get(6)?, plays: r.get(7)?,
            })
        }).map_err(|e| format!("top_tracks_period query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_tracks_period row: {}", e))
    }

    fn top_artists_all_time(&self) -> Result<Vec<ArtistStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT a.id, a.name, a.cover_art,
                    SUM(COALESCE(t.play_count, 0)) as plays,
                    COUNT(DISTINCT t.id) as track_count
             FROM tracks t
             JOIN artists a ON a.id = t.artist_id
             WHERE t.play_count > 0
             GROUP BY a.id ORDER BY plays DESC LIMIT 10",
        ).map_err(|e| format!("top_artists_all_time: {}", e))?;
        let rows = stmt.query_map([], |r| {
            Ok(ArtistStat {
                id: r.get(0)?, name: r.get(1)?, cover_art: r.get(2)?,
                plays: r.get(3)?, track_count: r.get(4)?,
            })
        }).map_err(|e| format!("top_artists_all_time query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_artists_all_time row: {}", e))
    }

    fn top_artists_period(&self, start: &str, end: &str) -> Result<Vec<ArtistStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT a.id, a.name, a.cover_art, COUNT(*) as plays,
                    COUNT(DISTINCT ph.track_id) as track_count
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             JOIN artists a ON a.id = t.artist_id
             WHERE ph.played_at >= ?1 AND ph.played_at < ?2
             GROUP BY a.id ORDER BY plays DESC LIMIT 10",
        ).map_err(|e| format!("top_artists_period: {}", e))?;
        let rows = stmt.query_map(params![start, end], |r| {
            Ok(ArtistStat {
                id: r.get(0)?, name: r.get(1)?, cover_art: r.get(2)?,
                plays: r.get(3)?, track_count: r.get(4)?,
            })
        }).map_err(|e| format!("top_artists_period query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_artists_period row: {}", e))
    }

    fn top_albums_all_time(&self) -> Result<Vec<AlbumStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT al.id, al.name, al.artist, al.cover_art, al.artist_id,
                    SUM(COALESCE(t.play_count, 0)) as plays
             FROM tracks t
             JOIN albums al ON al.id = t.album_id
             WHERE t.play_count > 0
             GROUP BY al.id ORDER BY plays DESC LIMIT 10",
        ).map_err(|e| format!("top_albums_all_time: {}", e))?;
        let rows = stmt.query_map([], |r| {
            Ok(AlbumStat {
                id: r.get(0)?, name: r.get(1)?, artist: r.get(2)?,
                cover_art: r.get(3)?, artist_id: r.get(4)?, plays: r.get(5)?,
            })
        }).map_err(|e| format!("top_albums_all_time query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_albums_all_time row: {}", e))
    }

    fn top_albums_period(&self, start: &str, end: &str) -> Result<Vec<AlbumStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT al.id, al.name, al.artist, al.cover_art, al.artist_id,
                    COUNT(*) as plays
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             JOIN albums al ON al.id = t.album_id
             WHERE ph.played_at >= ?1 AND ph.played_at < ?2
             GROUP BY al.id ORDER BY plays DESC LIMIT 10",
        ).map_err(|e| format!("top_albums_period: {}", e))?;
        let rows = stmt.query_map(params![start, end], |r| {
            Ok(AlbumStat {
                id: r.get(0)?, name: r.get(1)?, artist: r.get(2)?,
                cover_art: r.get(3)?, artist_id: r.get(4)?, plays: r.get(5)?,
            })
        }).map_err(|e| format!("top_albums_period query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_albums_period row: {}", e))
    }

    fn top_genres_all_time(&self) -> Result<Vec<GenreStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT genre, SUM(COALESCE(play_count, 0)) as plays,
                    COUNT(DISTINCT id) as track_count
             FROM tracks
             WHERE play_count > 0 AND genre IS NOT NULL AND genre != ''
             GROUP BY genre ORDER BY plays DESC LIMIT 8",
        ).map_err(|e| format!("top_genres_all_time: {}", e))?;
        let rows = stmt.query_map([], |r| {
            Ok(GenreStat { genre: r.get(0)?, plays: r.get(1)?, track_count: r.get(2)? })
        }).map_err(|e| format!("top_genres_all_time query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_genres_all_time row: {}", e))
    }

    fn top_genres_period(&self, start: &str, end: &str) -> Result<Vec<GenreStat>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT t.genre, COUNT(*) as plays, COUNT(DISTINCT ph.track_id) as track_count
             FROM play_history ph
             JOIN tracks t ON t.id = ph.track_id
             WHERE ph.played_at >= ?1 AND ph.played_at < ?2
               AND t.genre IS NOT NULL AND t.genre != ''
             GROUP BY t.genre ORDER BY plays DESC LIMIT 8",
        ).map_err(|e| format!("top_genres_period: {}", e))?;
        let rows = stmt.query_map(params![start, end], |r| {
            Ok(GenreStat { genre: r.get(0)?, plays: r.get(1)?, track_count: r.get(2)? })
        }).map_err(|e| format!("top_genres_period query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("top_genres_period row: {}", e))
    }

    fn daily_plays(&self, start: &str, end: &str) -> Result<Vec<DailyPlay>, String> {
        let mut stmt = self.conn.prepare(
            "SELECT DATE(ph.played_at) as day, COUNT(*) as count,
                    COALESCE(SUM(COALESCE(t.duration, 0)), 0) as duration_secs
             FROM play_history ph
             LEFT JOIN tracks t ON t.id = ph.track_id
             WHERE ph.played_at >= ?1 AND ph.played_at < ?2
             GROUP BY day ORDER BY day",
        ).map_err(|e| format!("daily_plays: {}", e))?;
        let rows = stmt.query_map(params![start, end], |r| {
            Ok(DailyPlay { date: r.get(0)?, count: r.get(1)?, duration_secs: r.get(2)? })
        }).map_err(|e| format!("daily_plays query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("daily_plays row: {}", e))
    }

    // -- Playlists (Navidrome tags) --

    pub fn upsert_playlist_row(&self, id: &str, name: &str) -> Result<(), String> {
        self.conn
            .execute(
                "INSERT INTO playlists (id, name) VALUES (?1, ?2)
                 ON CONFLICT(id) DO UPDATE SET name = excluded.name",
                params![id, name],
            )
            .map_err(|e| format!("upsert_playlist_row: {}", e))?;
        Ok(())
    }

    pub fn delete_playlists_not_in(&self, keep_ids: &[String]) -> Result<(), String> {
        if keep_ids.is_empty() {
            self.conn
                .execute("DELETE FROM playlist_tracks", [])
                .map_err(|e| format!("delete_playlists_not_in: {}", e))?;
            self.conn
                .execute("DELETE FROM playlists", [])
                .map_err(|e| format!("delete_playlists_not_in: {}", e))?;
            return Ok(());
        }
        let placeholders = keep_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql_tracks = format!(
            "DELETE FROM playlist_tracks WHERE playlist_id NOT IN ({})",
            placeholders
        );
        let mut stmt = self
            .conn
            .prepare(&sql_tracks)
            .map_err(|e| format!("delete_playlists_not_in: {}", e))?;
        stmt.execute(rusqlite::params_from_iter(keep_ids.iter()))
            .map_err(|e| format!("delete_playlists_not_in tracks: {}", e))?;

        let sql_pl = format!("DELETE FROM playlists WHERE id NOT IN ({})", placeholders);
        let mut stmt = self
            .conn
            .prepare(&sql_pl)
            .map_err(|e| format!("delete_playlists_not_in: {}", e))?;
        stmt.execute(rusqlite::params_from_iter(keep_ids.iter()))
            .map_err(|e| format!("delete_playlists_not_in pl: {}", e))?;
        Ok(())
    }

    pub fn get_track_position_in_playlist(
        &self,
        playlist_id: &str,
        track_id: &str,
    ) -> Result<Option<i32>, String> {
        self.conn
            .query_row(
                "SELECT position FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| format!("get_track_position_in_playlist: {}", e))
    }

    pub fn remove_track_from_playlist(
        &self,
        playlist_id: &str,
        track_id: &str,
    ) -> Result<(), String> {
        self.conn
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
            )
            .map_err(|e| format!("remove_track_from_playlist: {}", e))?;
        Ok(())
    }

    pub fn clear_playlist_tracks(&self, playlist_id: &str) -> Result<(), String> {
        self.conn
            .execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
            )
            .map_err(|e| format!("clear_playlist_tracks: {}", e))?;
        Ok(())
    }

    pub fn set_playlist_tracks_bulk(
        &self,
        playlist_id: &str,
        track_ids: &[String],
    ) -> Result<(), String> {
        self.clear_playlist_tracks(playlist_id)?;
        let tx = self
            .conn
            .unchecked_transaction()
            .map_err(|e| format!("set_playlist_tracks_bulk tx: {}", e))?;
        for (pos, tid) in track_ids.iter().enumerate() {
            tx.execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
                params![playlist_id, tid, pos as i32],
            )
            .map_err(|e| format!("set_playlist_tracks_bulk insert: {}", e))?;
        }
        tx.commit()
            .map_err(|e| format!("set_playlist_tracks_bulk commit: {}", e))?;
        Ok(())
    }

    pub fn append_playlist_track_if_missing(
        &self,
        playlist_id: &str,
        track_id: &str,
    ) -> Result<bool, String> {
        let exists: i32 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
                |r| r.get(0),
            )
            .map_err(|e| format!("append_playlist_track_if_missing: {}", e))?;
        if exists > 0 {
            return Ok(false);
        }
        let max_pos: Option<i32> = self
            .conn
            .query_row(
                "SELECT MAX(position) FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| format!("append_playlist_track_if_missing max: {}", e))?
            .flatten();
        let pos = max_pos.map(|m| m + 1).unwrap_or(0);
        self.conn
            .execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position) VALUES (?1, ?2, ?3)",
                params![playlist_id, track_id, pos],
            )
            .map_err(|e| format!("append_playlist_track_if_missing insert: {}", e))?;
        Ok(true)
    }

    pub fn get_cached_playlists(&self) -> Result<Vec<PlaylistSummary>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT p.id, p.name,
                        (SELECT COUNT(*) FROM playlist_tracks pt WHERE pt.playlist_id = p.id) as cnt
                 FROM playlists p
                 ORDER BY LOWER(p.name)",
            )
            .map_err(|e| format!("get_cached_playlists: {}", e))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(PlaylistSummary {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    song_count: row.get(2)?,
                    duration: None,
                    created: None,
                    owner: None,
                    public: None,
                })
            })
            .map_err(|e| format!("get_cached_playlists query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("get_cached_playlists row: {}", e))
    }

    pub fn find_playlist_id_by_name_ci(&self, name: &str) -> Result<Option<String>, String> {
        let trimmed = name.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }
        self.conn
            .query_row(
                "SELECT id FROM playlists WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                params![trimmed],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| format!("find_playlist_id_by_name_ci: {}", e))
    }

    pub fn get_playlist_track_count(&self, playlist_id: &str) -> Result<i32, String> {
        self.conn
            .query_row(
                "SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?1",
                params![playlist_id],
                |r| r.get(0),
            )
            .map_err(|e| format!("get_playlist_track_count: {}", e))
    }

    pub fn get_flat_songs_for_playlist(
        &self,
        playlist_id: &str,
        offset: i32,
        limit: i32,
    ) -> Result<Vec<FlatSong>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT t.id, t.title, t.album, t.album_id, t.artist, t.artist_id,
                        t.track_num, t.year, t.genre, t.duration, t.bit_rate, t.cover_art,
                        t.user_rating, t.disc_number, t.play_count, t.created
                 FROM playlist_tracks pt
                 JOIN tracks t ON t.id = pt.track_id
                 WHERE pt.playlist_id = ?1
                 ORDER BY pt.position ASC, t.title ASC
                 LIMIT ?2 OFFSET ?3",
            )
            .map_err(|e| format!("get_flat_songs_for_playlist: {}", e))?;
        let rows = stmt
            .query_map(params![playlist_id, limit, offset], |row| {
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
                    play_count: row.get(14)?,
                    created: row.get(15)?,
                })
            })
            .map_err(|e| format!("get_flat_songs_for_playlist query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("get_flat_songs_for_playlist row: {}", e))
    }

    pub fn get_tag_names_for_track(&self, track_id: &str) -> Result<Vec<String>, String> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT p.name FROM playlists p
                 JOIN playlist_tracks pt ON pt.playlist_id = p.id
                 WHERE pt.track_id = ?1
                 ORDER BY LOWER(p.name)",
            )
            .map_err(|e| format!("get_tag_names_for_track: {}", e))?;
        let rows = stmt
            .query_map(params![track_id], |row| row.get(0))
            .map_err(|e| format!("get_tag_names_for_track query: {}", e))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("get_tag_names_for_track row: {}", e))
    }

    pub fn playlist_has_track(&self, playlist_id: &str, track_id: &str) -> Result<bool, String> {
        let n: i32 = self
            .conn
            .query_row(
                "SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = ?1 AND track_id = ?2",
                params![playlist_id, track_id],
                |r| r.get(0),
            )
            .map_err(|e| format!("playlist_has_track: {}", e))?;
        Ok(n > 0)
    }

    /// For each track id (in the same order), return tag names from local cache.
    pub fn get_tags_for_track_ids(&self, track_ids: &[String]) -> Result<Vec<Vec<String>>, String> {
        if track_ids.is_empty() {
            return Ok(vec![]);
        }
        let placeholders = track_ids
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT pt.track_id, p.name
             FROM playlist_tracks pt
             JOIN playlists p ON p.id = pt.playlist_id
             WHERE pt.track_id IN ({})
             ORDER BY pt.track_id, LOWER(p.name)",
            placeholders
        );
        let mut stmt = self
            .conn
            .prepare(&sql)
            .map_err(|e| format!("get_tags_for_track_ids: {}", e))?;

        let mut rows = stmt
            .query(rusqlite::params_from_iter(track_ids.iter()))
            .map_err(|e| format!("get_tags_for_track_ids query: {}", e))?;

        use std::collections::HashMap;
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        while let Some(row) = rows
            .next()
            .map_err(|e| format!("get_tags_for_track_ids row: {}", e))?
        {
            let tid: String = row.get(0).map_err(|e| format!("get_tags_for_track_ids: {}", e))?;
            let name: String = row.get(1).map_err(|e| format!("get_tags_for_track_ids: {}", e))?;
            map.entry(tid).or_default().push(name);
        }

        Ok(track_ids
            .iter()
            .map(|id| map.remove(id).unwrap_or_default())
            .collect())
    }
}

pub fn cover_art_path(app_dir: &Path, id: &str, size: i32) -> PathBuf {
    let safe_id = id.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    app_dir.join("covers").join(format!("{}_{}", safe_id, size))
}

pub fn read_cached_cover_art(app_dir: &Path, id: &str, size: i32) -> Option<PathBuf> {
    let path = cover_art_path(app_dir, id, size);
    if path.exists() { Some(path) } else { None }
}

pub fn write_cached_cover_art(
    app_dir: &Path,
    id: &str,
    size: i32,
    bytes: &[u8],
) -> Result<PathBuf, String> {
    let path = cover_art_path(app_dir, id, size);
    std::fs::write(&path, bytes).map_err(|e| format!("Write cover art error: {}", e))?;
    Ok(path)
}
