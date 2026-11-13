import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import type { TileKind } from '@/game/tiles';
import { brandColors } from '@/brand/tileMark';
import { fontFamilies, palette } from '@/theme';
import { SHARE_IMAGE } from '@/web/siteMeta';

const { width: CARD_W, height: CARD_H } = SHARE_IMAGE;

/** The fanned hand, left to right. A spread of every family reads as "mahjong" at a glance. */
const FAN: readonly { kind: TileKind; copy?: number }[] = [
  { kind: { type: 'suited', suit: 'crak', rank: 8 } },
  { kind: { type: 'suited', suit: 'bam', rank: 1 } },
  { kind: { type: 'joker' } },
  { kind: { type: 'dragon', dragon: 'red' } },
  { kind: { type: 'flower' }, copy: 2 },
  { kind: { type: 'suited', suit: 'dot', rank: 5 } },
];
const FAN_TILE_W = 120;
/** Degrees between neighbouring tiles. */
const FAN_STEP = 8;
/** How far tiles drop toward the ends of the arc, per step squared. */
const FAN_SAG = 7;
const FAN_SPACING = 84;

/**
 * The 1200×630 link-preview image (Open Graph / Twitter card): real tiles
 * fanned on jade felt beside the name and promise. `npm run brand:share`
 * captures it to public/og-image.png. On the dev route it's scaled down to
 * fit the screen so it can be checked on a phone.
 */
export function ShareCard() {
  const [scale, setScale] = useState(1);
  const onLayout = (e: LayoutChangeEvent) =>
    setScale(Math.min(1, e.nativeEvent.layout.width / CARD_W));

  return (
    <View style={styles.frame} onLayout={onLayout}>
      <View style={{ width: CARD_W * scale, height: CARD_H * scale }}>
        <View
          testID="share-card"
          accessible
          accessibilityRole="image"
          accessibilityLabel={SHARE_IMAGE.alt}
          style={[styles.card, { transform: [{ scale }] }]}
        >
          <Felt />
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>{'Tile & Tea'}</Text>
            <Text style={styles.headline}>{'Learn American\nMah Jongg'}</Text>
            <View style={styles.rule} />
            <Text style={styles.sub}>
              {'Gentle lessons, friendly drills\nand a patient coach, at your own pace.'}
            </Text>
          </View>
          <View style={styles.fan}>
            {FAN.map(({ kind, copy }, i) => {
              const offset = i - (FAN.length - 1) / 2;
              return (
                <View
                  key={i}
                  style={[
                    styles.fanTile,
                    {
                      left: offset * FAN_SPACING - FAN_TILE_W / 2,
                      top: offset * offset * FAN_SAG,
                      transform: [{ rotate: `${offset * FAN_STEP}deg` }],
                    },
                  ]}
                >
                  <Tile kind={kind} copy={copy} width={FAN_TILE_W} />
                </View>
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

/** Lit jade felt with a darker rim, like a lamp over the game table, and a gold inlay line. */
function Felt() {
  return (
    <Svg style={StyleSheet.absoluteFill} width={CARD_W} height={CARD_H} viewBox={`0 0 ${CARD_W} ${CARD_H}`}>
      <Defs>
        <RadialGradient id="shareFelt" cx="64%" cy="44%" rx="70%" ry="95%">
          <Stop offset="0" stopColor={brandColors.leafLight} stopOpacity="0.55" />
          <Stop offset="0.45" stopColor={brandColors.feltLight} />
          <Stop offset="1" stopColor={palette.jadeFelt} />
        </RadialGradient>
        <RadialGradient id="shareRim" cx="50%" cy="50%" rx="75%" ry="85%">
          <Stop offset="0.6" stopColor="#04140F" stopOpacity="0" />
          <Stop offset="1" stopColor="#04140F" stopOpacity="0.55" />
        </RadialGradient>
      </Defs>
      <Rect width={CARD_W} height={CARD_H} fill={palette.jadeFelt} />
      <Rect width={CARD_W} height={CARD_H} fill="url(#shareFelt)" />
      <Rect width={CARD_W} height={CARD_H} fill="url(#shareRim)" />
      <Rect
        x={22}
        y={22}
        width={CARD_W - 44}
        height={CARD_H - 44}
        rx={22}
        fill="none"
        stroke={palette.gold}
        strokeOpacity={0.55}
        strokeWidth={1.5}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  frame: { width: '100%', alignItems: 'center' },
  card: {
    width: CARD_W,
    height: CARD_H,
    overflow: 'hidden',
    transformOrigin: 'top left',
  },
  copy: { position: 'absolute', left: 92, top: 0, bottom: 0, width: 520, justifyContent: 'center' },
  eyebrow: {
    fontFamily: fontFamilies.sansSemiBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: 4,
    textTransform: 'uppercase',
    color: palette.gold,
    marginBottom: 22,
  },
  headline: {
    fontFamily: fontFamilies.serif,
    fontSize: 78,
    lineHeight: 84,
    letterSpacing: -1.2,
    color: palette.ivory,
  },
  rule: { width: 72, height: 3, borderRadius: 2, backgroundColor: palette.gold, marginVertical: 30 },
  sub: {
    fontFamily: fontFamilies.sans,
    fontSize: 27,
    lineHeight: 40,
    color: palette.ivory,
    opacity: 0.86,
  },
  fan: { position: 'absolute', left: 836, top: 222, width: 0, height: 0 },
  fanTile: { position: 'absolute', transformOrigin: '50% 120%' },
});
