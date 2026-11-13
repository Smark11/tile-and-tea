import { brandColors, feltSvg, tileMarkMonochromeSvg, tileMarkSvg } from '../tileMark';
import { palette, tileInks } from '@/theme';

describe('brand mark', () => {
  it('uses the same colors as the app palette and tile inks', () => {
    // tileMark.ts can't import the theme (Node runs it directly), so this
    // test is what keeps the icon in step with the app.
    expect(brandColors).toMatchObject({
      jadeFelt: palette.jadeFelt,
      jade: palette.jade,
      gold: palette.gold,
      ivory: palette.ivory,
      leaf: tileInks.green,
      faceLight: tileInks.faceLight,
      faceShade: tileInks.faceShade,
      edgeLight: tileInks.edgeLight,
      edge: tileInks.edge,
      edgeShade: tileInks.edgeShade,
    });
  });

  it('renders a square SVG at the requested size', () => {
    const svg = tileMarkSvg({ size: 196 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="196" height="196"/);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('paints the felt only for the opaque app icon', () => {
    expect(tileMarkSvg({ size: 64, background: true })).toContain('url(#ttfelt)');
    expect(tileMarkSvg({ size: 64 })).not.toContain('url(#ttfelt)');
  });

  it('draws the face-down tile only when stacked', () => {
    const backTiles = (svg: string) => svg.match(/rotate\(9 50 70\)/g)?.length ?? 0;
    expect(backTiles(tileMarkSvg({ size: 64 }))).toBe(1);
    expect(backTiles(tileMarkSvg({ size: 64, stack: false }))).toBe(0);
  });

  it('prefixes every gradient id so two marks can share a page', () => {
    const svg = tileMarkSvg({ size: 64, idPrefix: 'zz' });
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThan(5);
    expect(ids.every((id) => id.startsWith('zz'))).toBe(true);
    // Every url(#…) reference points at an id that exists.
    for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(ref);
  });

  it('makes a white-only monochrome icon and a felt-only background layer', () => {
    const mono = tileMarkMonochromeSvg(1024);
    const fills = [...mono.matchAll(/(?:fill|stroke)="(#[0-9a-fA-F]+)"/g)].map((m) => m[1]);
    // Black is only used inside the mask to cut the leaf out.
    expect(new Set(fills)).toEqual(new Set(['#fff', '#000']));
    expect(feltSvg(1024)).toContain(brandColors.jadeFelt);
  });
});
