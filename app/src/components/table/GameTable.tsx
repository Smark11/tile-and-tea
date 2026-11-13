import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { CloseButton } from '@/components/lesson/LessonPlayer';
import { LEVEL_INFO } from '@/components/play/levels';
import { Rack } from '@/components/rack/Rack';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { DEFAULT_LEVEL, type BotLevel } from '@/game/bots';
import { PASS_SIZE, type GameAction, type GameState, type Seat } from '@/game/engine';
import {
  CALL_WINDOW_MS,
  callChoices,
  canDeclareMahJongg,
  exposureLabel,
  resultSummary,
  SEAT_NAMES,
  swapOptions,
  tablePrompt,
} from '@/game/table';
import { tileName, type Tile as TileModel } from '@/game/tiles';
import { usePreferences } from '@/state/preferences';
import { feltTones, maxContentWidth, maxTableWidth, palette, paletteAlpha, radii, spacing, useTheme } from '@/theme';

import { CallActions, SwapActions } from './CallPanel';
import { activeSeat, TableFelt, WindDisc } from './TableFelt';
import { useTableGame, type CallTimer } from './useTableGame';

const EMPTY: ReadonlySet<number> = new Set();

export type GameTableProps = {
  seed: number;
  /** The player's seat. East opens the play, so the player meets the table at once. */
  you?: Seat;
  initial?: GameState;
  autoplay?: boolean;
  /** How well the three computer players play. */
  level?: BotLevel;
  pace?: number;
  onLeave?: () => void;
  onNewGame?: () => void;
  /** Fill the screen with its own scroller (default). Off to embed the table in another page. */
  scroll?: boolean;
};

/** What the player's next move needs from the rack: how many tiles to pick, and whether Jokers can go. */
function selectionRule(
  state: GameState,
  you: Seat,
  yourMove: boolean,
): { limit: number; jokersLocked: boolean } | null {
  if (!yourMove) return null;
  const { phase } = state;
  if (phase.type === 'charleston') return { limit: PASS_SIZE, jokersLocked: true };
  if (phase.type === 'courtesy-pass') return { limit: phase.counts[you], jokersLocked: true };
  if (phase.type === 'turn' && phase.step === 'discard' && phase.seat === you) return { limit: 1, jokersLocked: false };
  return null;
}

/**
 * A game at the table: the felt with the other three players, then the
 * player's own place: what to do now, their exposures and their rack.
 */
