import { useCallback } from 'react';
import { api } from '../../lib/tauri';
import type { FlatSong } from '../../lib/tauri';
import { VirtualTrackList } from './VirtualTrackList';

export function RatedTracks() {
  const fetchPage = useCallback(
    (offset: number, pageSize: number): Promise<FlatSong[]> =>
      api.getCachedTracksByRating(offset, pageSize),
    [],
  );

  return (
    <VirtualTrackList
      fetchPage={fetchPage}
      resetKey="rated"
      title="Top Rated"
      subtitle={(count) => `${count} rated track${count !== 1 ? 's' : ''}`}
      showBitRate
      removeOnZeroRating
      emptyContent={
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center">
            <p className="text-sm text-themed-secondary">No rated tracks yet.</p>
            <p className="text-xs mt-1 text-themed-muted">
              Rate tracks using the star icons, then they&rsquo;ll appear here.
            </p>
          </div>
        </div>
      }
    />
  );
}
