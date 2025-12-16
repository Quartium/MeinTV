import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  useTVEventHandler,
} from 'react-native';

type MenuItem = {
  key: string;
  label: string;
  iconName?: string;
  onPress: () => void;
};

type FocusableRef = { focus?: () => void } | null;

type TvContextMenuProps = {
  visible: boolean;
  anchorLabel?: string;
  anchorRect?: { x: number; y: number; width: number; height: number };
  items: MenuItem[];
  onRequestClose: () => void;
  initialFocusIndex?: number;
  returnFocusRef?: FocusableRef;
};

// Lightweight Google TV style context menu for Android TV.
const TvContextMenu: React.FC<TvContextMenuProps> = ({
  visible,
  anchorLabel,
  anchorRect,
  items,
  onRequestClose,
  initialFocusIndex = 0,
  returnFocusRef,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(initialFocusIndex);
  const [rendered, setRendered] = useState(visible);
  const opacity = useRef(new Animated.Value(0)).current;
  const rowRefs = useRef<(TouchableOpacity | null)[]>([]);
  const openTimestampRef = useRef(0);
  const scrimCloseEnabledRef = useRef(false);
  const scrimEnableTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { width: screenW, height: screenH } = Dimensions.get('window');

  const shouldIgnoreInitialPress = () =>
    openTimestampRef.current === 0 || Date.now() - openTimestampRef.current < 700; // guard initial long-press release

  useEffect(() => {
    if (visible) {
      setRendered(true);
      openTimestampRef.current = Date.now();
      scrimCloseEnabledRef.current = false;
      if (scrimEnableTimeoutRef.current) {
        clearTimeout(scrimEnableTimeoutRef.current);
      }
      scrimEnableTimeoutRef.current = setTimeout(() => {
        scrimCloseEnabledRef.current = true;
      }, 700);
      setFocusedIndex(Math.min(initialFocusIndex, Math.max(items.length - 1, 0)));
      Animated.timing(opacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 80,
        useNativeDriver: true,
      }).start(() => {
        // Restore focus only after fade-out so we don't fight the animation.
        const refTarget: FocusableRef = returnFocusRef ?? null;
        if (refTarget?.focus) {
          setTimeout(() => refTarget.focus?.(), 0);
        }
        setRendered(false);
        openTimestampRef.current = 0;
        scrimCloseEnabledRef.current = false;
        if (scrimEnableTimeoutRef.current) {
          clearTimeout(scrimEnableTimeoutRef.current);
          scrimEnableTimeoutRef.current = null;
        }
      });
    }
  }, [visible, rendered, items.length, initialFocusIndex, opacity, returnFocusRef]);

  useEffect(() => {
    return () => {
      if (scrimEnableTimeoutRef.current) {
        clearTimeout(scrimEnableTimeoutRef.current);
        scrimEnableTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!visible) return false;
      onRequestClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onRequestClose]);

  useEffect(() => {
    if (!visible) return;
    // Move focus into the menu once on open; delay avoids racing the modal mount.
    const t = setTimeout(() => {
      const target = rowRefs.current[Math.min(initialFocusIndex, items.length - 1)];
      target?.focus?.();
    }, 30);
    return () => clearTimeout(t);
  }, [visible, initialFocusIndex, items.length]);

  useTVEventHandler(evt => {
    if (!rendered || items.length === 0) return;
    if (evt.eventType === 'select') {
      // Guard the select that fires when a long-press is released; prevents auto-trigger.
      if (shouldIgnoreInitialPress()) return;
    }
    if (evt.eventType === 'back' || evt.eventType === 'menu') {
      onRequestClose();
    } else if (evt.eventType === 'up') {
      setFocusedIndex(prev => (prev - 1 + items.length) % items.length);
    } else if (evt.eventType === 'down') {
      setFocusedIndex(prev => (prev + 1) % items.length);
    } else if (evt.eventType === 'select') {
      const item = items[focusedIndex];
      item?.onPress();
    }
  });

  const activeIndex = useMemo(
    () => Math.min(focusedIndex, Math.max(items.length - 1, 0)),
    [focusedIndex, items.length],
  );

  const cardPositionStyle = useMemo(() => {
    if (!anchorRect) return {};
    const cardWidth = Math.min(screenW * 0.3, 420);
    const spaceRight = screenW - (anchorRect.x + anchorRect.width);
    const placeOnRight = spaceRight >= cardWidth + 24;
    const desiredLeft = placeOnRight
      ? anchorRect.x + anchorRect.width + 12
      : anchorRect.x - cardWidth - 12;
    const horizontal = Math.min(Math.max(desiredLeft, 16), screenW - cardWidth - 16);
    const vertical = Math.min(
      Math.max(anchorRect.y, 16),
      screenH - 220,
    );
    return {
      position: 'absolute' as const,
      left: horizontal,
      top: vertical,
      width: cardWidth,
    };
  }, [anchorRect, screenH, screenW]);

  if (!rendered) {
    return null;
  }

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback
        onPress={() => {
          if (shouldIgnoreInitialPress() || !scrimCloseEnabledRef.current) return;
          onRequestClose();
        }}
      >
        <Animated.View style={[styles.scrim, { opacity }]}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, cardPositionStyle]}>
              {items.map((item, index) => {
                const isFocused = index === activeIndex;
                return (
                  <TouchableOpacity
                    key={item.key}
                    ref={el => {
                      rowRefs.current[index] = el;
                    }}
                    focusable
                    onFocus={() => setFocusedIndex(index)}
                    onPress={() => {
                      if (shouldIgnoreInitialPress()) return;
                      item.onPress();
                    }}
                    style={[styles.row, isFocused && styles.rowFocused]}
                  >
                    <View style={[styles.iconCircle]}>
                      <Text style={styles.iconText}>{item.iconName ?? '-'}</Text>
                    </View>
                    <Text style={[styles.rowLabel, isFocused && styles.rowLabelFocused]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableWithoutFeedback>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '30%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden'
  },
  anchorLabel: {
    color: '#5a5a5a',
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  rowFocused: {
    backgroundColor: '#f1f1f1',
  },
  iconCircle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  iconText: {
    color: '#2792f8',
    fontSize: 20,
    lineHeight: 20,
    fontFamily: 'Inter-Medium',
  },
  rowLabel: {
    color: '#222',
    fontSize: 15,
    lineHeight: 20,
    fontFamily: 'Inter-Medium',
  },
  rowLabelFocused: {
    color: '#000',
  },
});

export default TvContextMenu;
