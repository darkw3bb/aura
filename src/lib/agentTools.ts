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
const MAX_GENRE_TRACKS = 150;
const MAX_BULK_TAG = 100;
const MAX_RATED_TRACKS = 250;
const MAX_PLAYLIST_TRACKS = 75;

export const toolDefinitions: ToolDefinition[] = [
  {
    name: 'get_now_playing',
    description: 'Get current track, playback position, and upcoming queue.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_tracks',
    description: `Search library by artist/title/album/genre name (metadata only, not mood). Max ${MAX_SEARCH_RESULTS} results per category.`,
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_albums',
    description: 'List albums, optionally filtered by name/artist substring.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
    },
  },
  {
    name: 'get_artists',
    description: 'List artists, optionally filtered by name substring.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
    },
  },
  {
    name: 'get_genres',
    description: 'List all genres with song/album counts.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_album_detail',
    description: 'Get album info and all its tracks.',
    input_schema: {
      type: 'object',
      properties: { album_id: { type: 'string' } },
      required: ['album_id'],
    },
  },
  {
    name: 'get_artist_detail',
    description: 'Get artist info and all their albums.',
    input_schema: {
      type: 'object',
      properties: { artist_id: { type: 'string' } },
      required: ['artist_id'],
    },
  },
  {
    name: 'get_artist_tracks',
    description: 'Get every track by an artist across all albums.',
    input_schema: {
      type: 'object',
      properties: { artist_id: { type: 'string' } },
      required: ['artist_id'],
    },
  },
  {
    name: 'get_tracks_by_rating',
    description: `Get user-rated tracks (top ${MAX_RATED_TRACKS}). Default min_rating: 3.`,
    input_schema: {
      type: 'object',
      properties: { min_rating: { type: 'number' } },
    },
  },
  {
    name: 'get_songs_by_genre',
    description: `Get up to ${MAX_GENRE_TRACKS} tracks in a genre.`,
    input_schema: {
      type: 'object',
      properties: {
        genre: { type: 'string' },
        count: { type: 'number' },
        offset: { type: 'number' },
      },
      required: ['genre'],
    },
  },
  {
    name: 'list_playlists',
    description: 'List all playlists/tags with song counts.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_playlist_tracks',
    description: `Get tracks in a playlist (default limit: ${MAX_PLAYLIST_TRACKS}).`,
    input_schema: {
      type: 'object',
      properties: {
        playlist_id: { type: 'string' },
        offset: { type: 'number' },
        limit: { type: 'number' },
      },
      required: ['playlist_id'],
    },
  },
  {
    name: 'find_similar_tracks',
    description: 'Find up to 30 tracks similar to a playlist or track set by shared artists/genres. Use instead of multiple searches for recommendations.',
    input_schema: {
      type: 'object',
      properties: {
        playlist_id: { type: 'string' },
        track_ids: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'apply_tag',
    description: 'Apply a tag/playlist to one track (creates tag if needed).',
    input_schema: {
      type: 'object',
      properties: {
        track_id: { type: 'string' },
        track_title: { type: 'string' },
        tag_name: { type: 'string' },
      },
      required: ['track_id', 'track_title', 'tag_name'],
    },
  },
  {
    name: 'apply_tag_bulk',
    description: `Tag up to ${MAX_BULK_TAG} tracks at once (creates tag if needed).`,
    input_schema: {
      type: 'object',
      properties: {
        tracks: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, title: { type: 'string' } },
            required: ['id', 'title'],
          },
        },
        tag_name: { type: 'string' },
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

function fmtDuration(secs?: number): string {
  if (!secs) return '';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

function fmtRating(r?: number | null): string {
  if (!r) return '';
  return '★' + r;
}

type FieldSpec = { key: string; label: string; fmt?: (v: unknown) => string };

const TRACK_FIELDS: FieldSpec[] = [
  { key: 'id', label: 'id' },
  { key: 'title', label: 'title' },
  { key: 'artist', label: 'artist' },
  { key: 'album', label: 'album' },
  { key: 'genre', label: 'genre' },
  { key: 'year', label: 'year' },
  { key: 'user_rating', label: 'rating', fmt: v => fmtRating(v as number) },
  { key: 'duration', label: 'dur', fmt: v => fmtDuration(v as number) },
];

const TRACK_FIELDS_WITH_IDS: FieldSpec[] = [
  { key: 'id', label: 'id' },
  { key: 'title', label: 'title' },
  { key: 'artist', label: 'artist' },
  { key: 'album', label: 'album' },
  { key: 'album_id', label: 'album_id' },
  { key: 'artist_id', label: 'artist_id' },
  { key: 'genre', label: 'genre' },
  { key: 'year', label: 'year' },
  { key: 'user_rating', label: 'rating', fmt: v => fmtRating(v as number) },
  { key: 'duration', label: 'dur', fmt: v => fmtDuration(v as number) },
];

const ALBUM_FIELDS: FieldSpec[] = [
  { key: 'id', label: 'id' },
  { key: 'name', label: 'name' },
  { key: 'artist', label: 'artist' },
  { key: 'genre', label: 'genre' },
  { key: 'year', label: 'year' },
  { key: 'song_count', label: 'songs' },
  { key: 'user_rating', label: 'rating', fmt: v => fmtRating(v as number) },
];

const ARTIST_FIELDS: FieldSpec[] = [
  { key: 'id', label: 'id' },
  { key: 'name', label: 'name' },
  { key: 'album_count', label: 'albums' },
];

function formatTable(rows: Record<string, unknown>[], fields: FieldSpec[]): string {
  if (rows.length === 0) return '(none)';
  const header = fields.map(f => f.label).join('\t');
  const lines = rows.map(row =>
    fields.map(f => {
      const v = row[f.key];
      if (v === undefined || v === null) return '';
      return f.fmt ? f.fmt(v) : String(v);
    }).join('\t'),
  );
  return header + '\n' + lines.join('\n');
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

      if (!state.currentTrack) return 'Nothing is currently playing.';

      const t = state.currentTrack;
      const upcoming = queueInfo.currentIndex != null
        ? queueInfo.tracks
            .slice(queueInfo.currentIndex + 1, queueInfo.currentIndex + 1 + QUEUE_PREVIEW_SIZE)
        : [];

      const lines = [
        `status: ${state.isPlaying ? 'playing' : 'paused'}`,
        `track: ${t.title} — ${t.artist}`,
        `album: ${t.album ?? ''}`,
        `genre: ${t.genre ?? ''}`,
        `position: ${fmtDuration(state.elapsedSecs)} / ${fmtDuration(state.durationSecs ?? undefined)}`,
        `rating: ${fmtRating(t.user_rating) || 'unrated'}`,
        `id: ${t.id}`,
        `queue: ${queueInfo.tracks.length} tracks`,
      ];

      if (upcoming.length > 0) {
        lines.push('', 'Up next:');
        for (const s of upcoming) {
          lines.push(`  ${s.title} — ${s.artist}`);
        }
      }

      return lines.join('\n');
    }

    case 'search_tracks': {
      const result = await api.searchAll(input.query as string);
      const parts: string[] = [];

      const artists = result.artists.slice(0, MAX_SEARCH_RESULTS);
      if (artists.length > 0) {
        parts.push(`Artists (${artists.length}):\n` + formatTable(artists, ARTIST_FIELDS));
      }

      const albums = result.albums.slice(0, MAX_SEARCH_RESULTS);
      if (albums.length > 0) {
        parts.push(`Albums (${albums.length}):\n` + formatTable(albums, ALBUM_FIELDS));
      }

      const songs = result.songs.slice(0, MAX_SEARCH_RESULTS);
      if (songs.length > 0) {
        parts.push(`Tracks (${songs.length}):\n` + formatTable(songs, TRACK_FIELDS));
      }

      return parts.length > 0 ? parts.join('\n\n') : 'No results found.';
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
      return formatTable(albums, ALBUM_FIELDS);
    }

    case 'get_artists': {
      let artists = await api.getArtists();
      const q = (input.query as string)?.toLowerCase();
      if (q) {
        artists = artists.filter(a => a.name?.toLowerCase().includes(q));
      }
      return formatTable(artists, ARTIST_FIELDS);
    }

    case 'get_genres': {
      const genres = await api.getGenres();
      const header = 'genre\tsongs\talbums';
      const lines = genres.map(g => `${g.value}\t${g.song_count}\t${g.album_count}`);
      return header + '\n' + lines.join('\n');
    }

    case 'get_album_detail': {
      const detail = await api.getAlbum(input.album_id as string);
      const header = `${detail.name} — ${detail.artist ?? 'Unknown'} (${detail.year ?? '?'}) [${detail.genre ?? ''}] ${fmtRating(detail.user_rating)}\nid: ${detail.id}`;
      const trackFields: FieldSpec[] = [
        { key: 'id', label: 'id' },
        { key: 'track', label: '#' },
        { key: 'title', label: 'title' },
        { key: 'duration', label: 'dur', fmt: v => fmtDuration(v as number) },
        { key: 'user_rating', label: 'rating', fmt: v => fmtRating(v as number) },
      ];
      const songs = detail.song ?? [];
      return header + '\n\n' + formatTable(songs, trackFields);
    }

    case 'get_artist_detail': {
      const detail = await api.getArtist(input.artist_id as string);
      const header = `${detail.name}\nid: ${detail.id}`;
      const albumFields: FieldSpec[] = [
        { key: 'id', label: 'id' },
        { key: 'name', label: 'name' },
        { key: 'year', label: 'year' },
        { key: 'genre', label: 'genre' },
        { key: 'song_count', label: 'songs' },
        { key: 'user_rating', label: 'rating', fmt: v => fmtRating(v as number) },
      ];
      return header + '\n\n' + formatTable(detail.album ?? [], albumFields);
    }

    case 'get_artist_tracks': {
      const detail = await api.getArtist(input.artist_id as string);
      const albumIds = (detail.album ?? []).map(a => a.id);
      const albums = await Promise.all(albumIds.map(id => api.getAlbum(id).catch(() => null)));
      const tracks = albums.flatMap(album => album?.song ?? []);
      return `${detail.name} — ${tracks.length} tracks across ${albumIds.length} albums\n\n` +
        formatTable(tracks, TRACK_FIELDS_WITH_IDS);
    }

    case 'get_tracks_by_rating': {
      const minRating = (input.min_rating as number) ?? 3;
      const tracks = await api.getCachedTracksByRating(0, MAX_RATED_TRACKS);
      const filtered = tracks.filter(t => (t.user_rating ?? 0) >= minRating);
      return `${filtered.length} tracks rated ≥${minRating}:\n\n` + formatTable(filtered, TRACK_FIELDS);
    }

    case 'get_songs_by_genre': {
      const count = Math.min((input.count as number) ?? 50, MAX_GENRE_TRACKS);
      const offset = (input.offset as number) ?? 0;
      const songs = await api.getSongsByGenre(input.genre as string, count, offset);
      return formatTable(songs, TRACK_FIELDS);
    }

    case 'list_playlists': {
      const playlists = await api.listCachedPlaylists();
      const header = 'id\tname\tsongs\tduration';
      const lines = playlists.map(p =>
        `${p.id}\t${p.name}\t${p.song_count ?? 0}\t${fmtDuration(p.duration ?? undefined)}`,
      );
      return header + '\n' + lines.join('\n');
    }

    case 'get_playlist_tracks': {
      const tracks = await api.getCachedPlaylistTracks(
        input.playlist_id as string,
        (input.offset as number) ?? 0,
        (input.limit as number) ?? MAX_PLAYLIST_TRACKS,
      );
      return formatTable(tracks, TRACK_FIELDS);
    }

    case 'find_similar_tracks': {
      const playlistId = input.playlist_id as string | undefined;
      const trackIds = input.track_ids as string[] | undefined;

      let sourceTracks: Array<Record<string, unknown>> = [];

      if (playlistId) {
        sourceTracks = await api.getCachedPlaylistTracks(playlistId, 0, 200);
      } else if (trackIds && trackIds.length > 0) {
        const fetched = await Promise.all(
          trackIds.slice(0, 50).map(id => api.getCachedTrack(id)),
        );
        sourceTracks = fetched.filter((t): t is Song => t != null);
      }

      if (sourceTracks.length === 0) return 'No source tracks found.';

      const excludeIds = new Set(sourceTracks.map(t => String(t.id)));
      const artistIds = [...new Set(sourceTracks.map(t => t.artist_id).filter(Boolean))] as string[];
      const genres = [...new Set(sourceTracks.map(t => t.genre).filter(Boolean))] as string[];

      const candidates = new Map<string, Record<string, unknown>>();

      // Gather tracks by the same artists
      for (const artistId of artistIds.slice(0, 10)) {
        try {
          const detail = await api.getArtist(artistId);
          const albumIds = (detail.album ?? []).map(a => a.id);
          for (const albumId of albumIds) {
            const album = await api.getAlbum(albumId).catch(() => null);
            for (const s of album?.song ?? []) {
              if (!excludeIds.has(s.id) && !candidates.has(s.id)) {
                candidates.set(s.id, s as unknown as Record<string, unknown>);
              }
            }
          }
        } catch { /* skip */ }
      }

      // Gather tracks in the same genres
      for (const genre of genres.slice(0, 5)) {
        try {
          const songs = await api.getSongsByGenre(genre, 50, 0);
          for (const s of songs) {
            if (!excludeIds.has(s.id) && !candidates.has(s.id)) {
              candidates.set(s.id, s as unknown as Record<string, unknown>);
            }
          }
        } catch { /* skip */ }
      }

      const sorted = [...candidates.values()].sort((a, b) => {
        const ra = (a.user_rating as number) ?? 0;
        const rb = (b.user_rating as number) ?? 0;
        return rb - ra;
      }).slice(0, 30);

      const sourceArtists = [...new Set(sourceTracks.map(t => t.artist))].filter(Boolean).slice(0, 5);
      const header = `Found ${sorted.length} candidates (from ${artistIds.length} shared artists, ${genres.length} shared genres).\nSource artists include: ${sourceArtists.join(', ')}\nSource genres: ${genres.join(', ')}`;

      return header + '\n\n' + formatTable(sorted, TRACK_FIELDS);
    }

    case 'apply_tag': {
      const trackId = input.track_id as string;
      const cached = await api.getCachedTrack(trackId);
      const song: Song = cached ?? { id: trackId, title: input.track_title as string };
      const playlistId = await api.applyPlaylistTag(song, input.tag_name as string);
      return `Tagged "${song.title}" with "${input.tag_name}" (playlist: ${playlistId})`;
    }

    case 'apply_tag_bulk': {
      const tracks = (input.tracks as Array<{ id: string; title: string }>).slice(0, MAX_BULK_TAG);
      const tagName = input.tag_name as string;
      let ok = 0;
      let fail = 0;
      for (const t of tracks) {
        try {
          const cached = await api.getCachedTrack(t.id);
          const song: Song = cached ?? { id: t.id, title: t.title };
          await api.applyPlaylistTag(song, tagName);
          ok++;
        } catch {
          fail++;
        }
      }
      return `Tagged ${ok}/${tracks.length} tracks with "${tagName}"${fail > 0 ? ` (${fail} failed)` : ''}`;
    }

    default:
      return `Unknown tool: ${name}`;
  }
}
