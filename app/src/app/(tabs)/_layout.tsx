import { Tabs } from 'expo-router';
import { useReducedMotion } from 'react-native-reanimated';

import { TabBar } from '@/components/shell/TabBar';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'none' : 'fade',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Learn' }} />
      <Tabs.Screen name="train" options={{ title: 'Train' }} />
      <Tabs.Screen name="play" options={{ title: 'Play' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
    </Tabs>
  );
}
