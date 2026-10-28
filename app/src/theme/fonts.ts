// Per-weight imports keep the bundle to the faces we actually use.
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';

import type { fontFamilies } from './tokens';

/** Font map for `useFonts`, keyed by the family names in `fontFamilies`. */
export const fontAssets: Record<(typeof fontFamilies)[keyof typeof fontFamilies], number> = {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
};
