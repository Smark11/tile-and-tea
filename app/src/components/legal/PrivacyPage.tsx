import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Tile } from '@/components/tile/Tile';
import { radii, spacing, useTheme } from '@/theme';

/** Shown under the title; change it whenever the policy below changes. */
export const PRIVACY_UPDATED = 'November 2026';

const PROMISES = ['No cookies, no ads', 'Never sold or shared for marketing', 'Do Not Track is honored'];

type Section = { heading: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    heading: 'What we count',
    paragraphs: [
      'On the website, we count visits so we can see which pages help people and where they get stuck. A visit records the page you opened, the site that sent you here (and any campaign tags in the link), your browser and device type, and your approximate country.',
      'We also count a few moments in the app, like finishing the welcome tour, starting or finishing a lesson, answering a practice drill, and finishing a game. These record what happened, such as “drill answered, correct”, and nothing about who you are.',
    ],
  },
  {
    heading: 'What we never collect',
    paragraphs: [
      'No names, email addresses, contacts, or precise location. Nothing you type. No screen recordings, and no tracking of what you do on other sites.',
    ],
  },
  {
    heading: 'No cookies, and you can opt out',
    paragraphs: [
      'Tile & Tea doesn’t set cookies or store an analytics ID on your device. Each visit is counted as a fresh, anonymous visitor, and nothing links one visit to the next.',
      'If your browser sends Do Not Track or Global Privacy Control, we don’t count anything at all. The app works exactly the same either way.',
    ],
  },
  {
    heading: 'Who helps us',
    paragraphs: [
      'Visit counts are processed by PostHog, an analytics service, on our behalf. They are kept only to improve Tile & Tea, and are never sold or used for advertising. We ask PostHog not to keep your internet address after estimating your country.',
    ],
  },
  {
    heading: 'Your progress stays with you',
    paragraphs: [
      'Your settings and progress are saved on this device only. Clearing your browser’s site data, or deleting the app, removes them.',
    ],
  },
];

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** The plain-English privacy page at /privacy. */
export function PrivacyPage() {
  const { colors } = useTheme();
  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titles}>
          <Text variant="eyebrow">Privacy</Text>
          <Text variant="title1">Your privacy, plainly</Text>
          <Text variant="caption">Updated {PRIVACY_UPDATED}</Text>
        </View>
        <Button title="Back" variant="quiet" onPress={goBack} />
      </View>

      <Card tone="felt" elevation="high" style={styles.hero}>
        <View style={styles.heroTop}>
          <Tile kind={{ type: 'flower' }} copy={2} size="M" />
          <Text variant="callout" color="onFelt" style={styles.heroLine}>
            We count visits to make Tile & Tea better. We don’t follow you.
          </Text>
        </View>
        <View style={[styles.rule, { backgroundColor: colors.feltInlay }]} />
        <View accessibilityRole="list" style={styles.promises}>
          {PROMISES.map((promise) => (
            <View key={promise} style={styles.promise}>
              <View style={[styles.dot, { backgroundColor: colors.gold }]} />
              <Text variant="headline" color="onFelt" style={styles.flex}>
                {promise}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {SECTIONS.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text variant="title3">{section.heading}</Text>
          {section.paragraphs.map((p) => (
            <Text key={p.slice(0, 32)}>{p}</Text>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.xs },
  titles: { flex: 1, gap: spacing.xs },
  hero: { gap: spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroLine: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth * 2 },
  promises: { gap: spacing.md },
  // The dot sits on the first line (headline line height 24), even when the text wraps.
  promise: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  dot: { width: 8, height: 8, borderRadius: radii.pill, marginTop: 8 },
  flex: { flex: 1 },
  section: { gap: spacing.sm, marginTop: spacing.sm },
});
