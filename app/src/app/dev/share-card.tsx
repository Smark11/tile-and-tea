import { Redirect } from 'expo-router';

import { ShareCardPreview } from '@/components/dev/ShareCardPreview';

// Hidden developer route that `npm run brand:share` captures as the link-preview
// image. Not linked anywhere, and unavailable in release builds.
export default function ShareCardRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <ShareCardPreview />;
}
