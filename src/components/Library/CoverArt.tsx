import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/tauri';

const urlCache = new Map<string, string>();
const failedKeys = new Set<string>();

interface CoverArtProps {
  coverArt?: string;
  artist?: string;
  albumName?: string;
  size?: number;
  className?: string;
}

export function CoverArt({ coverArt, artist, albumName, size = 200, className = '' }: CoverArtProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [fallbackAttempted, setFallbackAttempted] = useState(false);

  useEffect(() => {
    if (!coverArt) return;
    const key = `${coverArt}_${size}`;
    if (failedKeys.has(key)) return;

    const cached = urlCache.get(key);
    if (cached) {
      setSrc(cached);
      return;
    }

    let cancelled = false;
    api.getCoverArtUrl(coverArt, size).then((url) => {
      if (!cancelled) {
        urlCache.set(key, url);
        setSrc(url);
      }
    });

    return () => { cancelled = true; };
  }, [coverArt, size]);

  const handleError = useCallback(() => {
    if (fallbackAttempted || !coverArt) return;
    setFallbackAttempted(true);

    const key = `${coverArt}_${size}`;

    if (artist && albumName) {
      api.fetchExternalCoverArt(artist, albumName, size).then((dataUri) => {
        urlCache.set(key, dataUri);
        setSrc(dataUri);
      }).catch(() => {
        failedKeys.add(key);
        setSrc(null);
      });
    } else {
      failedKeys.add(key);
      setSrc(null);
    }
  }, [coverArt, artist, albumName, size, fallbackAttempted]);

  if (!src) {
    return (
      <div
        className={`flex items-center justify-center bg-themed-tertiary ${className}`}
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="stroke-themed-muted" strokeWidth="1.5">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={`object-cover ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}
