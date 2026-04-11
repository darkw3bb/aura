import { api, type Song } from './tauri';

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const MAX_SEARCH_RESULTS = 50;
const MAX_GENRE_TRACKS = 100;
const MAX_BULK_TAG = 50;

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'get_now_playing',
    description: 'Get the currently playing (or paused) track, playback position, and the next few upcoming tracks in the queue. Use this to see what the user is listening to right now.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'search_tracks',
    description: `Search the user's music library for tracks, albums, and artists matching a query. Returns up to ${MAX_SEARCH_RESULTS} results per category with id, title/name, artist, album, genre, rating.`,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (artist name, song title, album name, etc.)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_albums',
    description: "List albums in the user's library. Returns album id, name, artist, genre, year. Without a query, returns ALL albums. With a query, filters by name or artist (case-insensitive substring match).",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search query to filter albums by name or artist' },
      },
    },
  },
  {
    name: 'get_artists',
    description: "List artists in the user's library. Returns artist id, name, album count. Without a query, returns ALL artists. With a query, filters by name (case-insensitive substring match).",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional search query to filter artists by name' },
      },
    },
  },
  {
    name: 'get_genres',
    description: "List all genres in the user's library with song and album counts.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_album_detail',
    description: 'Get full details for an album including all its tracks. Use this to see every song on a specific album.',
    input_schema: {
      type: 'object',
      properties: {
        album_id: { type: 'string', description: 'The album ID to look up' },
      },
      required: ['album_id'],
    },
  },
  {
    name: 'get_artist_detail',
    description: "Get an artist's details including all their albums. Use this to explore an artist's discography.",
    input_schema: {
      type: 'object',
      properties: {
        artist_id: { type: 'string', description: 'The artist ID to look up' },
      },
      required: ['artist_id'],
    },
  },
  {
    name: 'get_artist_tracks',
    description: "Get ALL tracks by an artist. Fetches every album in the artist's discography and returns all songs. Returns track id, title, album, album_id, genre, year, rating, duration, disc and track number.",
    input_schema: {
      type: 'object',
      properties: {
        artist_id: { type: 'string', description: 'The artist ID to look up' },
      },
      required: ['artist_id'],
    },
  },
  {
    name: 'get_tracks_by_rating',
    description: 'Get tracks that the user has rated, sorted by rating. Use min_rating to filter (1-5 stars).',
    input_schema: {
      type: 'object',
      properties: {
        min_rating: { type: 'number', description: 'Minimum star rating (1-5). Default: 1' },
      },
    },
  },
  {
    name: 'get_songs_by_genre',
    description: `Get tracks belonging to a specific genre. Returns up to ${MAX_GENRE_TRACKS} tracks per call. Use offset for pagination.`,
    input_schema: {
      type: 'object',
      properties: {
        genre: { type: 'string', description: 'Genre name (must match exactly)' },
        count: { type: 'number', description: `Number of tracks to return (max ${MAX_GENRE_TRACKS}). Default: 50` },
        offset: { type: 'number', description: 'Offset for pagination. Default: 0' },
      },
      required: ['genre'],
    },
  },
  {
    name: 'list_playlists',
    description: "List all playlists/tags in the user's library with song counts.",
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_playlist_tracks',
    description: 'Get the tracks in a specific playlist/tag by playlist ID.',
    input_schema: {
      type: 'object',
      properties: {
        playlist_id: { type: 'string', description: 'The playlist ID' },
        offset: { type: 'number', description: 'Offset for pagination. Default: 0' },
        limit: { type: 'number', description: 'Max tracks to return. Default: 50' },
      },
      required: ['playlist_id'],
    },
  },
  {
    name: 'apply_tag',
    description: 'Apply a tag (playlist) to a single track. If the tag does not exist, it will be created. The track object must include at least an id and title.',
    input_schema: {
      type: 'object',
      properties: {
        track_id: { type: 'string', description: 'The track ID to tag' },
        track_title: { type: 'string', description: 'The track title' },
        tag_name: { type: 'string', description: 'The tag/playlist name to apply' },
      },
      required: ['track_id', 'track_title', 'tag_name'],
    },
  },
  {
    name: 'apply_tag_bulk',
    description: `Apply a tag (playlist) to multiple tracks at once. Max ${MAX_BULK_TAG} tracks per call. If the tag does not exist, it will be created.`,
    input_schema: {
      type: 'object',
      properties: {
        tracks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
            required: ['id', 'title'],
          },
          description: `Array of track objects with id and title. Max ${MAX_BULK_TAG}.`,
        },
        tag_name: { type: 'string', description: 'The tag/playlist name to apply' },
      },
      required: ['tracks', 'tag_name'],
    },
  },
];

