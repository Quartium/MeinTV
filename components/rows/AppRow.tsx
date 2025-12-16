import React, { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import AppCard from '../cards/AppCard';

type AppRowProps = {
  apps: {
    packageName: string;
    label: string;
    icon?: string | null;
    banner?: string | null;
  }[];
  onFocusApp: () => void;
  onLongPressApp?: (pkg: string, label: string) => void;
  onCardRef?: (pkg: string, ref: any) => void;
  dimExceptPkg?: string | null;
  dimEnabled?: boolean;
};

const AppRow: React.FC<AppRowProps> = ({
  apps,
  onFocusApp,
  onLongPressApp,
  onCardRef,
  dimExceptPkg,
  dimEnabled,
}) => {
  const listRef = useRef<FlatList | null>(null);

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        horizontal
        data={apps}
        keyExtractor={item => item.packageName}
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <AppCard
            name={item.label}
            packageName={item.packageName}
            icon={item.icon}
            banner={item.banner}
            scrollToHalf={onFocusApp}
            isFirst={index === 0}
            isLast={index === apps.length - 1}
            scrollToStart={() =>
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
            scrollToEnd={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            onRef={ref => onCardRef?.(item.packageName, ref)}
            dimmed={dimEnabled && dimExceptPkg !== undefined && dimExceptPkg !== null && dimExceptPkg !== item.packageName}
            onLongPress={() => onLongPressApp?.(item.packageName, item.label)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
    marginBottom: 32
  },
  content: {
    paddingHorizontal: 75,
  },
});

export default AppRow;
