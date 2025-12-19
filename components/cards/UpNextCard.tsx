import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';

const FOCUS_SCALE = 1.08;

type UpNextCardProps = {
  title: string;
  image: string;
  episodeCode?: string;
  episodeTitle?: string;
  runtimeMinutes?: number;
  isSeriesPremiere?: boolean;
  remainingEpisodes?: number;
  onFocus?: () => void;
  onPress?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  scrollToStart: () => void;
  scrollToEnd: () => void;
  nextFocusUpId?: number | null;
  nextFocusDownId?: number | null;
  onNativeId?: (id: number | null) => void;
};

function Badge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text numberOfLines={1} style={styles.badgeText}>
        {label}
      </Text>
    </View>
  );
}

const UpNextCard: React.FC<UpNextCardProps> = ({
  title,
  image,
  episodeCode,
  episodeTitle,
  runtimeMinutes,
  isSeriesPremiere,
  remainingEpisodes,
  onFocus,
  onPress,
  isFirst,
  isLast,
  scrollToStart,
  scrollToEnd,
  nextFocusUpId,
  nextFocusDownId,
  onNativeId,
}) => {
  const [focused, setFocused] = useState(false);
  const ref = useRef<TouchableOpacity | null>(null);
  const [nativeId, setNativeId] = useState<number | null>(null);

  useEffect(() => {
    const id = findNodeHandle(ref.current);
    if (id) setNativeId(id);
    onNativeId?.(id ?? null);
  }, []);

  const focusProps: any = {};
  if (Platform.OS === 'android' && nativeId !== null) {
    if (isFirst) focusProps.nextFocusLeft = nativeId;
    if (isLast) focusProps.nextFocusRight = nativeId;
    if (nextFocusUpId) focusProps.nextFocusUp = nextFocusUpId;
    if (nextFocusDownId) focusProps.nextFocusDown = nextFocusDownId;
  }

  return (
    <TouchableOpacity
      ref={ref}
      {...focusProps}
      focusable
      activeOpacity={1}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        if (isFirst) scrollToStart();
        if (isLast) scrollToEnd();
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      style={styles.card}
    >
      <View style={[styles.imageWrapper, focused && styles.imageWrapperFocused]}>
        <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />

        <View style={styles.badgesRow}>
          {isSeriesPremiere && <Badge label="Series premiere" />}
          {typeof runtimeMinutes === 'number' && runtimeMinutes > 0 && (
            <Badge label={`${runtimeMinutes}m`} />
          )}
          {typeof remainingEpisodes === 'number' && remainingEpisodes > 0 && (
            <Badge label={`${remainingEpisodes} left`} />
          )}
        </View>
      </View>

      <View style={styles.textWrapper}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        {(episodeCode || episodeTitle) && (
          <Text numberOfLines={1} style={styles.subtitle}>
            {episodeCode}
            {episodeTitle ? ` • ${episodeTitle}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 155,
    marginRight: 20,
    marginVertical: 12,
    overflow: 'visible',
  },
  imageWrapper: {
    width: 155,
    height: 87,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  imageWrapperFocused: {
    transform: [{ scale: FOCUS_SCALE }],
    borderColor: '#b5c9cf',
    shadowColor: '#b2c5cd',
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badgesRow: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  badgeText: {
    color: '#f3f6f7',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
  },
  textWrapper: {
    marginTop: 10,
  },
  title: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter-Medium',
  },
  subtitle: {
    color: '#cfd6d9',
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
});

export default UpNextCard;
