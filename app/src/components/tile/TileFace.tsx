import { memo, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import type { Dragon, Rank, Suit, TileKind, Wind } from '@/game/tiles';
import { fontFamilies, tileInks as ink } from '@/theme';

// Every tile is drawn in a 100 × 140 box: a jade back layer, the ivory body
// whose side shows below the face, then the face with the art. The art sits
// in x 14–86, y 26–118, under a corner index like the one on American sets.
export const TILE_VIEWBOX = { width: 100, height: 140 } as const;

const CX = 50;
const CY = 72;

// Han glyphs come from the system's serif CJK face (Mincho/Song style), which
// reads like the brush-cut characters on real tiles.
const hanFont = Platform.select({
  ios: 'Hiragino Mincho ProN',
  android: 'serif',
  default: '"Songti TC", "Hiragino Mincho ProN", "Noto Serif CJK TC", serif',
});

/** An SVG rotation about a point (the `rotation`/`origin` props break on web). */
const rotate = (deg: number, x: number, y: number) => `rotate(${deg} ${x} ${y})`;

const CRAK_NUMERALS: Record<Rank, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
};
const WIND_GLYPHS: Record<Wind, string> = { N: '北', E: '東', W: '西', S: '南' };

function Index({ label }: { label: string }) {
  return (
    <SvgText
      x={11}
      y={24}
      fontSize={17}
      fontFamily={fontFamilies.sansSemiBold}
      fill={ink.ink}
      textAnchor="start"
    >
      {label}
    </SvgText>
  );
}

function Han({ glyph, x = CX, y, size, fill }: { glyph: string; x?: number; y: number; size: number; fill: string }) {
  return (
    <SvgText x={x} y={y} fontSize={size} fontFamily={hanFont} fontWeight="bold" fill={fill} textAnchor="middle">
      {glyph}
    </SvgText>
  );
}

// ─── Dots ──────────────────────────────────────────────────────────────────

function Dot({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={color} />
      <Circle cx={x} cy={y} r={r * 0.7} fill={ink.faceLight} />
      <Circle cx={x} cy={y} r={r * 0.52} fill={color} />
      <Circle cx={x} cy={y} r={r * 0.2} fill={ink.faceLight} />
    </G>
  );
}

function OneDot() {
  const ring = Array.from({ length: 12 }, (_, i) => {
    const a = (i * Math.PI) / 6;
    return <Circle key={i} cx={CX + Math.cos(a) * 16} cy={CY + Math.sin(a) * 16} r={3.6} fill={ink.green} />;
  });
  return (
    <G>
      <Circle cx={CX} cy={CY} r={28} fill={ink.blue} />
      <Circle cx={CX} cy={CY} r={23} fill={ink.faceLight} />
      {ring}
      <Circle cx={CX} cy={CY} r={10} fill={ink.red} />
      <Circle cx={CX} cy={CY} r={4.5} fill={ink.faceLight} />
      <Circle cx={CX} cy={CY} r={2} fill={ink.red} />
    </G>
  );
}

type Spot = [dx: number, dy: number, color: string];
const B = ink.blue;
const G_ = ink.green;
const R = ink.red;

// Traditional pip layouts and colors, as offsets from the art center.
const DOT_LAYOUTS: Record<Exclude<Rank, 1>, { r: number; spots: Spot[] }> = {
  2: { r: 15, spots: [[0, -22, G_], [0, 22, B]] },
  3: { r: 12.5, spots: [[-20, -28, B], [0, 0, R], [20, 28, G_]] },
  4: { r: 13, spots: [[-16, -20, B], [16, -20, G_], [-16, 20, G_], [16, 20, B]] },
  5: {
    r: 11,
    spots: [[-20, -28, B], [20, -28, G_], [0, 0, R], [-20, 28, G_], [20, 28, B]],
  },
  6: {
    r: 11,
    spots: [[-15, -29, G_], [15, -29, G_], [-15, 0, R], [15, 0, R], [-15, 29, R], [15, 29, R]],
  },
  7: {
    r: 9.5,
    spots: [
      [-22, -35, G_],
      [0, -27, G_],
      [22, -19, G_],
      [-14, 10, R],
      [14, 10, R],
      [-14, 34, R],
      [14, 34, R],
    ],
  },
  8: {
    r: 10,
    spots: [-36, -12, 12, 36].flatMap((dy): Spot[] => [[-15, dy, B], [15, dy, B]]),
  },
  9: {
    r: 10,
    spots: (
      [
        [-28, B],
        [0, R],
        [28, G_],
      ] as const
    ).flatMap(([dy, c]): Spot[] => [[-22, dy, c], [0, dy, c], [22, dy, c]]),
  },
};

