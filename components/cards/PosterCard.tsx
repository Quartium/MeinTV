import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  findNodeHandle,
} from 'react-native';

const FOCUS_SCALE = 1.09;

type PosterCardProps = {
  image: string;
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

const PosterCard: React.FC<PosterCardProps> = ({
  image,
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
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        if (isFirst) scrollToStart();
        if (isLast) scrollToEnd();
        onFocus && onFocus();
      }}
      onBlur={() => setFocused(false)}
      focusable
      activeOpacity={1}
      style={[styles.card, focused && styles.cardFocused]}
    >
      <Image source={{ uri: image }} style={styles.image} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 264,
    marginRight: 24,
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'visible',
  },
  cardFocused: {
    transform: [{ scale: FOCUS_SCALE }],
    borderWidth: 2,
    borderColor: '#B5C9CF',
    shadowColor: '#B2C5CD',
    elevation: 3,
  },
  image: {
    width: '100%',
    height: 147,
    borderRadius: 12,
    backgroundColor: '#333',
  },
});

export default PosterCard;
