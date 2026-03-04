import { useMemo } from 'react';

interface SchemePreviewProps {
  colors: string[];
  bgColor: string;
  width?: number;
  height?: number;
}

// Deterministic pseudo-random from seed
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export default function SchemePreview({
  colors,
  bgColor,
  width = 120,
  height = 48,
}: SchemePreviewProps) {
  const paths = useMemo(() => {
    const numLayers = Math.min(colors.length, 12);
    const numPoints = 8;
    const rng = seededRandom(42);

    // Generate layer heights at each point
    const layers: number[][] = [];
    for (let i = 0; i < numLayers; i++) {
      const row: number[] = [];
      for (let j = 0; j < numPoints; j++) {
        row.push(rng() * 3 + 0.5);
      }
      layers.push(row);
    }

    // Stack with silhouette offset
    const totals = Array.from({ length: numPoints }, (_, j) =>
      layers.reduce((sum, l) => sum + l[j], 0)
    );

    const stacked: { y0: number[]; y1: number[] }[] = [];
    const offsets = totals.map((t) => -t / 2);

    for (let i = 0; i < numLayers; i++) {
      const y0: number[] = [];
      const y1: number[] = [];
      for (let j = 0; j < numPoints; j++) {
        const base = offsets[j];
        y0.push(base);
        y1.push(base + layers[i][j]);
        offsets[j] += layers[i][j];
      }
      stacked.push({ y0, y1 });
    }

    // Scale to fit
    const allY = stacked.flatMap((s) => [...s.y0, ...s.y1]);
    const yMin = Math.min(...allY);
    const yMax = Math.max(...allY);
    const yRange = yMax - yMin || 1;

    const scaleX = (j: number) => (j / (numPoints - 1)) * width;
    const scaleY = (v: number) => ((v - yMin) / yRange) * height;

    // Build smooth paths using cubic bezier
    return stacked.map(({ y0, y1 }, i) => {
      const points0 = y0.map((v, j) => [scaleX(j), scaleY(v)] as [number, number]);
      const points1 = y1.map((v, j) => [scaleX(j), scaleY(v)] as [number, number]);

      // Forward along top (y1), backward along bottom (y0)
      const top = smoothLine(points1);
      const bottom = smoothLine([...points0].reverse());

      return {
        d: `${top} L${points0[points0.length - 1][0]},${points0[points0.length - 1][1]} ${bottom} Z`,
        fill: colors[i % colors.length],
      };
    });
  }, [colors, bgColor, width, height]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
    >
      <rect width={width} height={height} fill={bgColor} />
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.fill} stroke={bgColor} strokeWidth={0.3} />
      ))}
    </svg>
  );
}

// Attempt smooth cubic bezier through points
function smoothLine(points: [number, number][]): string {
  if (points.length < 2) return '';
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev[0] + curr[0]) / 2;
    d += ` C${cpx},${prev[1]} ${cpx},${curr[1]} ${curr[0]},${curr[1]}`;
  }
  return d;
}
