/**
 * Convert a probability value (0–1) to an RGB color for the heatmap.
 *
 * Gradient:
 *   0%   → dark blue    (#0a1628)
 *   25%  → cyan         (#00aaff)
 *   50%  → yellow       (#ffdd00)
 *   75%  → orange       (#ff6600)
 *   100% → bright red   (#ff0000)
 */
export function probabilityToColor(p: number): { r: number; g: number; b: number } {
  // Clamp to [0, 1]
  const t = Math.max(0, Math.min(1, p));

  // Define color stops
  const stops = [
    { t: 0.00, r: 10,  g: 22,  b: 40  },  // dark blue
    { t: 0.25, r: 0,   g: 170, b: 255 },  // cyan
    { t: 0.50, r: 255, g: 221, b: 0   },  // yellow
    { t: 0.75, r: 255, g: 102, b: 0   },  // orange
    { t: 1.00, r: 255, g: 0,   b: 0   },  // red
  ];

  // Find the two stops to interpolate between
  let lower = stops[0];
  let upper = stops[stops.length - 1];

  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].t && t <= stops[i + 1].t) {
      lower = stops[i];
      upper = stops[i + 1];
      break;
    }
  }

  // Interpolation factor within this segment
  const range = upper.t - lower.t;
  const factor = range === 0 ? 0 : (t - lower.t) / range;

  return {
    r: Math.round(lower.r + (upper.r - lower.r) * factor),
    g: Math.round(lower.g + (upper.g - lower.g) * factor),
    b: Math.round(lower.b + (upper.b - lower.b) * factor),
  };
}

/**
 * Convert probability to CSS rgba string.
 */
export function probabilityToRgba(p: number, alpha: number = 1): string {
  const { r, g, b } = probabilityToColor(p);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Convert probability to CSS hex string.
 */
export function probabilityToHex(p: number): string {
  const { r, g, b } = probabilityToColor(p);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