function Dots({ rank }: { rank: Rank }) {
  if (rank === 1) return <OneDot />;
  const { r, spots } = DOT_LAYOUTS[rank];
  return (
    <G>
      {spots.map(([dx, dy, color], i) => (
        <Dot key={i} x={CX + dx} y={CY + dy} r={r} color={color} />
      ))}
    </G>
  );
}

// ─── Bams ──────────────────────────────────────────────────────────────────

function Stick({ x, y, len, w = 9, color = ink.green }: { x: number; y: number; len: number; w?: number; color?: string }) {
  const top = y - len / 2;
  const bottom = y + len / 2;
  const hx = x - w / 2 + 2.4;
  return (
    <G>
      <Rect x={x - w / 2} y={top} width={w} height={len} rx={w / 2} fill={color} />
      {/* Joints at the middle and ends, slightly wider than the stalk. */}
      <Rect x={x - w / 2 - 1} y={y - 1.5} width={w + 2} height={3} rx={1.5} fill={color} />
      <Rect x={x - w / 2 - 0.6} y={top + 1} width={w + 1.2} height={2.4} rx={1.2} fill={color} />
      <Rect x={x - w / 2 - 0.6} y={bottom - 3.4} width={w + 1.2} height={2.4} rx={1.2} fill={color} />
      <Line x1={hx} y1={top + 5} x2={hx} y2={y - 3.5} stroke={ink.faceLight} strokeOpacity={0.55} strokeWidth={1.3} strokeLinecap="round" />
      <Line x1={hx} y1={y + 3.5} x2={hx} y2={bottom - 5} stroke={ink.faceLight} strokeOpacity={0.55} strokeWidth={1.3} strokeLinecap="round" />
    </G>
  );
}

type StickSpot = [dx: number, dy: number, len: number, color?: string];

const BAM_LAYOUTS: Record<Exclude<Rank, 1>, { w?: number; sticks: StickSpot[] }> = {
  2: { sticks: [[0, -22, 38], [0, 22, 38]] },
  3: { sticks: [[0, -22, 38], [-14, 22, 38], [14, 22, 38]] },
  4: { sticks: [[-14, -22, 38], [14, -22, 38], [-14, 22, 38], [14, 22, 38]] },
  5: {
    sticks: [[-20, -22, 38], [20, -22, 38], [0, 0, 38, ink.red], [-20, 22, 38], [20, 22, 38]],
  },
  6: { sticks: [-20, 0, 20].flatMap((dx): StickSpot[] => [[dx, -22, 38], [dx, 22, 38]]) },
  7: {
    sticks: [
      [0, -32, 24, ink.red],
      ...[-20, 0, 20].flatMap((dx): StickSpot[] => [[dx, -4, 26], [dx, 28, 26]]),
    ],
  },
  8: {
    w: 8,
    sticks: [-24, -8, 8, 24].flatMap((dx): StickSpot[] => [[dx, -22, 38], [dx, 22, 38]]),
  },
  9: {
    sticks: [-20, 0, 20].flatMap((dx): StickSpot[] =>
      [-32, 0, 32].map((dy): StickSpot => [dx, dy, 26, dx === 0 ? ink.red : undefined]),
    ),
  },
};

/** The 1 Bam: a songbird on a bamboo perch, as on traditional sets. */
function Bird() {
  return (
    <G>
      {/* Perch */}
      <Path d="M22 108 Q50 100 80 106" stroke={ink.green} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {/* Tail fan */}
      <Ellipse cx={27} cy={88} rx={5.5} ry={15} transform={rotate(58, 27, 88)} fill={ink.blue} />
      <Ellipse cx={31} cy={96} rx={5.5} ry={16} transform={rotate(36, 31, 96)} fill={ink.red} />
      <Ellipse cx={38} cy={101} rx={5} ry={14} transform={rotate(14, 38, 101)} fill={ink.green} />
      {/* Legs */}
      <Line x1={50} y1={88} x2={47} y2={103} stroke={ink.ink} strokeWidth={1.8} strokeLinecap="round" />
      <Line x1={57} y1={88} x2={57} y2={103} stroke={ink.ink} strokeWidth={1.8} strokeLinecap="round" />
      {/* Body, breast, wing */}
      <Ellipse cx={52} cy={76} rx={21} ry={15} transform={rotate(-22, 52, 76)} fill={ink.green} />
      <Ellipse cx={61} cy={78} rx={10} ry={11} fill={ink.gold} />
      <Path d="M36 76 Q46 60 62 66 Q54 80 36 76 Z" fill={ink.blue} />
      <Path d="M41 74 Q48 67 56 68" stroke={ink.faceLight} strokeOpacity={0.6} strokeWidth={1.2} fill="none" />
      {/* Neck and head */}
      <Ellipse cx={64} cy={60} rx={8} ry={11} transform={rotate(22, 64, 60)} fill={ink.green} />
      <Circle cx={69} cy={49} r={10} fill={ink.green} />
      <Path d="M62 41 Q64 32 71 36 Q66 37 66 41 Z" fill={ink.red} />
      <Path d="M78 47 L88 50.5 L78 54 Z" fill={ink.gold} />
      <Circle cx={72} cy={47.5} r={2.6} fill={ink.faceLight} />
      <Circle cx={72.6} cy={47.5} r={1.4} fill={ink.ink} />
    </G>
  );
}

