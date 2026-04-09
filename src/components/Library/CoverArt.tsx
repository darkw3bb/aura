import { useState, useEffect, useCallback, useRef } from 'react';
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
  const cacheKey = coverArt ? `${coverArt}_${size}` : '';
  const [src, setSrc] = useState<string | null>(() => {
    if (!coverArt) return null;
    return urlCache.get(cacheKey) ?? null;
  });
  const [fallbackAttempted, setFallbackAttempted] = useState(false);
  const wasCached = useRef(src !== null);

  useEffect(() => {
    if (!coverArt || src) return;
    if (failedKeys.has(cacheKey)) return;

    let cancelled = false;
    api.getCoverArtCached(coverArt, size).then((dataUri) => {
      if (!cancelled) {
        urlCache.set(cacheKey, dataUri);
        setSrc(dataUri);
      }
    }).catch(() => {
      if (!cancelled) {
        api.getCoverArtUrl(coverArt, size).then((url) => {
          if (!cancelled) {
            urlCache.set(cacheKey, url);
            setSrc(url);
          }
        });
      }
    });

    return () => { cancelled = true; };
  }, [coverArt, size, cacheKey, src]);

  const handleError = useCallback(() => {
    if (fallbackAttempted || !coverArt) return;
    setFallbackAttempted(true);

    if (artist && albumName) {
      api.fetchExternalCoverArt(artist, albumName, size).then((dataUri) => {
        urlCache.set(cacheKey, dataUri);
        setSrc(dataUri);
      }).catch(() => {
        failedKeys.add(cacheKey);
        setSrc(null);
      });
    } else {
      failedKeys.add(cacheKey);
      setSrc(null);
    }
  }, [coverArt, artist, albumName, size, cacheKey, fallbackAttempted]);

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
      className={`object-cover ${wasCached.current ? '' : 'cover-fade-in'} ${className}`}
      loading="lazy"
      onError={handleError}
    />
  );
}
