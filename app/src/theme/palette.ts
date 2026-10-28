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