export function GameTable({
  seed,
  you = 0,
  initial,
  autoplay = true,
  level = DEFAULT_LEVEL,
  pace,
  onLeave,
  onNewGame,
  scroll = true,
}: GameTableProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const callWindow = usePreferences((s) => s.callWindow);
  const game = useTableGame({ seed, you, initial, autoplay, pace, level, callWindowMs: CALL_WINDOW_MS[callWindow] });
  const { state, tiles, freshIds, selected, toggle, reorder, act, abandon, callTimer, hold, note } = game;
  const prompt = tablePrompt(state, you);
  const rule = selectionRule(state, you, prompt.yourMove);
  const player = state.players[you];

  const jokerIds = useMemo(
    () => (rule?.jokersLocked ? new Set(player.rack.filter((t) => t.kind.type === 'joker').map((t) => t.id)) : EMPTY),
    [rule?.jokersLocked, player.rack],
  );
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  const limit = rule?.limit ?? 0;
  const onToggle = useCallback((tile: TileModel) => toggle(tile, limit), [toggle, limit]);

  const leave = () => {
    abandon();
    onLeave?.();
  };

  // Fit the whole table on one screen: the felt gives up height (never the
  // rack) when the viewport is short. The header and the player's place
  // below the felt are measured on their own, so the felt's size never feeds
  // back into its cap. The cap only tightens while the viewport stays the
  // same size, so a button appearing in the panel never makes the table bob.
  const [viewport, setViewport] = useState(0);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [placeHeight, setPlaceHeight] = useState(0);
  const [feltCap, setFeltCap] = useState<{
    viewport: number;
    cap: number;
  } | null>(null);
  const padTop = insets.top + spacing.md;
  const padBottom = insets.bottom + spacing.lg;
  if (scroll && viewport > 0 && headerHeight > 0 && placeHeight > 0) {
    const cap = Math.floor(viewport - padTop - padBottom - headerHeight - placeHeight - 2 * spacing.md);
    if (!feltCap || feltCap.viewport !== viewport || cap < feltCap.cap) setFeltCap({ viewport, cap });
  }
  const heightOf = (set: (h: number) => void) => (e: LayoutChangeEvent) => set(Math.round(e.nativeEvent.layout.height));

  // Full screen, the table widens past the reading column so the felt and
  // discards grow on desktop; embedded, it keeps to its host's column.
  const content = (
    <View style={[styles.column, { maxWidth: scroll ? maxTableWidth : maxContentWidth }]}>
      <View style={styles.header} onLayout={heightOf(setHeaderHeight)}>
        <CloseButton label="Leave game" hint="This practice game isn’t saved." onPress={leave} onFelt />
        <View style={styles.headerTitle}>
          <Text variant="eyebrow" style={{ color: palette.gold }}>
            {`Practice table · ${LEVEL_INFO[level].name}`}
          </Text>
          <Text variant="caption" color="onFeltMuted">
            You’re {SEAT_NAMES[you]} · {state.wall.length} {state.wall.length === 1 ? 'tile' : 'tiles'} left in the wall
          </Text>
        </View>
      </View>

      <TableFelt state={state} you={you} maxHeight={scroll ? feltCap?.cap : undefined} />

      <View style={styles.place} onLayout={heightOf(setPlaceHeight)}>
        {state.phase.type === 'ended' ? (
          <ResultPanel state={state} you={you} onNewGame={onNewGame} onLeave={onLeave} />
        ) : (
          <View style={[styles.panel, prompt.yourMove && styles.panelYourMove]} testID="table-prompt">
            <View style={styles.promptRow}>
              <WindDisc seat={you} active={activeSeat(state) === you} size={40} />
              <View style={styles.promptText} accessibilityLiveRegion="polite">
                <Text variant="headline" color="onFelt">
                  {prompt.title}
                </Text>
                <Text color="onFeltMuted">{prompt.detail}</Text>
              </View>
            </View>
            {note && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.note} testID="table-call-note">
                <Text variant="caption" color="onFelt" accessibilityLiveRegion="polite">
                  {note}
                </Text>
              </Animated.View>
            )}
            <Actions
              state={state}
              you={you}
              selected={selected}
              tiles={tiles}
              act={act}
              callTimer={callTimer}
              onHold={hold}
            />
          </View>
        )}

        <Rack
          tiles={tiles}
          onReorder={reorder}
          onToggleSelect={rule ? onToggle : undefined}
          selectedIds={selectedIds}
          disabledIds={jokerIds}
          freshIds={freshIds}
          onFelt
          toolbarStart={
            player.exposures.length > 0 ? (
              <View
                style={styles.yourExposures}
                accessible
                accessibilityLabel={`Your exposures: ${player.exposures.map(exposureLabel).join('; ')}.`}
              >
                <Text variant="eyebrow" style={{ color: palette.gold }}>
                  Your exposures
                </Text>
                <View style={styles.exposureRow}>
                  {player.exposures.map((e, i) => (
                    <View key={i} style={styles.group}>
                      {e.tiles.map((t) => (
                        <Tile key={t.id} kind={t.kind} copy={t.copy} size="S" />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <Text variant="eyebrow" style={{ color: palette.gold }}>
                Your rack
              </Text>
            )
          }
          testID="table-rack"
        />
      </View>
    </View>
  );
  if (!scroll) {
    return (
      <View style={[styles.embedded, { backgroundColor: colors.felt }]} testID="game-table">
        {content}
      </View>
    );
  }
  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: colors.felt }]}
      onLayout={heightOf(setViewport)}
      contentContainerStyle={{
        paddingTop: padTop,
        paddingBottom: padBottom,
        paddingLeft: insets.left + spacing.md,
        paddingRight: insets.right + spacing.md,
      }}
      testID="game-table"
    >
      {content}
    </ScrollView>
  );
}

type ActionsProps = {
  state: GameState;
  you: Seat;
  selected: readonly number[];
  tiles: readonly TileModel[];
  act: (action: GameAction) => void;
  callTimer: CallTimer | null;
  onHold: () => void;
};

