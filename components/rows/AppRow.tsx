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
  onLongPressApp?: (pkg: string) => void;
};

const AppRow: React.FC<AppRowProps> = ({
  apps,
  onFocusApp,
  onLongPressApp,
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
            onLongPress={() => onLongPressApp?.(item.packageName)}
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
