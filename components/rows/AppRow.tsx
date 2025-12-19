import React, { useRef } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  anchorToStartOnFocus?: boolean;
  showAddTile?: boolean;
  onPressAddTile?: () => void;
  addTileLabel?: string;
};

const AppRow: React.FC<AppRowProps> = ({
  apps,
  onFocusApp,
  onLongPressApp,
  onCardRef,
  dimExceptPkg,
  dimEnabled,
  anchorToStartOnFocus = false,
  showAddTile = false,
  onPressAddTile,
  addTileLabel = 'Add apps',
}) => {
  const listRef = useRef<FlatList | null>(null);
  const ITEM_TOTAL_WIDTH = 168; // card width + marginRight (144 + 24)

  const data = showAddTile
    ? [
        ...apps,
        {
          packageName: '__add__',
          label: addTileLabel,
          icon: null,
          banner: null,
        },
      ]
    : apps;

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        horizontal
        data={data}
        keyExtractor={item => item.packageName}
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) =>
          item.packageName === '__add__' ? (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onPressAddTile}
              onFocus={() => {
                onFocusApp();
                if (anchorToStartOnFocus) {
                  listRef.current?.scrollToOffset({
                    offset: ITEM_TOTAL_WIDTH * index,
                    animated: true,
                  });
                }
              }}
              focusable
              style={styles.addTile}
            >
              <Text style={styles.addTileText}>{item.label}</Text>
            </TouchableOpacity>
          ) : (
            <AppCard
              name={item.label}
              packageName={item.packageName}
              icon={item.icon}
              banner={item.banner}
              scrollToHalf={onFocusApp}
              isFirst={index === 0}
              isLast={index === data.length - 1}
              scrollToStart={() =>
                listRef.current?.scrollToOffset({ offset: 0, animated: true })
              }
              scrollToEnd={() =>
                listRef.current?.scrollToEnd({ animated: true })
              }
              onRef={ref => onCardRef?.(item.packageName, ref)}
              dimmed={
                dimEnabled &&
                dimExceptPkg !== undefined &&
                dimExceptPkg !== null &&
                dimExceptPkg !== item.packageName
              }
              onLongPress={() => onLongPressApp?.(item.packageName, item.label)}
              onFocusExtra={() => {
                if (anchorToStartOnFocus) {
                  listRef.current?.scrollToOffset({
                    offset: ITEM_TOTAL_WIDTH * index,
                    animated: true,
                  });
                }
              }}
            />
          )
        }
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
    paddingHorizontal: 64,
  },
  addTile: {
    width: 144,
    height: 81,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginRight: 24,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
});

export default AppRow;
