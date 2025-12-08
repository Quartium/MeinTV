import React, { useEffect, useRef, useState } from 'react';
import {
  Image,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';
const FOCUS_SCALE = 1.12;
const { TvApps } = NativeModules;

type AppCardProps = {
  name: string;
  packageName: string;
  icon?: string | null;
  scrollToHalf?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  scrollToStart?: () => void;
  scrollToEnd?: () => void;
  nextFocusUpId?: number | null;
  onNativeId?: (id: number | null) => void;
  onLongPress?: () => void;
};

const AppCard: React.FC<AppCardProps> = ({
  name,
  packageName,
  icon,
  scrollToHalf,
  isFirst,
  isLast,
  scrollToStart,
  scrollToEnd,
  nextFocusUpId,
  onNativeId,
  onLongPress,
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
  }

  const handlePress = () => {
    if (Platform.OS === 'android' && TvApps?.launchApp) {
      TvApps.launchApp(packageName).catch(e =>
        console.warn('launchApp error', e),
      );
    }
  };

  return (
    <TouchableOpacity
      ref={ref}
      {...focusProps}
      onPress={handlePress}
      onLongPress={onLongPress}
      onFocus={() => {
        setFocused(true);
        scrollToHalf?.();
        if (isFirst) scrollToStart?.();
        if (isLast) scrollToEnd?.();
      }}
      onBlur={() => setFocused(false)}
      focusable
      activeOpacity={1}
      style={styles.card}
    >
      <View style={[styles.logoWrapper, focused && styles.logoWrapperFocused]}>
        {icon ? (
          <Image source={{ uri: icon }} style={styles.logo} resizeMode="contain" />
        ) : (
          <Text style={styles.name}>{name}</Text>
        )}
      </View>

      <Text numberOfLines={1} style={styles.name}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 24,
    marginVertical: 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  logoWrapper: {
    width: 140,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  logoWrapperFocused: {
    transform: [{ scale: FOCUS_SCALE }],
  },
  logo: {
    width: 120,
    height: 70,
    borderRadius: 12,
  },
  name: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
});

export default AppCard;
