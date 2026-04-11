import { invoke } from '@tauri-apps/api/core';

export interface Artist {
  id: string;
  name: string;
  album_count?: number;
  cover_art?: string;
  artist_image_url?: string;
}

export interface ArtistDetail {
  id: string;
  name: string;
  album_count?: number;
  cover_art?: string;
  album?: Album[];
}

export interface Album {
  id: string;
  name: string;
  artist?: string;
  artist_id?: string;
  cover_art?: string;
  song_count?: number;
  duration?: number;
  year?: number;
  genre?: string;
  user_rating?: number;
}

export interface AlbumDetail {
  id: string;
  name: string;
  artist?: string;
  artist_id?: string;
  cover_art?: string;
  song_count?: number;
  duration?: number;
  year?: number;
  genre?: string;
  song?: Song[];
  user_rating?: number;
}

export interface Song {
  id: string;
  title: string;
  album?: string;
  album_id?: string;
  artist?: string;
  artist_id?: string;
  track?: number;
  year?: number;
  genre?: string;
  size?: number;
  content_type?: string;
  suffix?: string;
  duration?: number;
  bit_rate?: number;
  path?: string;
  cover_art?: string;
  user_rating?: number;
  disc_number?: number;
  play_count?: number;
  created?: string;
}

export interface FlatSong {
  id: string;
  title: string;
  album?: string;
  album_id?: string;
  artist?: string;
  artist_id?: string;
  track?: number;
  year?: number;
  genre?: string;
  duration?: number;
  bit_rate?: number;
  suffix?: string;
  content_type?: string;
  cover_art?: string;
  user_rating?: number;
  disc_number?: number;
  play_count?: number;
  created?: string;
}

export interface SearchResult {
  artist?: Artist[];
  album?: Album[];
  song?: Song[];
}

export interface LocalSearchResult {
  artists: Artist[];
  albums: Album[];
  songs: FlatSong[];
}

export interface Genre {
  value: string;
  song_count: number;
  album_count: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTrack?: Song;
  elapsedSecs: number;
  durationSecs?: number;
  volume: number;
  shuffle: boolean;
  repeat: string;
  finished: boolean;
}

export interface QueueInfo {
  tracks: Song[];
  currentIndex: number | null;
}

export interface TrackStat {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  cover_art?: string;
  album_id?: string;
  artist_id?: string;
  plays: number;
}

export interface ArtistStat {
  id: string;
  name: string;
  cover_art?: string;
  plays: number;
  track_count: number;
}

export interface AlbumStat {
  id: string;
  name: string;
  artist?: string;
  cover_art?: string;
  artist_id?: string;
  plays: number;
}

export interface GenreStat {
  genre: string;
  plays: number;
  track_count: number;
}

export interface DailyPlay {
  date: string;
  count: number;
  duration_secs: number;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  song_count?: number;
  duration?: number;
  created?: string;
  owner?: string;
  public?: boolean;
  color?: string;
}

export interface TagInfo {
  name: string;
  color: string;
}

export interface TrackTagsEntry {
  trackId: string;
  tags: TagInfo[];
}

export interface StatsData {
  total_tracks: number;
  total_albums: number;
  total_artists: number;
  total_genres: number;
  total_play_count: number;
  total_play_duration_secs: number;
  period_plays: number;
  period_unique_tracks: number;
  period_unique_artists: number;
  period_unique_albums: number;
  period_duration_secs: number;
  prev_plays: number;
  prev_unique_tracks: number;
  prev_unique_artists: number;
  prev_unique_albums: number;
  prev_duration_secs: number;
  top_tracks: TrackStat[];
  top_artists: ArtistStat[];
  top_albums: AlbumStat[];
  top_genres: GenreStat[];
  daily_plays: DailyPlay[];
}

