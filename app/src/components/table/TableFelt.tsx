import { memo, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  LayoutAnimationConfig,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { Tile, tileDimensions } from '@/components/tile/Tile';
import { acrossFrom, leftOf, rightOf, SEAT_WINDS, type GameState, type PlayerState, type Seat } from '@/game/engine';
import { tileCount } from '@/game/drills/content/words';
import {
  DRAW_ORDER,
  positionOf,
  SEAT_NAMES,
  seatLabel,
  wallLayout,
  WALL_STACKS,
  type SeatPosition,
} from '@/game/table';
import type { Tile as TileModel } from '@/game/tiles';
import { feltTones, palette, radii, spacing, tileInks, useTheme } from '@/theme';

/** The seat whose turn it is, if anyone's. */
export function activeSeat(state: GameState): Seat | null {
  return state.phase.type === 'turn' ? state.phase.seat : null;
}

// ---- Seats ------------------------------------------------------------------

const PULSE_MS = 1100;

/** The seat's wind on an ivory disc. A gold ring and soft glow pulse while it's their turn. */
export function WindDisc({ seat, active, size = 36 }: { seat: Seat; active: boolean; size?: number }) {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    if (!active) {
      glow.set(withTiming(0, { duration: 200 }));
      return;
    }
    if (reduceMotion) {
      glow.set(1);
      return;
    }
    const ease = { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) };
    glow.set(withRepeat(withSequence(withTiming(1, ease), withTiming(0.35, ease)), -1));
    return () => cancelAnimation(glow);
  }, [active, reduceMotion, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.discGlow,
          {
            borderRadius: size / 2,
            boxShadow: `0px 0px 14px 3px ${palette.gold}`,
          },
          glowStyle,
        ]}
      />
      <View
        style={[
          styles.disc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: active ? palette.gold : tileInks.edge,
            borderWidth: active ? 2.5 : 1,
          },
        ]}
      >
        <Text style={[styles.discLetter, { fontSize: size * 0.5, lineHeight: size * 0.62 }]}>{SEAT_WINDS[seat]}</Text>
      </View>
    </View>
  );
}

/** A small stack of jade tile backs with the count of concealed tiles. */
function HandCount({ count }: { count: number }) {
  return (
    <View style={styles.handCount}>
      <View style={styles.backs}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.back, { left: i * 4 }]} />
        ))}
      </View>
      <Text variant="caption" color="onFelt" style={styles.countText}>
        {count}
      </Text>
    </View>
  );
}

/** Exposure tile widths: phone, and a roomier desktop table. */
const CHIP_TILE = 32;
const CHIP_TILE_WIDE = 36;
const WIDE_FELT = 700;

const isJoker = (t: TileModel) => t.kind.type === 'joker';
// 13pt chip text reaches about 17pt at the cap, which still fits a side plaque.
const CHIP_TEXT_MAX_SCALE = 1.3;

/**
 * One exposure: the called tile's face, whole and uncovered, with the set's
 * size and any Jokers written beside it (below it on a side plaque). Every
 * American exposure is copies of one tile plus Jokers, so one face says it all.
 */