function Bams({ rank }: { rank: Rank }) {
  if (rank === 1) return <Bird />;
  const { w, sticks } = BAM_LAYOUTS[rank];
  return (
    <G>
      {sticks.map(([dx, dy, len, color], i) => (
        <Stick key={i} x={CX + dx} y={CY + dy} len={len} w={w} color={color} />
      ))}
    </G>
  );
}

// ─── Craks, Winds, Dragons ─────────────────────────────────────────────────

function Craks({ rank }: { rank: Rank }) {
  return (
    <G>
      <Han glyph={CRAK_NUMERALS[rank]} y={62} size={34} fill={ink.ink} />
      <Han glyph="萬" y={111} size={42} fill={ink.red} />
    </G>
  );
}

function Soap() {
  return (
    <G>
      <Rect x={23} y={24} width={54} height={90} rx={6} stroke={ink.blue} strokeWidth={5} fill="none" />
      <Rect x={31.5} y={32.5} width={37} height={73} rx={3} stroke={ink.blue} strokeWidth={1.6} fill="none" />
      {[
        [31.5, 32.5],
        [68.5, 32.5],
        [31.5, 105.5],
        [68.5, 105.5],
      ].map(([x, y], i) => (
        <Rect key={i} x={x - 3} y={y - 3} width={6} height={6} transform={rotate(45, x, y)} fill={ink.blue} />
      ))}
    </G>
  );
}

function DragonArt({ dragon }: { dragon: Dragon }) {
  if (dragon === 'white') return <Soap />;
  return dragon === 'red' ? (
    <Han glyph="中" y={92} size={62} fill={ink.red} />
  ) : (
    <Han glyph="發" y={92} size={58} fill={ink.green} />
  );
}

// ─── Flowers & Joker ───────────────────────────────────────────────────────

// Eight different flower prints, one per physical flower tile.
const FLOWER_VARIANTS: readonly { petals: number; color: string }[] = [
  { petals: 5, color: ink.red },
  { petals: 6, color: ink.blue },
  { petals: 8, color: ink.red },
  { petals: 4, color: ink.blue },
  { petals: 6, color: ink.red },
  { petals: 5, color: ink.blue },
  { petals: 4, color: ink.red },
  { petals: 8, color: ink.blue },
];

function Flower({ copy }: { copy: number }) {
  const { petals, color } = FLOWER_VARIANTS[((copy % 8) + 8) % 8];
  const fx = CX;
  const fy = 58;
  const rx = petals >= 8 ? 5.5 : petals === 4 ? 9.5 : 7.5;
  return (
    <G>
      <Path d={`M${fx} ${fy + 12} Q${fx - 6} 94 ${fx} 116`} stroke={ink.green} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Ellipse cx={41} cy={98} rx={4.5} ry={11} transform={rotate(-50, 41, 98)} fill={ink.green} />
      <Ellipse cx={58} cy={103} rx={4} ry={10} transform={rotate(48, 58, 103)} fill={ink.green} />
      {Array.from({ length: petals }, (_, i) => (
        <Ellipse
          key={i}
          cx={fx}
          cy={fy - 13}
          rx={rx}
          ry={14}
          transform={rotate((i * 360) / petals, fx, fy)}
          fill={color}
        />
      ))}
      <Circle cx={fx} cy={fy} r={7.5} fill={ink.gold} />
      <Circle cx={fx} cy={fy} r={3} fill={ink.faceLight} />
    </G>
  );
}

function Star({ x, y, outer, inner, fill }: { x: number; y: number; outer: number; inner: number; fill: string }) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    return `${(x + Math.cos(a) * r).toFixed(2)} ${(y + Math.sin(a) * r).toFixed(2)}`;
  });
  return <Path d={`M${points.join(' L')} Z`} fill={fill} />;
}

