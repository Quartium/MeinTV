import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
  LayoutChangeEvent,
} from 'react-native';

const { TvApps } = NativeModules;

export type TabKey = 'forYou' | 'movies' | 'shows' | 'apps';

type TopBarProps = {
  activeTab: TabKey;
  onChangeTab: (key: TabKey) => void;
  scrollToTop: () => void;
  onActiveTabHandleChange?: (handle: number | null) => void;
  nextFocusDownId?: number | null;
};

const tabsOrder: TabKey[] = ['forYou', 'movies', 'shows', 'apps'];

type TabLayout = { x: number; width: number };

const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onChangeTab,
  scrollToTop,
  onActiveTabHandleChange,
  nextFocusDownId,
}) => {
  // Native driven X for smooth slide
  const indicatorX = useRef(new Animated.Value(0)).current;
  // Width kept as normal state (no Animated)
  const [indicatorWidth, setIndicatorWidth] = useState(0);

  const tabRefs = useRef<(TouchableOpacity | null)[]>([]);
  const firstTabRef = useRef<TouchableOpacity | null>(null);
  const lastTabRef = useRef<TouchableOpacity | null>(null);
  const settingsRef = useRef<TouchableOpacity | null>(null);
  const profileRef = useRef<TouchableOpacity | null>(null);

  const [tabLayouts, setTabLayouts] = useState<TabLayout[]>(
    () => tabsOrder.map(() => ({ x: 0, width: 0 })),
  );

  useEffect(() => {
    const index = tabsOrder.indexOf(activeTab);
    if (index < 0) return;

    const layout = tabLayouts[index];
    if (!layout || !layout.width) return;

    const pillX = layout.x - 12;
    const pillW = layout.width + 24;

    // Update width directly (no animation)
    if (indicatorWidth !== pillW) {
      setIndicatorWidth(pillW);
    }

    // Native driver for translateX only
    Animated.spring(indicatorX, {
      toValue: pillX,
      useNativeDriver: true,
      friction: 9,
      tension: 140,
    }).start();
  }, [activeTab, tabLayouts, indicatorX, indicatorWidth]);

  const handleSettingsPress = () => {
    if (Platform.OS === 'android' && TvApps?.openSystemSettings) {
      TvApps.openSystemSettings();
    }
  };

  const firstTabHandle = firstTabRef.current
    ? findNodeHandle(firstTabRef.current)
    : undefined;
  const lastTabHandle = lastTabRef.current
    ? findNodeHandle(lastTabRef.current)
    : undefined;
  const settingsHandle = settingsRef.current
    ? findNodeHandle(settingsRef.current)
    : undefined;
  const profileHandle = profileRef.current
    ? findNodeHandle(profileRef.current)
    : undefined;

  useEffect(() => {
    const index = tabsOrder.indexOf(activeTab);
    const ref = index >= 0 ? tabRefs.current[index] : null;
    const handle = ref ? findNodeHandle(ref) : null;
    onActiveTabHandleChange?.(handle);
  }, [activeTab, onActiveTabHandleChange]);

  const handleTabFocusOrPress = (tabKey: TabKey) => {
    scrollToTop();
    onChangeTab(tabKey);
  };

  const handleTabLayout =
    (index: number) =>
    (e: LayoutChangeEvent): void => {
      const { x, width } = e.nativeEvent.layout;

      setTabLayouts(prev => {
        const old = prev[index];
        // avoid unnecessary state updates
        if (old && old.x === x && old.width === width) return prev;
        const next = [...prev];
        next[index] = { x, width };
        return next;
      });
    };

  return (
    <View style={styles.topBar}>
      <Text style={styles.logoText}>MeinTV</Text>

      <View style={styles.tabRow}>
        {indicatorWidth > 0 && (
          <Animated.View
            style={[
              styles.tabAnimatedIndicator,
              {
                transform: [{ translateX: indicatorX }],
                width: indicatorWidth,
              },
            ]}
          />
        )}

        {tabsOrder.map((tabKey, index) => {
          const label =
            tabKey === 'forYou'
              ? 'For you'
              : tabKey === 'movies'
              ? 'Movies'
              : tabKey === 'shows'
              ? 'Shows'
              : 'Apps';

          const isActive = tabKey === activeTab;
          const isFirstTab = index === 0;
          const isLastTab = index === tabsOrder.length - 1;

          return (
            <TouchableOpacity
              key={tabKey}
              ref={el => {
                tabRefs.current[index] = el;
                if (isFirstTab) firstTabRef.current = el;
                if (isLastTab) lastTabRef.current = el;
              }}
              focusable
              activeOpacity={0.7}
              hasTVPreferredFocus={isActive}
              onLayout={handleTabLayout(index)}
              nextFocusLeft={
                isFirstTab && firstTabHandle ? firstTabHandle : undefined
              }
              nextFocusRight={
                isLastTab && settingsHandle ? settingsHandle : undefined
              }
              nextFocusDown={
                nextFocusDownId ? nextFocusDownId : undefined
              }
              onFocus={() => handleTabFocusOrPress(tabKey)}
              onPress={() => handleTabFocusOrPress(tabKey)}
              style={styles.tabButton}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.topBarRight}>
        <TouchableOpacity
          ref={settingsRef}
          focusable
          onPress={handleSettingsPress}
          style={styles.iconCircle}
          nextFocusLeft={lastTabHandle ?? undefined}
          nextFocusRight={profileHandle ?? undefined}
        >
          <Text style={styles.iconText}>⚙</Text>
        </TouchableOpacity>

        <TouchableOpacity
          ref={profileRef}
          focusable
          style={styles.avatarCircle}
          nextFocusLeft={settingsHandle ?? undefined}
          nextFocusRight={profileHandle ?? undefined}
        >
          <Text style={styles.iconText}>☺</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    height: 72,
    paddingHorizontal: 75,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-Medium',
  },
  tabRow: {
    flexDirection: 'row',
    marginLeft: 42,
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  tabButton: {
    paddingHorizontal: 12,
    marginHorizontal: 12,
    alignItems: 'center',
  },
  tabText: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 26,
    fontFamily: 'Inter-Medium',
    opacity: 0.7,
  },
  tabTextActive: {
    fontSize: 20,
    opacity: 1,
  },
  tabAnimatedIndicator: {
    position: 'absolute',
    top: -10,
    left: 0,
    height: 50,
    borderRadius: 50,
    backgroundColor: 'white',
    opacity: 0.2,
    zIndex: -1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 24,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#444',
    marginLeft: 12,
  },
  iconText: {
    color: 'white',
    fontSize: 20,
  },
});

export default TopBar;
