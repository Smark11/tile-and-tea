import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useScreenTracking } from '@/analytics';
import { RouteHead } from '@/components/shell/RouteHead';
import { usePreferences, usePreferencesHydrated } from '@/state/preferences';
import { radii, useTheme } from '@/theme';
import { fontAssets } from '@/theme/fonts';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const preferencesLoaded = usePreferencesHydrated();
  const onboarded = usePreferences((s) => s.onboarded);
  useScreenTracking();
  const ready = (fontsLoaded || fontError !== null) && preferencesLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Hold the splash until fonts are in, so text never reflows from the system
  // face, and until saved preferences load, so a returning player never sees
  // the welcome pages flash. If fonts fail, system fonts stand in. The page's
  // head tags don't wait, so static export still writes them into the HTML.
  if (!ready) return <RouteHead />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <RouteHead />
      <StatusBar style="auto" />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}
      >
        {/* Exactly one of these groups is reachable. Finishing or replaying the
            welcome tour flips `onboarded`, and the router moves to the other.
            Each group names where its unreachable screens send people: without
            `redirectTo`, the router falls back to the first unguarded screen,
            which put first-time visitors on the privacy page. */}
        <Stack.Protected guard={!onboarded} redirectTo="/">
          <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={onboarded} redirectTo="/welcome">
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="drill/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="scenario/[id]" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="card" />
          <Stack.Screen name="game" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen
            name="settings"
            options={{
              presentation: 'formSheet',
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.92],
              sheetCornerRadius: radii.xl,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </Stack.Protected>
        {/* Open to everyone, onboarded or not, so a shared link always works. */}
        <Stack.Screen name="privacy" />
        <Stack.Screen name="dev/styleguide" />
      </Stack>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
