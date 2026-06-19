interface ArchRowProps {
  color: string;
  count?: number;
  radius?: number;
  spacing?: number;
  className?: string;
}

/** A row of overlapping rainbow-style arch outlines, used as decorative background filler. */
export function ArchRow({ color, count = 4, radius = 90, spacing = 70, className }: ArchRowProps) {
  const width = spacing * (count - 1) + radius * 2 + 20;
  const height = radius + 20;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      preserveAspectRatio="xMidYMax meet"
      xmlns="http://www.w3.org/2000/svg"
    >
      {Array.from({ length: count }).map((_, i) => {
        const cx = radius + 10 + i * spacing;
        const cy = height;
        return (
          <path
            key={i}
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            stroke={color}
            strokeWidth="2"
          />
        );
      })}
    </svg>
  );
}
