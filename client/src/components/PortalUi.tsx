import { useState, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { initialsFor, mediaUrl } from "@/lib/media";

/** A profile photo, falling back to the person's initials when there is no photo or it fails to load. */
export function PersonAvatar({ name, email, src, size = 72 }: { name?: string | null; email?: string | null; src?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = mediaUrl(src);
  const dimension = { width: size, height: size };
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={name ? `${name}'s profile photo` : "Profile photo"}
        style={dimension}
        onError={() => setFailed(true)}
        className="shrink-0 rounded-2xl border border-[#00e5ff]/40 object-cover"
      />
    );
  }
  return (
    <div style={dimension} className="flex shrink-0 items-center justify-center rounded-2xl border border-[#00e5ff]/40 bg-gradient-to-br from-[#2a0f5c] to-[#0c0524] text-xl font-black text-[#00e5ff]" aria-label="No profile photo">
      {initialsFor(name, email)}
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "mint" }: { label: string; value: ReactNode; hint?: string; tone?: "mint" | "cyan" | "lavender" | "amber" }) {
  const color = { mint: "text-[#00ff88]", cyan: "text-[#00e5ff]", lavender: "text-[#c4b5fd]", amber: "text-[#f4c44e]" }[tone];
  return (
    <Card className="border-white/10 bg-[#120730]">
      <CardContent className="p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</div>
        <div className={`mt-2 text-3xl font-black ${color}`}>{value}</div>
        {hint && <p className="mt-1 text-xs text-[#c4b5fd]/80">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/** A compact bar chart of scores over time, drawn in SVG so it needs no charting setup. */
export function ScoreTrend({ points }: { points: { date: string | null; percent: number }[] }) {
  if (!points.length) {
    return <p className="text-sm text-[#c4b5fd]">Scores appear here once submissions have been marked.</p>;
  }
  const width = 640;
  const height = 180;
  const padding = 28;
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;
  const barWidth = Math.min(48, Math.max(14, (width - padding * 2) / points.length - 12));
  return (
    <svg viewBox={`0 0 ${width} ${height + 26}`} className="w-full" role="img" aria-label="Marked scores over time">
      <line x1={padding} x2={width - padding} y1={height - (50 / 100) * (height - 20) - 10} y2={height - (50 / 100) * (height - 20) - 10} stroke="#f4c44e" strokeDasharray="4 4" opacity="0.6" />
      <text x={width - padding} y={height - (50 / 100) * (height - 20) - 14} fill="#f4c44e" fontSize="10" textAnchor="end">Pass 50%</text>
      {points.map((point, index) => {
        const barHeight = Math.max(2, (point.percent / 100) * (height - 20));
        const x = points.length === 1 ? width / 2 - barWidth / 2 : padding + index * step - barWidth / 2;
        const y = height - barHeight - 10;
        const color = point.percent >= 50 ? "#00ff88" : "#ff8a7a";
        return (
          <g key={`${point.date}-${index}`}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={4} fill={color} opacity="0.85" />
            <text x={x + barWidth / 2} y={y - 4} fill="#ffffff" fontSize="10" textAnchor="middle">{Math.round(point.percent)}%</text>
            <text x={x + barWidth / 2} y={height + 14} fill="#c4b5fd" fontSize="9" textAnchor="middle">{point.date ? new Date(point.date).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : ""}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <Card className="border-dashed border-white/15 bg-[#120730]/60">
      <CardContent className="p-8 text-center">
        <h3 className="font-bold text-white">{title}</h3>
        <p className="mt-2 text-sm text-[#c4b5fd]">{body}</p>
      </CardContent>
    </Card>
  );
}

/**
 * A product's featured image. The stored path is resolved against the portal's base path, and if
 * that file cannot be loaded the category artwork is shown instead, so a card never has a broken
 * image icon in it.
 */
export function ProductImage({ src, fallback, alt = "", className }: { src?: string | null; fallback?: string | null; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const primary = mediaUrl(src);
  const backup = mediaUrl(fallback);
  const url = !failed && primary ? primary : backup;
  if (!url) return <div className={`${className ?? ""} bg-[#18093c]`} aria-hidden="true" />;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => {
        if (!failed && primary) setFailed(true);
      }}
    />
  );
}
