import { StyleSheet, Text, View } from 'react-native';

// Temporary home screen. M0.2 (design system) and M0.6 (navigation shell) replace it.
export default function Home() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        Mah Jongg Coach
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F3D33',
  },
  title: {
    color: '#F7F1E3',
    fontSize: 28,
    fontWeight: '600',
  },
});
