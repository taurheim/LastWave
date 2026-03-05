/**
 * Bezier overflow detection utilities.
 * Parses D3 area SVG paths and checks text bounding boxes against actual curves.
 */

/**
 * Sample a Bezier area path to build a lookup: pixel-x → { top, bot } in SVG coords.
 * Parses the SVG path `d` attribute from d3.area with curveMonotoneX.
 */
export function buildBandLUT(pathD: string, width: number): Array<{ top: number; bot: number } | null> | null {
  const maxX = Math.ceil(width) + 2;
  const topY = new Float64Array(maxX).fill(NaN);
  const botY = new Float64Array(maxX).fill(NaN);

  // Parse path commands
  const cmds: { cmd: string; args: number[] }[] = [];
  const re = /([MLCZmlcz])([^MLCZmlcz]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(pathD)) !== null) {
    const nums = m[2].trim().split(/[\s,]+/).filter(s => s.length > 0).map(Number);
    cmds.push({ cmd: m[1], args: nums });
  }

  // Find split point (L command separates top curve from bottom curve)
  let splitIdx = -1;
  for (let i = 1; i < cmds.length; i++) {
    if (cmds[i].cmd === 'L') { splitIdx = i; break; }
  }
  if (splitIdx < 0) return null;

  function traceCurve(cmdList: typeof cmds, arr: Float64Array) {
    let cx = 0, cy = 0;
    for (const { cmd, args } of cmdList) {
      if (cmd === 'M') {
        cx = args[0]; cy = args[1];
        const ix = Math.round(cx);
        if (ix >= 0 && ix < arr.length) arr[ix] = cy;
      } else if (cmd === 'L') {
        const x1 = args[0], y1 = args[1];
        const dx = x1 - cx, dy = y1 - cy;
        const steps = Math.max(Math.abs(Math.round(dx)), 1);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          const ix = Math.round(cx + dx * t);
          if (ix >= 0 && ix < arr.length) arr[ix] = cy + dy * t;
        }
        cx = x1; cy = y1;
      } else if (cmd === 'C') {
        const p0x = cx, p0y = cy;
        const [p1x, p1y, p2x, p2y, p3x, p3y] = args;
        const n = Math.max(Math.abs(Math.round(p3x - p0x)) * 3, 30);
        for (let s = 0; s <= n; s++) {
          const t = s / n, u = 1 - t;
          const sx = u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x;
          const sy = u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y;
          const ix = Math.round(sx);
          if (ix >= 0 && ix < arr.length) arr[ix] = sy;
        }
        cx = p3x; cy = p3y;
      }
    }
    // Fill gaps with linear interpolation
    let last = -1;
    for (let i = 0; i < arr.length; i++) {
      if (!isNaN(arr[i])) {
        if (last >= 0 && i - last > 1) {
          const a = arr[last], b = arr[i];
          for (let j = last + 1; j < i; j++)
            arr[j] = a + (b - a) * (j - last) / (i - last);
        }
        last = i;
      }
    }
  }

  traceCurve(cmds.slice(0, splitIdx), topY);
  traceCurve([
    { cmd: 'M', args: cmds[splitIdx].args },
    ...cmds.slice(splitIdx + 1).filter(c => c.cmd !== 'Z'),
  ], botY);

  const result: Array<{ top: number; bot: number } | null> = new Array(maxX).fill(null);
  for (let i = 0; i < maxX; i++) {
    if (!isNaN(topY[i]) && !isNaN(botY[i])) {
      result[i] = { top: topY[i], bot: botY[i] };
    }
  }
  return result;
}

export interface OverflowInfo {
  artist: string;
  overflowPx: number;
  overflowPct: number;
}

/**
 * Check a single label for Bezier overflow. Returns overflow info or null if no overflow.
 */
export function checkLabelOverflow(
  label: { text: string; xPosition: number; yPosition: number; fontSize: number },
  fontFamily: string,
  height: number,
  bandLUT: Array<{ top: number; bot: number } | null>,
): OverflowInfo | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${label.fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(label.text);
  const ascent = metrics.actualBoundingBoxAscent;
  const descent = metrics.actualBoundingBoxDescent;
  const textWidth = metrics.width;
  const textHeight = ascent + descent;

  const baselineSvgY = height - label.yPosition;
  const textTop = baselineSvgY - ascent;
  const textBot = baselineSvgY + descent;

  const tL = Math.max(0, Math.floor(label.xPosition));
  const tR = Math.min(bandLUT.length - 1, Math.ceil(label.xPosition + textWidth));
  const totalArea = textWidth * textHeight;

  let worstPx = 0;
  let overflowArea = 0;

  for (let px = tL; px <= tR; px++) {
    const b = bandLUT[px];
    if (!b) continue;
    const overTop = Math.max(0, b.top - textTop);
    const overBot = Math.max(0, textBot - b.bot);
    worstPx = Math.max(worstPx, overTop, overBot);
    overflowArea += Math.min(overTop + overBot, textHeight);
  }

  const pct = totalArea > 0 ? Math.round((overflowArea / totalArea) * 100) : 0;

  if (worstPx > 1) {
    return { artist: label.text, overflowPx: Math.round(worstPx), overflowPct: pct };
  }
  return null;
}
