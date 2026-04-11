import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../../lib/tauri';
import type { StatsData } from '../../lib/tauri';
import { useLibraryStore } from '../../stores/libraryStore';
import { useUsageStore, usageForPeriod, previousPeriodUsage } from '../../stores/usageStore';
import { CoverArt } from '../Library/CoverArt';
import { ResponsiveLine } from '@nivo/line';
import { ResponsiveRadar } from '@nivo/radar';

const statsCache = new Map<string, StatsData>();

type Period = 'week' | 'month' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

function formatDuration(totalSecs: number): string {
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const rem = hours % 24;
    return `${days}d ${rem}h`;
  }
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getDelta(
  current: number,
  prev: number,
): { text: string; positive: boolean } | null {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return { text: `+${current}`, positive: true };
  const pct = ((current - prev) / prev) * 100;
  const sign = pct >= 0 ? '+' : '';
  return { text: `${sign}${pct.toFixed(0)}%`, positive: pct >= 0 };
}

function getNivoTheme() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    text: { fontSize: 11, fill: v('--text-muted') },
    axis: {
      domain: { line: { stroke: v('--border') } },
      ticks: {
        line: { stroke: v('--border') },
        text: { fill: v('--text-muted'), fontSize: 10 },
      },
    },
    grid: { line: { stroke: v('--border'), strokeOpacity: 0.4 } },
    tooltip: {
      container: {
        background: v('--bg-tertiary'),
        color: v('--text-primary'),
        fontSize: 12,
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,.4)',
        border: `1px solid ${v('--border')}`,
      },
    },
    crosshair: { line: { stroke: v('--text-muted'), strokeWidth: 1 } },
  };
}

function getAccentColor() {
  return getComputedStyle(document.documentElement)
    .getPropertyValue('--accent')
    .trim();
}

