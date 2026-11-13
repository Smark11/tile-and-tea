import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Children, Fragment, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Text } from '@/components/Text';
import { CALL_WINDOWS, type CallWindow } from '@/game/table/calls';
import { usePreferences } from '@/state/preferences';
import { maxContentWidth, minTouchTarget, radii, spacing, useTheme } from '@/theme';

/** A labelled card of rows, with hairlines between them. */
function Group({ heading, children }: { heading: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text variant="eyebrow" accessibilityRole="header">
        {heading}
      </Text>
      <Card elevation="low" style={styles.groupCard}>
        {Children.toArray(children).map((child, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
            {child}
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function Row({ title, detail, trailing }: { title: string; detail: string; trailing?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text variant="headline">{title}</Text>
        <Text variant="caption">{detail}</Text>
      </View>
      {trailing}
    </View>
  );
}

/** A planned setting: listed so players know it's coming, but not a control. */
function UpcomingRow({ title, detail }: { title: string; detail: string }) {
  return (
    <View accessible accessibilityLabel={`${title}, coming soon. ${detail}`}>
      <Row title={title} detail={detail} />
    </View>
  );
}

const WINDOW_TITLES: Record<CallWindow, string> = { off: 'Off', relaxed: '12 s', standard: '7 s', brisk: '4 s' };
const WINDOW_LABELS: Record<CallWindow, string> = {
  off: 'Off: no time limit',
  relaxed: 'Relaxed: 12 seconds',
  standard: 'Standard: 7 seconds',
  brisk: 'Brisk: 4 seconds',
};

/** A row of pills, one per call window: a radio group. */
function CallWindowPicker({ value, onChange }: { value: CallWindow; onChange: (w: CallWindow) => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pills} accessibilityRole="radiogroup" accessibilityLabel="Time to call a discard">
      {CALL_WINDOWS.map((w) => {
        const on = w === value;
        return (
          <Pressable
            key={w}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={WINDOW_LABELS[w]}
            onPress={() => onChange(w)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              styles.pill,
              { borderColor: on ? colors.primary : colors.border },
              on && { backgroundColor: colors.primary },
              !on && (pressed || hovered) && { backgroundColor: colors.surfaceSunken },
            ]}
            testID={`settings-call-window-${w}`}
          >
            <Text variant="button" color={on ? 'onPrimary' : 'text'}>
              {WINDOW_TITLES[w]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The privacy page takes the sheet's place, so on iOS it doesn't open
// underneath the sheet, and its Back returns to the tab.
const openPrivacy = () => router.replace('/privacy');

/**
 * The settings sheet, opened from the button in each tab's header. Only
 * settings that work are switches; planned ones say "Coming soon".
 */
export function SettingsSheet() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const haptics = usePreferences((s) => s.haptics);
  const setHaptics = usePreferences((s) => s.setHaptics);
  const replayOnboarding = usePreferences((s) => s.replayOnboarding);
  const callWindow = usePreferences((s) => s.callWindow);
  const setCallWindow = usePreferences((s) => s.setCallWindow);
  const version = Constants.expoConfig?.version;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <Text variant="title1" style={styles.title}>
            Settings
          </Text>
          <Button title="Done" variant="quiet" onPress={() => router.back()} />
        </View>

        <Group heading="Feel">
          <Row
            title="Haptics"
            detail="A gentle tick when you touch and move tiles."
            trailing={
              <Switch
                accessibilityLabel="Haptics"
                accessibilityHint="A gentle tick when you touch and move tiles"
                value={haptics}
                onValueChange={setHaptics}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            }
          />
        </Group>

        <Group heading="At the table">
          <View style={styles.action}>
            <View style={styles.rowText}>
              <Text variant="headline">Time to call a discard</Text>
              <Text variant="caption">
                How long the table waits before letting a tile you could call go by. Turn it off to take all the time you
                need.
              </Text>
            </View>
            <CallWindowPicker value={callWindow} onChange={setCallWindow} />
          </View>
        </Group>

        <Group heading="Coming soon">
          <UpcomingRow title="Tile sounds" detail="Soft clacks as tiles land. Off unless you turn them on." />
          <UpcomingRow title="Large tiles" detail="Bigger tiles everywhere, for easier reading." />
          <UpcomingRow
            title="Tile & Tea Plus"
            detail="Every lesson, unlimited drills, and the post-game coach."
          />
        </Group>

        <Group heading="Help">
          <View style={styles.action}>
            <Text variant="caption">New here, or showing a friend? Take the three-page tour again.</Text>
            <Button title="Replay the welcome tour" variant="secondary" block onPress={replayOnboarding} />
          </View>
          <View style={styles.action}>
            <Text variant="caption">What we count to improve Tile & Tea, and what we never collect.</Text>
            <Button title="Read our privacy page" variant="secondary" block onPress={openPrivacy} />
          </View>
        </Group>

        {version && (
          <Text variant="caption" align="center">
            Tile & Tea {version}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },
  column: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center', gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  group: { gap: spacing.sm },
  groupCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg, gap: 0 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchTarget + spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: spacing.xxs },
  action: { gap: spacing.md, paddingVertical: spacing.lg },
  pills: { flexDirection: 'row', gap: spacing.sm },
  pill: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderCurve: 'continuous',
  },
});