function slim<T extends Record<string, unknown>>(obj: T, keys: string[]): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in obj && obj[k] !== undefined && obj[k] !== null) {
      result[k] = obj[k];
    }
  }
  return result as Partial<T>;
}

const QUEUE_PREVIEW_SIZE = 10;

export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'get_now_playing': {
      const [state, queueInfo] = await Promise.all([
        api.getPlaybackState(),
        api.getQueue(),
      ]);

      const track = state.currentTrack
        ? slim(state.currentTrack as unknown as Record<string, unknown>,
            ['id', 'title', 'artist', 'album', 'album_id', 'artist_id', 'genre', 'year', 'user_rating', 'duration'])
        : null;

      const upcoming = queueInfo.currentIndex != null
        ? queueInfo.tracks
            .slice(queueInfo.currentIndex + 1, queueInfo.currentIndex + 1 + QUEUE_PREVIEW_SIZE)
            .map(s => slim(s as unknown as Record<string, unknown>,
              ['id', 'title', 'artist', 'album']))
        : [];

      return JSON.stringify({
        is_playing: state.isPlaying,
        current_track: track,
        elapsed_secs: state.elapsedSecs,
        duration_secs: state.durationSecs ?? null,
        queue_length: queueInfo.tracks.length,
        upcoming_tracks: upcoming,
      });
    }

    case 'search_tracks': {
      const result = await api.searchAll(input.query as string);
      const artists = result.artists.slice(0, MAX_SEARCH_RESULTS).map(a =>
        slim(a, ['id', 'name', 'album_count']),
      );
      const albums = result.albums.slice(0, MAX_SEARCH_RESULTS).map(a =>
        slim(a, ['id', 'name', 'artist', 'genre', 'year', 'user_rating']),
      );
      const songs = result.songs.slice(0, MAX_SEARCH_RESULTS).map(s =>
        slim(s, ['id', 'title', 'artist', 'album', 'album_id', 'artist_id', 'genre', 'year', 'user_rating', 'duration']),
      );
      return JSON.stringify({ artists, albums, songs });
    }

    case 'get_albums': {
      let albums = await api.getAllAlbums();
      const q = (input.query as string)?.toLowerCase();
      if (q) {
        albums = albums.filter(a =>
          a.name?.toLowerCase().includes(q) ||
          a.artist?.toLowerCase().includes(q),
        );
      }
      return JSON.stringify(
        albums.map(a => slim(a, ['id', 'name', 'artist', 'genre', 'year', 'song_count', 'user_rating'])),
      );
    }

    case 'get_artists': {
      let artists = await api.getArtists();
      const q = (input.query as string)?.toLowerCase();
      if (q) {
        artists = artists.filter(a => a.name?.toLowerCase().includes(q));
      }
      return JSON.stringify(
        artists.map(a => slim(a, ['id', 'name', 'album_count'])),
      );
    }

    case 'get_genres': {
      const genres = await api.getGenres();
      return JSON.stringify(genres);
    }

    case 'get_album_detail': {
      const detail = await api.getAlbum(input.album_id as string);
      return JSON.stringify({
        id: detail.id,
        name: detail.name,
        artist: detail.artist,
        genre: detail.genre,
        year: detail.year,
        user_rating: detail.user_rating,
        songs: detail.song?.map(s =>
          slim(s, ['id', 'title', 'artist', 'track', 'genre', 'year', 'user_rating', 'duration', 'disc_number']),
        ) ?? [],
      });
    }

    case 'get_artist_detail': {
      const detail = await api.getArtist(input.artist_id as string);
      return JSON.stringify({
        id: detail.id,
        name: detail.name,
        albums: detail.album?.map(a =>
          slim(a, ['id', 'name', 'genre', 'year', 'song_count', 'user_rating']),
        ) ?? [],
      });
    }

    case 'get_artist_tracks': {
      const detail = await api.getArtist(input.artist_id as string);
      const albumIds = (detail.album ?? []).map(a => a.id);
      const albums = await Promise.all(albumIds.map(id => api.getAlbum(id).catch(() => null)));
      const tracks = albums.flatMap(album =>
        (album?.song ?? []).map(s =>
          slim(s, ['id', 'title', 'artist', 'album', 'album_id', 'artist_id', 'genre', 'year', 'user_rating', 'duration', 'disc_number', 'track_num']),
        ),
      );
      return JSON.stringify({
        artist: detail.name,
        artist_id: detail.id,
        album_count: albumIds.length,
        track_count: tracks.length,
        tracks,
      });
    }

    case 'get_tracks_by_rating': {
      const minRating = (input.min_rating as number) ?? 1;
      const tracks = await api.getCachedTracksByRating(0, 500);
      const filtered = tracks.filter(t => (t.user_rating ?? 0) >= minRating);
      return JSON.stringify(
        filtered.map(s =>
          slim(s, ['id', 'title', 'artist', 'album', 'album_id', 'artist_id', 'genre', 'year', 'user_rating', 'duration']),
        ),
      );
    }

    case 'get_songs_by_genre': {
      const count = Math.min((input.count as number) ?? 50, MAX_GENRE_TRACKS);
      const offset = (input.offset as number) ?? 0;
      const songs = await api.getSongsByGenre(input.genre as string, count, offset);
      return JSON.stringify(
        songs.map(s =>
          slim(s, ['id', 'title', 'artist', 'album', 'album_id', 'artist_id', 'genre', 'year', 'user_rating', 'duration']),
        ),
      );
    }

    case 'list_playlists': {
      const playlists = await api.listCachedPlaylists();
      return JSON.stringify(
        playlists.map(p => slim(p, ['id', 'name', 'song_count', 'duration'])),
      );
    }

    case 'get_playlist_tracks': {
      const tracks = await api.getCachedPlaylistTracks(
        input.playlist_id as string,
        (input.offset as number) ?? 0,
        (input.limit as number) ?? 50,
      );
      return JSON.stringify(
        tracks.map(s =>
          slim(s, ['id', 'title', 'artist', 'album', 'genre', 'year', 'user_rating', 'duration']),
        ),
      );
    }

    case 'apply_tag': {
      const trackId = input.track_id as string;
      const cached = await api.getCachedTrack(trackId);
      const song: Song = cached ?? { id: trackId, title: input.track_title as string };
      const playlistId = await api.applyPlaylistTag(song, input.tag_name as string);
      return JSON.stringify({ success: true, playlist_id: playlistId, tag_name: input.tag_name });
    }

    case 'apply_tag_bulk': {
      const tracks = (input.tracks as Array<{ id: string; title: string }>).slice(0, MAX_BULK_TAG);
      const tagName = input.tag_name as string;
      const results: Array<{ track_id: string; success: boolean; error?: string }> = [];
      for (const t of tracks) {
        try {
          const cached = await api.getCachedTrack(t.id);
          const song: Song = cached ?? { id: t.id, title: t.title };
          await api.applyPlaylistTag(song, tagName);
          results.push({ track_id: t.id, success: true });
        } catch (e) {
          results.push({ track_id: t.id, success: false, error: String(e) });
        }
      }
      return JSON.stringify({ tag_name: tagName, results });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}
