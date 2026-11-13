import {
  STAGE_BREAKPOINT,
  STAGE_COLUMN_WIDTH,
  STAGE_FLOAT_MIN_HEIGHT,
  STAGE_WORDMARK_MIN_WIDTH,
  webStageCss,
} from '@/components/shell/webStage';
import { maxContentWidth } from '@/theme';

/** The CSS body of the first block that follows `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing ${selector}`);
  let depth = 0;
  let open = -1;
  for (let i = start; i < css.length; i++) {
    if (css[i] === '{') {
      if (depth++ === 0) open = i;
    } else if (css[i] === '}' && --depth === 0) {
      return css.slice(open + 1, i);
    }
  }
  throw new Error(`unclosed ${selector}`);
}

describe('web stage CSS', () => {
  it('leaves phones full width and centers a column on tablet and desktop', () => {
    const before = webStageCss.split(`@media (min-width: ${STAGE_BREAKPOINT}px)`)[0];
    expect(before).not.toMatch(/#root/); // no column below the breakpoint
    const wide = block(webStageCss, `@media (min-width: ${STAGE_BREAKPOINT}px) {`);
    expect(wide).toContain(`width: ${STAGE_COLUMN_WIDTH}px`);
    expect(wide).toContain('max-width: 100%');
    expect(wide).toMatch(/body \{[^}]*justify-content: center/);
  });

  it('uses a column that fits a phone-sized layout and stays inside the content width', () => {
    expect(STAGE_COLUMN_WIDTH).toBeGreaterThanOrEqual(393);
    expect(STAGE_COLUMN_WIDTH).toBeLessThan(STAGE_BREAKPOINT);
    expect(STAGE_COLUMN_WIDTH).toBeLessThanOrEqual(maxContentWidth);
  });

  it('floats the column with rounded corners only when the window is tall enough', () => {
    const tall = block(
      webStageCss,
      `@media (min-width: ${STAGE_BREAKPOINT}px) and (min-height: ${STAGE_FLOAT_MIN_HEIGHT}px)`,
    );
    expect(tall).toContain('border-radius');
    expect(tall).toContain('calc(100% - 64px)');
  });

  it('shows the wordmark only beside a wide column, silent to screen readers', () => {
    expect((STAGE_WORDMARK_MIN_WIDTH - STAGE_COLUMN_WIDTH) / 2).toBeGreaterThanOrEqual(260);
    const wordmark = block(webStageCss, `@media (min-width: ${STAGE_WORDMARK_MIN_WIDTH}px)`);
    expect(wordmark).toContain('content: "Tile & Tea" / ""');
    expect(wordmark).toContain('pointer-events: none');
  });

  it('draws a keyboard-only focus ring that reads on both ivory and felt', () => {
    expect(block(webStageCss, ':focus-visible {')).toMatch(/outline: 3px solid #C9A24B/);
    expect(block(webStageCss, ':focus-visible::after')).toMatch(/border: 3px solid #0A2A23/);
  });

  it('can sit inside a <style> tag and url("…") without breaking out', () => {
    expect(webStageCss).not.toContain('</');
    for (const [, uri] of webStageCss.matchAll(/url\("([^"]*)"\)/g)) {
      expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
      expect(uri).not.toMatch(/[<>"#]/);
    }
  });
});