function ExposureChip({
  tiles,
  tileWidth,
  stacked,
}: {
  tiles: readonly TileModel[];
  tileWidth: number;
  /** Write the count under the tile (narrow side plaques) rather than beside it. */
  stacked: boolean;
}) {
  const jokers = tiles.filter(isJoker).length;
  const face = tiles.find((t) => !isJoker(t)) ?? tiles[0];
  return (
    <View style={stacked ? styles.chipStacked : styles.chipBeside}>
      <View style={styles.chipTile}>
        <Tile kind={face.kind} copy={face.copy} width={tileWidth} />
      </View>
      {/* The seat's spoken label already gives the count and Jokers. */}
      <View style={stacked ? styles.chipNotesStacked : styles.chipNotes}>
        <Text color="onFelt" style={styles.chipCount} maxFontSizeMultiplier={CHIP_TEXT_MAX_SCALE}>
          ×{tiles.length}
        </Text>
        {jokers > 0 && (
          <View style={styles.jokerPill}>
            <Text style={styles.jokerText} maxFontSizeMultiplier={CHIP_TEXT_MAX_SCALE} numberOfLines={1}>
              {jokers} {jokers === 1 ? 'Joker' : 'Jokers'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type SeatPlaqueProps = {
  player: PlayerState;
  you: Seat;
  active: boolean;
  orientation: 'row' | 'column';
  chipTile: number;
};

/** An opponent's place at the table: wind, name, tiles in hand, exposures. One screen-reader stop. */
const SeatPlaque = memo(function SeatPlaque({ player, you, active, orientation, chipTile }: SeatPlaqueProps) {
  const column = orientation === 'column';
  return (
    <View
      accessible
      accessibilityLabel={seatLabel(player, you, active)}
      testID={`seat-${player.seat}`}
      style={[styles.plaque, column ? styles.plaqueColumn : styles.plaqueRow, active && styles.plaqueActive]}
    >
      <View style={column ? styles.identityColumn : styles.identityRow}>
        <WindDisc seat={player.seat} active={active} size={column ? 34 : 36} />
        <View style={column ? styles.centered : undefined}>
          <Text variant={column ? 'caption' : 'headline'} color="onFelt" numberOfLines={1}>
            {SEAT_NAMES[player.seat]}
          </Text>
          <HandCount count={player.rack.length} />
        </View>
      </View>
      {player.dead && (
        <Text variant="caption" color="onFeltMuted" align="center">
          Dead
        </Text>
      )}
      {player.exposures.length > 0 && (
        <View style={column ? styles.chipsColumn : styles.chipsRow}>
          {player.exposures.map((e, i) => (
            <ExposureChip key={i} tiles={e.tiles} tileWidth={chipTile} stacked={column} />
          ))}
        </View>
      )}
    </View>
  );
});

// ---- The wall ---------------------------------------------------------------

const WALL_THICKNESS = 13;
const STACK_GAP = 1.5;

/** Screen order of a wall's stacks: drawing runs clockwise, so right-to-left along the bottom. */
function screenOrder(heights: readonly number[], position: SeatPosition): { height: number; index: number }[] {
  const stacks = heights.map((height, index) => ({ height, index }));
  return position === 'bottom' || position === 'left' ? stacks.reverse() : stacks;
}

function Wall({
  heights,
  position,
  length,
  next,
}: {
  heights: readonly number[];
  position: SeatPosition;
  length: number;
  /** Index of the next stack to draw from, if it's in this wall. */
  next: number | null;
}) {
  const vertical = position === 'left' || position === 'right';
  const pitch = length / WALL_STACKS;
  return (
    <View
      style={[
        styles.wall,
        vertical ? styles.wallVertical : styles.wallHorizontal,
        {
          [position]: 0,
          [vertical ? 'top' : 'left']: WALL_THICKNESS,
          [vertical ? 'height' : 'width']: length,
        },
      ]}
    >
      {screenOrder(heights, position).map(({ height, index }) => (
        <View
          key={index}
          style={[
            styles.stack,
            vertical
              ? { height: pitch - STACK_GAP, width: WALL_THICKNESS }
              : { width: pitch - STACK_GAP, height: WALL_THICKNESS },
            height === 0 ? styles.stackGone : height === 1 ? styles.stackHalf : styles.stackFull,
            index === next && styles.stackNext,
          ]}
        />
      ))}
    </View>
  );
}

// ---- Discards ---------------------------------------------------------------

const PILE_GAP = 3;
const PILE_PADDING = WALL_THICKNESS + spacing.sm;

/** Discards slide in from the side of the table the thrower sits on. */
function enteringFrom(position: SeatPosition) {
  switch (position) {
    case 'bottom':
      return FadeInDown.springify().damping(18).stiffness(180);
    case 'top':
      return FadeInUp.springify().damping(18).stiffness(180);
    case 'left':
      return FadeInLeft.springify().damping(18).stiffness(180);
    case 'right':
      return FadeInRight.springify().damping(18).stiffness(180);
  }
}

const PILE_MIN_TILE = 20;
const PILE_MAX_TILE = 46;
const PILE_ROW_GAP = PILE_GAP + 2;

function pilePerRow(inner: number, tileWidth: number) {
  return Math.max(1, Math.floor((inner + PILE_GAP) / (tileWidth + PILE_GAP)));
}

export function pileHeightFor(count: number, inner: number, tileWidth: number) {
  const rows = Math.ceil(count / pilePerRow(inner, tileWidth));
  return rows * tileDimensions(tileWidth).height + Math.max(0, rows - 1) * PILE_ROW_GAP;
}

/**
 * The largest discard tile (so its corner index stays legible) that lets the
 * whole pile fit inside the walls, at least six to a row. Tiles shrink as the
 * pile grows, down to a floor; past that the table grows taller instead.
 */
export function pileTileWidth(count: number, innerWidth: number, innerHeight: number) {
  const widest = Math.min(PILE_MAX_TILE, Math.floor((innerWidth - 5 * PILE_GAP) / 6));
  for (let w = widest; w > PILE_MIN_TILE; w--) {
    if (pileHeightFor(count, innerWidth, w) <= innerHeight) return w;
  }
  return PILE_MIN_TILE;
}

type PileItem = { tile: TileModel; seat: Seat; onOffer: boolean };

function DiscardPile({
  state,
  you,
  width,
  tileWidth,
}: {
  state: GameState;
  you: Seat;
  width: number;
  tileWidth: number;
}) {
  const { phase } = state;
  const items: PileItem[] = state.discards.map((d) => ({
    tile: d.tile,
    seat: d.seat,
    onOffer: false,
  }));
  if (phase.type === 'calls') items.push({ tile: phase.tile, seat: phase.discarder, onOffer: true });
  const inner = width - 2 * PILE_PADDING;
  const perRow = pilePerRow(inner, tileWidth);
  const latest = items[items.length - 1];
  const label =
    items.length === 0
      ? 'No discards yet.'
      : `Discards: ${items.length}. Latest, ${tileCount(latest.tile.kind, 1)} from ${latest.seat === you ? 'you' : SEAT_NAMES[latest.seat]}${latest.onOffer ? ', still open to a call' : ''}.`;

  if (items.length === 0) {
    const playing = phase.type === 'turn' || phase.type === 'calls';
    return (
      <View accessible accessibilityLabel={label} style={styles.pileEmpty}>
        <Text variant="callout" color="onFeltMuted" align="center">
          {playing ? 'Discards land here' : 'The Charleston'}
        </Text>
        {!playing && (
          <Text variant="caption" color="onFeltMuted" align="center">
            Pass tiles to shape your hand.
          </Text>
        )}
      </View>
    );
  }
  return (
    <View
      accessible
      accessibilityLabel={label}
      testID="discard-pile"
      style={[styles.pile, { width: perRow * (tileWidth + PILE_GAP) - PILE_GAP }]}
    >
      <LayoutAnimationConfig skipEntering>
        {items.map((item) => (
          <Animated.View
            key={item.tile.id}
            entering={enteringFrom(positionOf(item.seat, you))}
            style={[item.onOffer && styles.onOffer, item === latest && !item.onOffer && styles.latest]}
          >
            <Tile kind={item.tile.kind} copy={item.tile.copy} width={tileWidth} />
          </Animated.View>
        ))}
      </LayoutAnimationConfig>
    </View>
  );
}

// ---- The table --------------------------------------------------------------

/**
 * The jade felt between the four players: the across seat on top, the left and
 * right seats at the sides, and in the middle the four walls standing around
 * the discards. The player's own place (rack and exposures) sits below it.
 */
export function TableFelt({
  state,
  you,
  maxHeight,
}: {
  state: GameState;
  you: Seat;
  /** Cap on the felt's total height, so the player's rack stays on screen. The center keeps at least 2:5. */
  maxHeight?: number;
}) {
  const { colors } = useTheme();
  const [slot, setSlot] = useState({ width: 0, height: 0 });
  const [felt, setFelt] = useState({ width: 0, height: 0 });
  const feltHeight = felt.height;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setSlot({ width: Math.floor(w), height: Math.round(h) });
  };
  const onFeltLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setFelt({ width: Math.round(w), height: Math.round(h) });
  };
  const chipTile = felt.width >= WIDE_FELT ? CHIP_TILE_WIDE : CHIP_TILE;
  const { width } = slot;
  const active = activeSeat(state);
  const layout = wallLayout(state.wall.length);
  const nextWall = DRAW_ORDER.find((s) => layout[s].some((h) => h > 0));
  const nextStack = nextWall === undefined ? -1 : layout[nextWall].findIndex((h) => h > 0);

  // With a height to fill (the full-screen table), the center takes it all,
  // from 2:7 on a short screen (a wide desktop table with the call panel
  // open) up to 13:10 on a tall phone, so the felt and rack fill the screen
  // with no dead space below. Embedded, it's 4:5. Either
  // way it grows if the discards outgrow it at the smallest tile.
  // The felt's chrome (seats, padding) is its measured height minus the center's.
  const ideal = Math.round(width * 0.8);
  const chrome = slot.height > 0 && feltHeight > slot.height ? feltHeight - slot.height : 0;
  const target =
    maxHeight !== undefined && chrome > 0
      ? Math.max(Math.round(width * 0.28), Math.min(Math.round(width * 1.3), maxHeight - chrome))
      : ideal;
  const inner = width - 2 * PILE_PADDING;
  const count = state.discards.length + (state.phase.type === 'calls' ? 1 : 0);
  const tileWidth = pileTileWidth(count, inner, target - 2 * PILE_PADDING);
  const height = Math.max(target, pileHeightFor(count, inner, tileWidth) + 2 * PILE_PADDING);

  const seat = (s: Seat, orientation: 'row' | 'column') => (
    <SeatPlaque
      player={state.players[s]}
      you={you}
      active={active === s}
      orientation={orientation}
      chipTile={chipTile}
    />
  );

  return (
    <View
      testID="table-felt"
      onLayout={onFeltLayout}
      style={[styles.felt, { backgroundColor: colors.felt, borderColor: colors.feltInlay }]}
    >
      {seat(acrossFrom(you), 'row')}
      <View style={styles.middle}>
        {seat(leftOf(you), 'column')}
        <View style={styles.centerSlot} onLayout={onLayout}>
          {width > 0 && (
            <View
              style={[styles.center, { height }]}
              accessible
              accessibilityLabel={`The wall: ${state.wall.length} ${state.wall.length === 1 ? 'tile' : 'tiles'} left to draw.`}
            >
              {DRAW_ORDER.map((s) => {
                const position = positionOf(s, you);
                const vertical = position === 'left' || position === 'right';
                return (
                  <Wall
                    key={s}
                    heights={layout[s]}
                    position={position}
                    length={(vertical ? height : width) - 2 * WALL_THICKNESS}
                    next={s === nextWall ? nextStack : null}
                  />
                );
              })}
            </View>
          )}
          {width > 0 && (
            <View style={[styles.pileArea, { height, padding: PILE_PADDING }]}>
              <DiscardPile state={state} you={you} width={width} tileWidth={tileWidth} />
            </View>
          )}
        </View>
        {seat(rightOf(you), 'column')}
      </View>
    </View>
  );
}

const SIDE_WIDTH = 64;

const styles = StyleSheet.create({
  felt: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.sm,
    boxShadow: 'inset 0px 2px 12px rgba(0, 0, 0, 0.35), 0px 10px 28px rgba(8, 28, 22, 0.35)',
  },
  middle: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  centerSlot: { flex: 1 },
  center: { position: 'relative' },
  pileArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
  },

  plaque: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: feltTones.plaqueEdge,
    backgroundColor: feltTones.plaqueShade,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  plaqueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
  },
  plaqueColumn: {
    width: SIDE_WIDTH,
    alignItems: 'center',
    paddingHorizontal: spacing.xxs,
  },
  plaqueActive: {
    borderColor: feltTones.activeEdge,
    backgroundColor: feltTones.activeWash,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  identityColumn: { alignItems: 'center', gap: spacing.xs },
  centered: { alignItems: 'center' },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    flexShrink: 1,
  },
  chipsColumn: { alignItems: 'center', gap: spacing.md },

  disc: {
    backgroundColor: tileInks.face,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.35)',
  },
  discGlow: { backgroundColor: 'transparent' },
  discLetter: {
    fontFamily: 'Fraunces_600SemiBold',
    color: tileInks.ink,
    textAlign: 'center',
  },

  handCount: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backs: { width: 18, height: 14 },
  back: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 14,
    borderRadius: 2,
    backgroundColor: tileInks.backLight,
    borderBottomWidth: 2,
    borderBottomColor: tileInks.edge,
    boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.35)',
  },
  countText: { fontVariant: ['tabular-nums'] },

  chipBeside: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  chipStacked: { alignItems: 'center', gap: spacing.xxs },
  chipTile: { borderRadius: 4, boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.3)' },
  chipNotes: { alignItems: 'flex-start', gap: 2 },
  chipNotesStacked: { alignItems: 'center', gap: 2 },
  chipCount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    lineHeight: 17,
    fontVariant: ['tabular-nums'],
  },
  jokerPill: {
    borderRadius: 999,
    paddingHorizontal: 5,
    backgroundColor: palette.lacquerRed,
  },
  jokerText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    color: palette.ivory,
  },

  wall: { position: 'absolute', justifyContent: 'space-between' },
  wallHorizontal: { flexDirection: 'row', height: WALL_THICKNESS },
  wallVertical: { flexDirection: 'column', width: WALL_THICKNESS },
  stack: { borderRadius: 2 },
  stackFull: {
    backgroundColor: tileInks.backLight,
    borderBottomWidth: 3,
    borderBottomColor: tileInks.edge,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.4)',
  },
  stackHalf: {
    backgroundColor: tileInks.back,
    borderBottomWidth: 1.5,
    borderBottomColor: tileInks.edgeShade,
    boxShadow: '0px 1px 1px rgba(0, 0, 0, 0.3)',
  },
  // Where dealt stacks stood: a faint hairline, just enough to see the wall shrink.
  stackGone: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: feltTones.emptyStack,
  },
  stackNext: { borderColor: palette.gold, borderWidth: 1.5 },

  pile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: PILE_GAP,
    rowGap: PILE_ROW_GAP,
    alignSelf: 'center',
  },
  pileEmpty: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  onOffer: {
    borderRadius: 6,
    boxShadow: `0px 0px 0px 2px ${palette.gold}, 0px 0px 12px 2px ${feltTones.goldGlow}`,
  },
  latest: {
    borderRadius: 6,
    boxShadow: `0px 0px 0px 1.5px ${feltTones.goldHairline}`,
  },
});
