import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import AppCard from '../components/cards/AppCard';

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
};

const AppsScreen: React.FC<AppsScreenProps> = ({
  apps,
  activeTabHandle,
  onFirstAppNativeIdChange,
  favoritePackages,
  onAddFavorite,
}) => {
  const [firstId, setFirstId] = useState<number | null>(null);

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

  const handleLongPress = (pkg: string) => {
    if (favoritePackages.includes(pkg)) return;
    Alert.alert('Add to favorites?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add', onPress: () => onAddFavorite(pkg) },
    ]);
  };

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

              return (
                <AppCard
                  key={item.packageName}
                  name={item.label}
                  packageName={item.packageName}
                  icon={item.icon}
                  banner={item.banner}
                  isFirst={isFirstInRow}
                  isLast={isLastInRow}
                  nextFocusUpId={activeTabHandle}
                  onNativeId={globalIndex === 0 ? setFirstId : undefined}
                  onLongPress={() => handleLongPress(item.packageName)}
                />
              );
            })}
          </View>
        ))}
      </View>

      <View style={styles.footerSpacer} />
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
