import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppCard from '../components/cards/AppCard';
import TvContextMenu from '../components/TvContextMenu';

type TvAppInfo = {
  packageName: string;
  label: string;
  icon?: string | null;
  banner?: string | null;
};

type AppsScreenProps = {
  apps: TvAppInfo[];
  activeTabHandle: number | null;
  onFirstAppNativeIdChange: (id: number | null) => void;
  favoritePackages: string[];
  onAddFavorite: (pkg: string) => void;
  onRemoveFavorite: (pkg: string) => void;
};

const AppsScreen: React.FC<AppsScreenProps> = ({
  apps,
  activeTabHandle,
  onFirstAppNativeIdChange,
  favoritePackages,
  onAddFavorite,
  onRemoveFavorite,
}) => {
  const [firstId, setFirstId] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [returnFocusRef, setReturnFocusRef] = useState<TouchableOpacity | null>(null);
  const [anchorRect, setAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const cardRefs = useRef<Record<string, TouchableOpacity | null>>({});

  const rows = useMemo(() => {
    const chunks: TvAppInfo[][] = [];
    for (let i = 0; i < apps.length; i += 5) {
      chunks.push(apps.slice(i, i + 5));
    }
    return chunks;
  }, [apps]);

  useEffect(() => {
    onFirstAppNativeIdChange(firstId);
  }, [firstId, onFirstAppNativeIdChange]);

  const handleLongPress = (pkg: string, label: string) => {
    const ref = cardRefs.current[pkg];
    if (ref?.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        setAnchorRect({ x, y, width, height });
        setSelectedPackageName(pkg);
        setSelectedLabel(label);
        setReturnFocusRef(ref);
        setMenuVisible(true);
      });
    } else {
      setAnchorRect(null);
      setSelectedPackageName(pkg);
      setSelectedLabel(label);
      setReturnFocusRef(ref ?? null);
      setMenuVisible(true);
    }
  };

  const closeMenu = () => setMenuVisible(false);

  useEffect(() => {
    if (!menuVisible) {
      // Clear selection after focus restoration occurs.
      const timeout = setTimeout(() => {
        setSelectedPackageName(null);
        setSelectedLabel(null);
      }, 150);
      return () => clearTimeout(timeout);
    }
  }, [menuVisible]);

  const menuItems = useMemo(() => {
    if (!selectedPackageName) return [];
    const items = [];
    items.push({
      key: 'open',
      label: 'Open',
      iconName: '↗',
      onPress: () => {
        if (selectedPackageName) {
          // Use the same launcher as AppCard so behavior is consistent.
          const { TvApps } = require('react-native').NativeModules;
          if (TvApps?.launchApp) {
            TvApps.launchApp(selectedPackageName).catch((e: any) =>
              console.warn('launchApp error from context menu', e),
            );
          }
        }
        closeMenu();
      },
    });
    if (!favoritePackages.includes(selectedPackageName)) {
      items.push({
        key: 'favorite',
        label: 'Add to favourites',
        iconName: '❤',
        onPress: () => {
          onAddFavorite(selectedPackageName);
          closeMenu();
        },
      });
    } else {
      items.push({
        key: 'remove-favorite',
        label: 'Remove from favorites',
        iconName: '♡',
        onPress: () => {
          onRemoveFavorite(selectedPackageName);
          closeMenu();
        },
      });
    }
    items.push({
      key: 'info',
      label: 'Info',
      iconName: 'ⓘ',
      onPress: () => {
        console.log('Info requested for', selectedPackageName);
        closeMenu();
      },
    });
    items.push({
      key: 'uninstall',
      label: 'Uninstall',
      iconName: '✕',
      onPress: () => {
        console.log('Uninstall requested for', selectedPackageName);
        closeMenu();
      },
    });
    return items;
  }, [favoritePackages, onAddFavorite, selectedPackageName]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>All apps</Text>

      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <View style={styles.row} key={`row-${rowIndex}`}>
            {row.map((item, colIndex) => {
              const globalIndex = rowIndex * 5 + colIndex;
              const isFirstInRow = colIndex === 0;
              const isLastInRow = colIndex === row.length - 1;
              const rowAbove = rows[rowIndex - 1];
              const aboveIndex =
                rowAbove && rowAbove[colIndex]
                  ? (rowIndex - 1) * 5 + colIndex
                  : rowAbove
                    ? (rowIndex - 1) * 5 + (rowAbove.length - 1)
                    : null;

              return (
                <AppCard
                  key={item.packageName}
                  name={item.label}
                  packageName={item.packageName}
                  icon={item.icon}
                  banner={item.banner}
                  isFirst={isFirstInRow}
                  isLast={isLastInRow}
                  nextFocusUpId={rowIndex === 0 ? activeTabHandle : undefined}
                  nextFocusUpFallback={rowIndex > 0 ? aboveIndex : undefined}
                  onNativeId={id => {
                    if (globalIndex === 0) setFirstId(id);
                  }}
                  onRef={ref => {
                    cardRefs.current[item.packageName] = ref;
                  }}
                  onLongPress={() => handleLongPress(item.packageName, item.label)}
                  dimmed={menuVisible && selectedPackageName !== item.packageName}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footerSpacer} />

      <TvContextMenu
        visible={menuVisible}
        anchorLabel={selectedLabel ?? undefined}
        anchorRect={anchorRect ?? undefined}
        items={menuItems}
        onRequestClose={closeMenu}
        initialFocusIndex={0}
        returnFocusRef={returnFocusRef}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 75,
  },
  title: {
    color: 'white',
    fontSize: 16,
    lineHeight: 19,
    fontFamily: 'Inter-Medium',
    marginTop: 24,
    marginBottom: 12,
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  grid: {
  },
  footerSpacer: {
    height: 160,
  },
});

export default AppsScreen;
