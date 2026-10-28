import { Redirect } from 'expo-router';

import { Styleguide } from '@/components/dev/Styleguide';

// Hidden developer route: not linked anywhere, and unavailable in release builds.
export default function StyleguideRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <Styleguide />;
}