export function StatsView() {
  const [period, setPeriod] = useState<Period>('week');
  const [stats, setStats] = useState<StatsData | null>(
    statsCache.get('week') ?? null,
  );
  const [loading, setLoading] = useState(!statsCache.has('week'));
  const { loadAlbum, loadArtist, saveScrollTop } = useLibraryStore();

  useEffect(() => {
    const cached = statsCache.get(period);
    if (cached) {
      setStats(cached);
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getStats(period)
      .then((data) => {
        statsCache.set(period, data);
        setStats(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error('Failed to load stats:', e);
        setLoading(false);
      });
  }, [period]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nivoTheme = useMemo(() => getNivoTheme(), [stats]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const accent = useMemo(() => getAccentColor(), [stats]);

  const handleAlbumClick = useCallback(
    (albumId: string) => {
      saveScrollTop(0);
      loadAlbum(albumId);
    },
    [loadAlbum, saveScrollTop],
  );
  const handleArtistClick = useCallback(
    (artistId: string) => {
      saveScrollTop(0);
      loadArtist(artistId);
    },
    [loadArtist, saveScrollTop],
  );

  const usageLog = useUsageStore(s => s.log);
  const maestroUsage = useMemo(() => usageForPeriod(usageLog, period), [usageLog, period]);
  const maestroPrev = useMemo(
    () => period !== 'all' ? previousPeriodUsage(usageLog, period) : null,
    [usageLog, period],
  );

  const showDelta = period !== 'all';

  const lineData = useMemo(() => {
    if (!stats?.daily_plays.length) return [];
    return [
      {
        id: 'plays',
        data: stats.daily_plays.map((d) => ({ x: d.date, y: d.count })),
      },
    ];
  }, [stats]);

  const radarData = useMemo(() => {
    if (!stats?.top_genres.length) return [];
    return stats.top_genres.map((g) => ({ genre: g.genre, plays: g.plays }));
  }, [stats]);

  const hasLineChart = lineData.length > 0 && lineData[0].data.length > 1;
  const hasRadarChart = radarData.length >= 3;
  const hasCharts = hasLineChart || hasRadarChart;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-themed-primary tracking-tight">
          Stats
        </h1>
        <div className="flex gap-1 p-1 rounded-lg bg-themed-secondary border border-themed">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors cursor-pointer ${
                period === p.key
                  ? 'bg-themed-accent text-white'
                  : 'text-themed-secondary hover:text-themed-primary hover:bg-themed-hover'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-3">
            <svg
              className="animate-spin"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" className="stroke-themed-muted" />
            </svg>
            <p className="text-themed-muted text-[13px]">Loading stats...</p>
          </div>
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Plays"
              value={formatNumber(stats.period_plays)}
              delta={
                showDelta
                  ? getDelta(stats.period_plays, stats.prev_plays)
                  : null
              }
            />
            <StatCard
              label="Listening Time"
              value={formatDuration(stats.period_duration_secs)}
              delta={
                showDelta
                  ? getDelta(
                      stats.period_duration_secs,
                      stats.prev_duration_secs,
                    )
                  : null
              }
            />
            <StatCard
              label="Artists"
              value={formatNumber(stats.period_unique_artists)}
              delta={
                showDelta
                  ? getDelta(
                      stats.period_unique_artists,
                      stats.prev_unique_artists,
                    )
                  : null
              }
            />
            <StatCard
              label="Albums"
              value={formatNumber(stats.period_unique_albums)}
              delta={
                showDelta
                  ? getDelta(
                      stats.period_unique_albums,
                      stats.prev_unique_albums,
                    )
                  : null
              }
            />
            <StatCard
              label="Tracks"
              value={formatNumber(stats.period_unique_tracks)}
              delta={
                showDelta
                  ? getDelta(
                      stats.period_unique_tracks,
                      stats.prev_unique_tracks,
                    )
                  : null
              }
            />
            <StatCard
              label="Top Genre"
              value={stats.top_genres[0]?.genre ?? 'N/A'}
              subtext={
                stats.top_genres[0]
                  ? `${stats.top_genres[0].plays} plays`
                  : undefined
              }
            />
            {maestroUsage.requests > 0 && (
              <StatCard
                label="Maestro Cost"
                value={`$${maestroUsage.cost.toFixed(2)}`}
                subtext={`${formatNumber(maestroUsage.inputTokens + maestroUsage.outputTokens)} tokens`}
                delta={
                  showDelta && maestroPrev
                    ? getDelta(
                        Math.round(maestroUsage.cost * 100),
                        Math.round(maestroPrev.cost * 100),
                      )
                    : null
                }
              />
            )}
          </div>

          {hasCharts && (
            <div
              className={`grid gap-3 ${hasLineChart && hasRadarChart ? 'grid-cols-2' : 'grid-cols-1'}`}
            >
              {hasLineChart && (
                <div className="rounded-lg bg-themed-secondary border border-themed p-4">
                  <h3 className="text-[13px] font-semibold text-themed-primary mb-3">
                    Daily Listening
                  </h3>
                  <div style={{ height: 220 }}>
                    <ResponsiveLine
                      data={lineData}
                      margin={{ top: 10, right: 20, bottom: 44, left: 36 }}
                      xScale={{ type: 'point' }}
                      yScale={{
                        type: 'linear',
                        min: 0,
                        stacked: false,
                      }}
                      curve="monotoneX"
                      enableArea
                      areaOpacity={0.12}
                      colors={[accent]}
                      lineWidth={2}
                      pointSize={6}
                      pointColor={accent}
                      pointBorderWidth={0}
                      enableGridX={false}
                      axisBottom={{
                        tickRotation: -45,
                        format: (v: string) => {
                          const d = new Date(v + 'T00:00:00');
                          return d.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          });
                        },
                        tickPadding: 8,
                      }}
                      axisLeft={{
                        tickValues: 5,
                        tickPadding: 4,
                      }}
                      theme={nivoTheme}
                      animate
                      motionConfig="gentle"
                    />
                  </div>
                </div>
              )}
              {hasRadarChart && (
                <div className="rounded-lg bg-themed-secondary border border-themed p-4">
                  <h3 className="text-[13px] font-semibold text-themed-primary mb-3">
                    Genre Map
                  </h3>
                  <div style={{ height: 220 }}>
                    <ResponsiveRadar
                      data={radarData}
                      keys={['plays']}
                      indexBy="genre"
                      maxValue="auto"
                      margin={{ top: 24, right: 60, bottom: 24, left: 60 }}
                      colors={[accent]}
                      fillOpacity={0.2}
                      borderColor={accent}
                      borderWidth={2}
                      dotSize={8}
                      dotBorderWidth={2}
                      dotBorderColor={accent}
                      gridShape="circular"
                      theme={nivoTheme}
                      animate
                      motionConfig="gentle"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <MiniStat
              label="Library Tracks"
              value={formatNumber(stats.total_tracks)}
            />
            <MiniStat
              label="Library Albums"
              value={formatNumber(stats.total_albums)}
            />
            <MiniStat
              label="Library Artists"
              value={formatNumber(stats.total_artists)}
            />
            <MiniStat
              label="Genres"
              value={formatNumber(stats.total_genres)}
            />
          </div>

          {(stats.top_tracks.length > 0 ||
            stats.top_artists.length > 0 ||
            stats.top_albums.length > 0) && (
            <div className="grid grid-cols-3 gap-3">
              {stats.top_tracks.length > 0 && (
                <RankedCard title="Top Tracks">
                  {stats.top_tracks.map((t, i) => (
                    <RankedRow
                      key={t.id}
                      rank={i + 1}
                      coverArt={t.cover_art}
                      primary={t.title}
                      secondary={t.artist ?? 'Unknown'}
                      stat={`${t.plays}`}
                      onClick={
                        t.album_id
                          ? () => handleAlbumClick(t.album_id!)
                          : undefined
                      }
                    />
                  ))}
                </RankedCard>
              )}
              {stats.top_artists.length > 0 && (
                <RankedCard title="Top Artists">
                  {stats.top_artists.map((a, i) => (
                    <RankedRow
                      key={a.id}
                      rank={i + 1}
                      coverArt={a.cover_art}
                      primary={a.name}
                      secondary={`${a.track_count} tracks`}
                      stat={`${a.plays}`}
                      onClick={() => handleArtistClick(a.id)}
                    />
                  ))}
                </RankedCard>
              )}
              {stats.top_albums.length > 0 && (
                <RankedCard title="Top Albums">
                  {stats.top_albums.map((a, i) => (
                    <RankedRow
                      key={a.id}
                      rank={i + 1}
                      coverArt={a.cover_art}
                      primary={a.name}
                      secondary={a.artist ?? 'Unknown'}
                      stat={`${a.plays}`}
                      onClick={() => handleAlbumClick(a.id)}
                    />
                  ))}
                </RankedCard>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center justify-center h-64">
          <p className="text-themed-muted text-[13px]">No stats available</p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  subtext,
}: {
  label: string;
  value: string;
  delta?: { text: string; positive: boolean } | null;
  subtext?: string;
}) {
  return (
    <div className="rounded-lg bg-themed-secondary border border-themed p-4">
      <p className="text-[11px] font-medium text-themed-muted uppercase tracking-wider">
        {label}
      </p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-themed-primary tracking-tight">
          {value}
        </span>
        {delta && (
          <span
            className={`text-[12px] font-semibold ${delta.positive ? 'text-themed-success' : 'text-themed-error'}`}
          >
            {delta.text}
          </span>
        )}
      </div>
      {subtext && (
        <p className="text-[11px] text-themed-muted mt-0.5">{subtext}</p>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-themed-secondary border border-themed px-4 py-2.5 flex items-center justify-between">
      <span className="text-[11px] text-themed-muted">{label}</span>
      <span className="text-[13px] font-semibold text-themed-primary font-mono">
        {value}
      </span>
    </div>
  );
}

function RankedCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-themed-secondary border border-themed p-4">
      <h3 className="text-[13px] font-semibold text-themed-primary mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function RankedRow({
  rank,
  coverArt,
  primary,
  secondary,
  stat,
  onClick,
}: {
  rank: number;
  coverArt?: string;
  primary: string;
  secondary: string;
  stat: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 px-1.5 py-1.5 rounded-md transition-colors ${onClick ? 'cursor-pointer hover:bg-themed-hover' : ''}`}
    >
      <span className="text-[11px] font-mono text-themed-muted w-4 text-right shrink-0">
        {rank}
      </span>
      <CoverArt
        coverArt={coverArt}
        size={80}
        className="w-8 h-8 rounded shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-themed-primary truncate">
          {primary}
        </p>
        <p className="text-[11px] text-themed-muted truncate">{secondary}</p>
      </div>
      <span className="text-[11px] font-mono text-themed-accent shrink-0">
        {stat}
      </span>
    </div>
  );
}
