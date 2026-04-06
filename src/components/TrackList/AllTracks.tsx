import { useCallback, useState } from 'react';
import { api } from '../../lib/tauri';
import type { FlatSong } from '../../lib/tauri';
import { VirtualTrackList } from './VirtualTrackList';

export function AllTracks() {
  const [sortField, setSortField] = useState('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchPage = useCallback(
    (offset: number, pageSize: number): Promise<FlatSong[]> =>
      api.getAllTracks(offset, pageSize, sortField, sortDir),
    [sortField, sortDir],
  );

  const handleSortChange = useCallback((field: string) => {
    const descFirst = new Set(['user_rating', 'play_count', 'created']);
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(descFirst.has(field) ? 'desc' : 'asc');
    }
  }, [sortField]);

  return (
    <VirtualTrackList
      fetchPage={fetchPage}
      resetKey={`tracks-${sortField}-${sortDir}`}
      title="Tracks"
      subtitle={(count, hasMore) =>
        `${count} track${count !== 1 ? 's' : ''}${hasMore ? '+' : ''}`
      }
      showPlayCount
      showAdded
      sortField={sortField}
      sortDirection={sortDir}
      onSortChange={handleSortChange}
      emptyContent={
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <p className="text-sm text-themed-secondary">No tracks in library.</p>
            <p className="text-xs mt-1 text-themed-muted">
              Sync your library from Settings to see tracks here.
            </p>
          </div>
        </div>
      }
    />
  );
}
