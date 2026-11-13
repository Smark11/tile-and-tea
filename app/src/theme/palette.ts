// Jade Parlor brand palette (docs/PRODUCT.md). Raw values only; screens use
// the semantic colors in colors.ts so light and dark mode stay in sync.
export const palette = {
  jadeFelt: '#0F3D33',
  jade: '#1F7A63',
  ivory: '#F7F1E3',
  tileEdge: '#D9CBA8',
  gold: '#C9A24B',
  lacquerRed: '#B23A3A',
  ink: '#1B1B1B',
  lacquer: '#121513',
} as const;

export type PaletteName = keyof typeof palette;

/** A palette color as `rgba()` at the given opacity. */
export function paletteAlpha(name: PaletteName, opacity: number): string {
  const hex = palette[name];
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Translucent tones for panels and marks laid on the jade felt. They read the
 * same in both schemes, since the felt is dark in both.
 */
export const feltTones = {
  /** Hairline edge of a panel on the felt. */
  panelEdge: paletteAlpha('ivory', 0.12),
  /** A panel's shade: the felt seen through smoked glass. */
  panelShade: 'rgba(0, 0, 0, 0.18)',
  /** A seat plaque's lighter shade and edge. */
  plaqueShade: 'rgba(0, 0, 0, 0.14)',
  plaqueEdge: paletteAlpha('ivory', 0.1),
  /** Gold edge and wash for whoever's move it is. */
  activeEdge: paletteAlpha('gold', 0.7),
  activeWash: paletteAlpha('gold', 0.1),
  /** Gold glow around a highlighted tile. */
  goldGlow: paletteAlpha('gold', 0.7),
  goldHairline: paletteAlpha('gold', 0.75),
  /** Outline of a wall stack already dealt or drawn. */
  emptyStack: paletteAlpha('ivory', 0.18),
} as const;