export const api = {
  connect: (url: string, username: string, password: string) =>
    invoke<void>('connect', { url, username, password }),

  getArtists: () => invoke<Artist[]>('get_artists'),
  getArtist: (id: string) => invoke<ArtistDetail>('get_artist', { id }),
  getAlbum: (id: string) => invoke<AlbumDetail>('get_album', { id }),
  getAlbumList: (listType: string, size?: number, offset?: number) =>
    invoke<Album[]>('get_album_list', { listType, size, offset }),
  getAllAlbums: () => invoke<Album[]>('get_all_albums'),
  search: (query: string) => invoke<SearchResult>('search', { query }),
  getGenres: () => invoke<Genre[]>('get_genres'),
  getSongsByGenre: (genre: string, size?: number, offset?: number) =>
    invoke<FlatSong[]>('get_songs_by_genre', { genre, size, offset }),

  streamTrack: (id: string) => invoke<string>('stream_track', { id }),
  getCoverArtUrl: (id: string, size?: number) =>
    invoke<string>('get_cover_art_url', { id, size }),
  fetchCoverArt: (id: string, size?: number) =>
    invoke<string>('fetch_cover_art', { id, size }),
  fetchExternalCoverArt: (artist: string, album: string, size?: number) =>
    invoke<string>('fetch_external_cover_art', { artist, album, size }),
  getCoverArtCached: (id: string, size?: number) =>
    invoke<string>('get_cover_art_cached', { id, size }),

  setRating: (id: string, rating: number) =>
    invoke<void>('set_rating', { id, rating }),
  scrobble: (id: string) => invoke<void>('scrobble', { id }),

  playTrack: (track: Song) => invoke<void>('play_track', { track }),
  playTrackInContext: (tracks: Song[], index: number) =>
    invoke<void>('play_track_in_context', { tracks, index }),
  pause: () => invoke<void>('pause'),
  resume: () => invoke<void>('resume'),
  stop: () => invoke<void>('stop'),
  seek: (positionSecs: number) => invoke<void>('seek', { positionSecs }),
  setVolume: (volume: number) => invoke<void>('set_volume', { volume }),
  getPlaybackState: () => invoke<PlaybackState>('get_playback_state'),

  playNext: () => invoke<Song | null>('play_next'),
  playPrevious: () => invoke<Song | null>('play_previous'),
  toggleShuffle: () => invoke<boolean>('toggle_shuffle'),
  toggleRepeat: () => invoke<string>('toggle_repeat'),
  addToQueue: (track: Song) => invoke<void>('add_to_queue', { track }),
  clearQueue: () => invoke<void>('clear_queue'),
  getQueue: () => invoke<QueueInfo>('get_queue'),
  insertNextInQueue: (track: Song) => invoke<void>('insert_next_in_queue', { track }),
  moveInQueue: (from: number, to: number) => invoke<void>('move_in_queue', { from, to }),
  removeFromQueue: (index: number) => invoke<void>('remove_from_queue', { index }),
  jumpToInQueue: (index: number) => invoke<Song | null>('jump_to_in_queue', { index }),

  syncLibrary: () => invoke<string>('sync_library'),
  searchLocal: (query: string) => invoke<FlatSong[]>('search_local', { query }),
  searchAll: (query: string) => invoke<LocalSearchResult>('search_all', { query }),
  getAllTracks: (offset?: number, limit?: number, sortField?: string, sortDir?: string) =>
    invoke<FlatSong[]>('get_all_tracks', { offset, limit, sortField, sortDir }),
  getCachedTracksByRating: (offset?: number, limit?: number) =>
    invoke<FlatSong[]>('get_cached_tracks_by_rating', { offset, limit }),

  recordPlay: (trackId: string) => invoke<void>('record_play', { trackId }),
  getStats: (period: string) => invoke<StatsData>('get_stats', { period }),

  syncPlaylistsToCache: () => invoke<number>('sync_playlists_to_cache'),
  listCachedPlaylists: () => invoke<PlaylistSummary[]>('list_cached_playlists'),
  getCachedPlaylistTracks: (playlistId: string, offset?: number, limit?: number) =>
    invoke<FlatSong[]>('get_cached_playlist_tracks', { playlistId, offset, limit }),
  getCachedTrackTags: (trackId: string) =>
    invoke<string[]>('get_cached_track_tags', { trackId }),
  getCachedTagsForTracks: (trackIds: string[]) =>
    invoke<TrackTagsEntry[]>('get_cached_tags_for_tracks', { trackIds }),
  applyPlaylistTag: (song: Song, tagName: string) =>
    invoke<string>('apply_playlist_tag', { song, tagName }),
  removePlaylistTag: (trackId: string, tagName: string) =>
    invoke<void>('remove_playlist_tag', { trackId, tagName }),
  renamePlaylist: (playlistId: string, name: string) =>
    invoke<void>('rename_playlist', { playlistId, name }),
  deletePlaylist: (playlistId: string) =>
    invoke<void>('delete_playlist', { playlistId }),
  setPlaylistColor: (playlistId: string, color: string) =>
    invoke<void>('set_playlist_color', { playlistId, color }),

  getCachedTrack: (id: string) =>
    invoke<Song | null>('get_cached_track', { id }),

  proxyAnthropic: (apiKey: string, body: string) =>
    invoke<string>('proxy_anthropic', { apiKey, body }),
};
