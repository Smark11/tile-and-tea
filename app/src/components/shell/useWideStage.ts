import { useEffect } from 'react';
import { Platform } from 'react-native';

import { WIDE_STAGE_ATTR } from './webStage';

/**
 * While mounted, widens the web stage's column (webStage.ts) so a screen that
 * benefits from room, like the game table, can grow on desktop. Phones and
 * native apps are unaffected.
 */
export function useWideStage() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.setAttribute(WIDE_STAGE_ATTR, '');
    return () => document.body.removeAttribute(WIDE_STAGE_ATTR);
  }, []);
}
