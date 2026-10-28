import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';

// Temporary home screen. M0.6 (navigation shell) replaces it.
export default function Home() {
  return (
    <Screen scroll={false} tone="felt" contentStyle={{ justifyContent: 'center' }}>
      <Text variant="title1" color="onFelt" align="center">
        Mah Jongg Coach
      </Text>
    </Screen>
  );
}
