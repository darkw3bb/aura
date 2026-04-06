import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onChange: (rating: number) => void;
  size?: 'sm' | 'md';
}

export function StarRating({ rating, onChange, size = 'md' }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const starSize = size === 'sm' ? 14 : 20;
  const clamped = Math.max(0, Math.min(5, rating));

  return (
    <div
      className="flex gap-0.5"
      onMouseLeave={() => setHover(0)}
      onClick={(e) => e.stopPropagation()}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className="cursor-pointer transition-transform hover:scale-110 p-0 border-0 bg-transparent"
          onMouseEnter={() => setHover(star)}
          onClick={(e) => {
            e.stopPropagation();
            onChange(star === clamped ? 0 : star);
          }}
        >
          <svg
            width={starSize}
            height={starSize}
            viewBox="0 0 24 24"
            fill={(hover || clamped) >= star ? 'var(--rating-star)' : 'none'}
            stroke={(hover || clamped) >= star ? 'var(--rating-star)' : 'var(--text-muted)'}
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  );
}
