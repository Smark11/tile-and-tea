import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { lessonById } from '@/game/lessons';
import { useLessonProgressHydrated } from '@/state/lessonProgress';
import { spacing, useTheme } from '@/theme';

import { LessonPlayer } from './LessonPlayer';

/** The /lesson/[id] screen: finds the lesson, waits for saved progress, then plays it. */
export function LessonScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const hydrated = useLessonProgressHydrated();
  const lesson = lessonById(id);

  if (!lesson) {
    return (
      <Screen>
        <View style={styles.missing}>
          <Text variant="eyebrow">Lessons</Text>
          <Text variant="title1">We couldn’t find that lesson</Text>
          <Text color="textMuted">It may have moved. Your other lessons are right where you left them.</Text>
          <Button title="Back to lessons" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }
  // Wait for saved progress so the lesson resumes in the right place.
  if (!hydrated) return <View style={[styles.fill, { backgroundColor: colors.background }]} />;
  // Keyed so moving between lessons starts a fresh session.
  return <LessonPlayer key={lesson.id} lesson={lesson} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  missing: { gap: spacing.lg, paddingTop: spacing.xxl },
});
