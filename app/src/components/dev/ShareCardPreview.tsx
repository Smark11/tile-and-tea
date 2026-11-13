import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { spacing } from '@/theme';
import { SHARE_IMAGE } from '@/web/siteMeta';

import { ShareCard } from './ShareCard';

/**
 * `/dev/share-card`: the link-preview image, scaled to fit, with a note on
 * how to regenerate it. `?capture=1` renders the bare card at full size for
 * `npm run brand:share`.
 */
export function ShareCardPreview() {
  const { capture } = useLocalSearchParams<{ capture?: string }>();
  if (capture === '1') {
    return (
      <View style={styles.capture}>
        <ShareCard />
      </View>
    );
  }
  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="eyebrow" color="goldText">
          Developer
        </Text>
        <Text variant="title1">Share card</Text>
        <Text color="textMuted">
          {`The ${SHARE_IMAGE.width}×${SHARE_IMAGE.height} image link previews show for every page. Run npm run brand:share to update public${SHARE_IMAGE.path} after changing it.`}
        </Text>
      </View>
      <ShareCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  capture: { width: SHARE_IMAGE.width, height: SHARE_IMAGE.height },
  header: { gap: spacing.sm, marginBottom: spacing.xl },
});