/** The buttons for the player's move, if the table is waiting on them. */
function Actions({ state, you, selected, tiles, act, callTimer, onHold }: ActionsProps) {
  const { phase } = state;
  const waiting = phase.type !== 'ended' && tablePrompt(state, you).yourMove;
  if (!waiting) return null;
  const seat = you;
  const row = (children: ReactNode) => (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.actions}>
      {children}
    </Animated.View>
  );

  switch (phase.type) {
    case 'charleston':
    case 'courtesy-pass': {
      const need = phase.type === 'charleston' ? PASS_SIZE : phase.counts[you];
      const ready = selected.length === need;
      return row(
        <Button
          title={ready ? `Pass ${need === 1 ? 'this tile' : `these ${need}`}` : `Choose ${need - selected.length} more`}
          variant="ivory"
          block
          disabled={!ready}
          testID="table-pass"
          onPress={() =>
            act(
              phase.type === 'charleston'
                ? { type: 'charlestonPass', seat, tiles: selected }
                : { type: 'courtesyPass', seat, tiles: selected },
            )
          }
        />,
      );
    }
    case 'charleston-vote':
      return row(
        <>
          <Button
            title="Second Charleston"
            variant="ivory"
            testID="table-vote-continue"
            onPress={() => act({ type: 'charlestonVote', seat, continueCharleston: true })}
          />
          <Button
            title="Stop here"
            variant="quietOnFelt"
            testID="table-vote-stop"
            onPress={() => act({ type: 'charlestonVote', seat, continueCharleston: false })}
          />
        </>,
      );
    case 'courtesy-offer':
      return row(
        [0, 1, 2, 3].map((count) => (
          <Button
            key={count}
            title={count === 0 ? 'None' : String(count)}
            accessibilityLabel={count === 0 ? 'Offer no tiles' : `Offer ${count} ${count === 1 ? 'tile' : 'tiles'}`}
            variant={count === 0 ? 'quietOnFelt' : 'ivory'}
            testID={`table-offer-${count}`}
            onPress={() => act({ type: 'courtesyOffer', seat, count })}
          />
        )),
      );
    case 'turn': {
      // The prompt above already says to choose a tile, so the discard button
      // only appears once there's one to throw.
      const pick = tiles.find((t) => t.id === selected[0]);
      const mahJongg = canDeclareMahJongg(state, you);
      const swaps = swapOptions(state, you);
      if (!pick && !mahJongg && swaps.length === 0) return null;
      return (
        <View style={styles.stack}>
          <SwapActions
            options={swaps}
            you={you}
            onSwap={(o) => act({ type: 'jokerSwap', seat, tile: o.tile.id, owner: o.owner, exposure: o.exposure })}
          />
          {(mahJongg || pick) &&
            row(
              <>
                {mahJongg && (
                  <Button
                    title="Declare Mah Jongg"
                    variant="ivory"
                    testID="table-mahjongg"
                    onPress={() => act({ type: 'declareMahJongg', seat })}
                  />
                )}
                {pick && (
                  <Button
                    title={`Discard ${tileName(pick.kind)}`}
                    variant="ivory"
                    testID="table-discard"
                    onPress={() => act({ type: 'discard', seat, tile: pick.id })}
                  />
                )}
              </>,
            )}
        </View>
      );
    }
    case 'calls':
      return (
        <CallActions
          choices={callChoices(state, you)}
          timer={callTimer}
          onHold={onHold}
          onMahJongg={() => act({ type: 'call', seat, claim: { type: 'mahJongg' } })}
          onExpose={(option) => act({ type: 'call', seat, claim: { type: 'expose', tiles: option.tiles } })}
          onPass={() => act({ type: 'pass', seat })}
        />
      );
  }
}

function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

function ResultPanel({
  state,
  you,
  onNewGame,
  onLeave,
}: {
  state: GameState;
  you: Seat;
  onNewGame?: () => void;
  onLeave?: () => void;
}) {
  if (state.phase.type !== 'ended') return null;
  const summary = resultSummary(state.phase.result, you);
  return (
    <Animated.View entering={FadeIn.duration(400)} style={[styles.panel, styles.panelYourMove]} testID="table-result">
      <Text variant="title2" color="onFelt" accessibilityLiveRegion="polite">
        {summary.title}
      </Text>
      <Text color="onFeltMuted">{summary.detail}</Text>
      {summary.payments.length > 0 && (
        <View style={styles.payments}>
          {summary.payments.map(({ seat, amount }) => (
            <View
              key={seat}
              style={styles.payment}
              accessible
              accessibilityLabel={`${seat === you ? 'You' : SEAT_NAMES[seat]}: ${amount >= 0 ? 'receive' : 'pay'} ${Math.abs(amount)}`}
            >
              <Text color="onFelt">{seat === you ? `You (${SEAT_NAMES[seat]})` : SEAT_NAMES[seat]}</Text>
              <Text variant="headline" color="onFelt" style={styles.amount}>
                {signed(amount)}
              </Text>
            </View>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        {onNewGame && <Button title="Deal again" variant="ivory" onPress={onNewGame} testID="table-new-game" />}
        {onLeave && <Button title="Back to Play" variant="quietOnFelt" onPress={onLeave} />}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  embedded: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderCurve: 'continuous',
  },
  column: {
    width: '100%',
    alignSelf: 'center',
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: { flex: 1 },
  panel: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: feltTones.panelEdge,
    backgroundColor: feltTones.panelShade,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelYourMove: { borderColor: feltTones.activeEdge },
  promptRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  promptText: { flex: 1, gap: spacing.xxs },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    alignItems: 'center',
  },
  place: { gap: spacing.md },
  stack: { gap: spacing.sm },
  note: {
    borderLeftWidth: 2,
    borderLeftColor: palette.gold,
    paddingLeft: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: paletteAlpha('gold', 0.08),
  },
  yourExposures: { gap: spacing.xs },
  exposureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  group: { flexDirection: 'row', gap: 2 },
  payments: { gap: spacing.xs },
  payment: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amount: { fontVariant: ['tabular-nums'] },
});
