import { useCallback } from 'react';
import { api } from '../../lib/tauri';
import type { FlatSong } from '../../lib/tauri';
import { useLibraryStore } from '../../stores/libraryStore';
import { VirtualTrackList } from './VirtualTrackList';

export function GenreTracks() {
  const { selectedGenre } = useLibraryStore();

  const fetchPage = useCallback(
    (offset: number, pageSize: number): Promise<FlatSong[]> => {
      if (!selectedGenre) return Promise.resolve([]);
      return api.getSongsByGenre(selectedGenre, pageSize, offset);
    },
    [selectedGenre],
  );

  return (
    <VirtualTrackList
      fetchPage={fetchPage}
      resetKey={selectedGenre ?? ''}
      title={selectedGenre ?? ''}
      subtitle={(count, hasMore) =>
        `${count} track${count !== 1 ? 's' : ''}${hasMore ? '+' : ''}`
      }
      emptyContent={
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-themed-secondary">No tracks in this genre.</p>
        </div>
      }
    />
  );
}
