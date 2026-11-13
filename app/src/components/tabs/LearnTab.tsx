import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { PracticeCardLink } from '@/components/card/PracticeCardLink';
import { hapticSuccess } from '@/components/haptics';
import { LessonPath } from '@/components/lesson/path/LessonPath';
import { TabScreen } from '@/components/shell/TabScreen';
import { Text } from '@/components/Text';
import { buildLessonPath, celebrationAnnouncement, LESSONS, pathHeadline } from '@/game/lessons';
import { useLessonProgress } from '@/state/lessonProgress';
import { spacing } from '@/theme';

export function LearnTab() {
  const completed = useLessonProgress((s) => s.completed);
  const inProgress = useLessonProgress((s) => s.inProgress);
  const nodes = useMemo(() => buildLessonPath({ completed, inProgress }, LESSONS), [completed, inProgress]);
  const [celebrating, setCelebrating] = useState<string | null>(null);

  // A lesson finished for the first time gets its celebration when the path
  // comes back into view (not behind the lesson screen, where nobody sees it).
  useFocusEffect(
    useCallback(() => {
      const id = useLessonProgress.getState().takeCelebration();
      // Coming back later settles the path (and its headline) again.
      setCelebrating(id);
      if (!id) return;
      hapticSuccess();
      const path = buildLessonPath(useLessonProgress.getState(), LESSONS);
      AccessibilityInfo.announceForAccessibility(celebrationAnnouncement(path, id));
    }, []),
  );

  const headline = celebrating ? celebrationAnnouncement(nodes, celebrating) : pathHeadline(nodes);
  return (
    <TabScreen eyebrow="Learn" title="Your lesson path">
      <View style={styles.intro}>
        <Text color="textMuted">{headline}</Text>
      </View>
      <LessonPath
        nodes={nodes}
        celebrating={celebrating}
        onOpen={(id) => router.push({ pathname: '/lesson/[id]', params: { id } })}
      />
      <View style={styles.card}>
        <PracticeCardLink />
      </View>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  intro: { marginTop: spacing.xs },
  card: { marginTop: spacing.lg },
});