function Joker() {
  return (
    <G>
      <Rect x={9} y={8} width={82} height={110} rx={7} stroke={ink.gold} strokeWidth={1.6} fill="none" />
      <Rect x={12.5} y={11.5} width={75} height={103} rx={5} stroke={ink.gold} strokeWidth={0.8} fill="none" />
      <Star x={CX} y={44} outer={18} inner={5} fill={ink.red} />
      <Star x={CX} y={44} outer={8} inner={2.5} fill={ink.gold} />
      <Circle cx={CX - 16} cy={30} r={2.4} fill={ink.gold} />
      <Circle cx={CX + 16} cy={30} r={2.4} fill={ink.gold} />
      <SvgText x={CX} y={85} fontSize={17} fontFamily={fontFamilies.serif} fill={ink.red} textAnchor="middle" letterSpacing={0.5}>
        JOKER
      </SvgText>
      <Path d="M30 98 Q40 93 50 98 Q60 103 70 98" stroke={ink.green} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Star x={CX} y={106} outer={4.5} inner={1.6} fill={ink.gold} />
    </G>
  );
}

function SuitArt({ suit, rank }: { suit: Suit; rank: Rank }) {
  switch (suit) {
    case 'bam':
      return <Bams rank={rank} />;
    case 'crak':
      return <Craks rank={rank} />;
    case 'dot':
      return <Dots rank={rank} />;
  }
}

function Art({ kind, copy }: { kind: TileKind; copy: number }) {
  switch (kind.type) {
    case 'suited':
      return (
        <>
          <Index label={String(kind.rank)} />
          <SuitArt suit={kind.suit} rank={kind.rank} />
        </>
      );
    case 'wind':
      return (
        <>
          <Index label={kind.wind} />
          <Han glyph={WIND_GLYPHS[kind.wind]} y={96} size={56} fill={ink.ink} />
        </>
      );
    case 'dragon':
      return <DragonArt dragon={kind.dragon} />;
    case 'flower':
      return <Flower copy={copy} />;
    case 'joker':
      return <Joker />;
  }
}

export type TileFaceProps = {
  kind: TileKind;
  /** Which physical copy; only changes the art for flowers (0–7). */
  copy?: number;
  width: number;
  height: number;
};

let nextGradientUid = 0;
const subscribeNever = () => () => {};

/**
 * Suffix for this tile's gradient ids. Inline SVGs on web share one id
 * namespace, so with fixed ids every tile would resolve `url(#…)` to the
 * first tile's <defs> and lose its fills if that tile is hidden or unmounted.
 * While hydrating static HTML the plain ids are kept so markup matches
 * (useId differs between Expo's server and client trees); React then
 * re-renders with each tile's own suffix.
 */
export function useGradientUid(): string {
  const [uid] = useState(() => `-${++nextGradientUid}`);
  return useSyncExternalStore(subscribeNever, () => uid, () => '');
}

/**
 * The static, code-drawn picture of a tile. Purely decorative: the
 * interactive `<Tile>` wrapper owns the accessibility label.
 */
export const TileFace = memo(function TileFace({ kind, copy = 0, width, height }: TileFaceProps) {
  const uid = useGradientUid();
  const backId = `tileBack${uid}`;
  const edgeId = `tileEdge${uid}`;
  const faceId = `tileFace${uid}`;
  return (
    <Svg
      width={width}
      height={height}
      viewBox={`0 0 ${TILE_VIEWBOX.width} ${TILE_VIEWBOX.height}`}
    >
      <Defs>
        <LinearGradient id={backId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink.backLight} />
          <Stop offset="1" stopColor={ink.back} />
        </LinearGradient>
        <LinearGradient id={edgeId}x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink.edgeLight} />
          <Stop offset="0.82" stopColor={ink.edge} />
          <Stop offset="1" stopColor={ink.edgeShade} />
        </LinearGradient>
        <LinearGradient id={faceId}x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ink.faceLight} />
          <Stop offset="0.55" stopColor={ink.face} />
          <Stop offset="1" stopColor={ink.faceShade} />
        </LinearGradient>
      </Defs>
      {/* Jade back layer, ivory body, then the face with a soft bevel. */}
      <Rect x={0} y={6} width={100} height={134} rx={14} fill={`url(#${backId})`} />
      <Rect x={0} y={0} width={100} height={131} rx={14} fill={`url(#${edgeId})`} />
      <Rect x={3} y={2} width={94} height={122} rx={11} fill={`url(#${faceId})`} />
      <Rect x={4} y={3} width={92} height={120} rx={10} fill="none" stroke="#FFFFFF" strokeOpacity={0.75} strokeWidth={1.4} />
      <Rect x={3} y={2} width={94} height={122} rx={11} fill="none" stroke={ink.edgeShade} strokeOpacity={0.45} strokeWidth={0.8} />
      <Art kind={kind} copy={copy} />
    </Svg>
  );
});
