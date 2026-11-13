import { router } from 'expo-router';

/** Leave a lesson: back where the player came from, or to the lesson path. */
export function leaveLesson() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
