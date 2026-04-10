import type { FlatSong, Song } from './tauri';

export function flatSongToSong(f: FlatSong): Song {
  return {
    id: f.id,
    title: f.title,
    album: f.album,
    album_id: f.album_id,
    artist: f.artist,
    artist_id: f.artist_id,
    track: f.track,
    year: f.year,
    genre: f.genre,
    duration: f.duration,
    bit_rate: f.bit_rate,
    suffix: f.suffix,
    content_type: f.content_type,
    cover_art: f.cover_art,
    user_rating: f.user_rating,
    disc_number: f.disc_number,
    play_count: f.play_count,
    created: f.created,
  };
}
