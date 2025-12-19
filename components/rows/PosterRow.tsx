import React, { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import PosterCard from '../cards/PosterCard';

type PosterRowProps = {
  items: { id: string; title: string; image: string; tmdbId?: number }[];
  onItemFocus: (index: number, item: any) => void;
  onItemPress?: (index: number, item: any) => void;
  nextFocusUpId?: number | null;
  nextFocusDownId?: number | null;
  onFirstItemNativeId?: (id: number | null) => void;
  anchorToStartOnFocus?: boolean;
};

const PosterRow: React.FC<PosterRowProps> = ({
  items,
  onItemFocus,
  onItemPress,
  nextFocusUpId,
  nextFocusDownId,
  onFirstItemNativeId,
  anchorToStartOnFocus = false,
}) => {
  const listRef = useRef<FlatList | null>(null);
  const ITEM_TOTAL_WIDTH = 175; // card width + marginRight (155 + 20)

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        horizontal
        data={items}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <PosterCard
            image={item.image}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            nextFocusUpId={nextFocusUpId}
            nextFocusDownId={nextFocusDownId}
            onFocus={() => {
              onItemFocus(index, item);
              if (anchorToStartOnFocus) {
                const offset = ITEM_TOTAL_WIDTH * index;
                listRef.current?.scrollToOffset({
                  offset,
                  animated: true,
                });
              }
            }}
            onPress={() => onItemPress?.(index, item)}
            scrollToStart={() =>
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
            scrollToEnd={() =>
              listRef.current?.scrollToEnd({ animated: true })
            }
            onNativeId={
              index === 0 ? onFirstItemNativeId : undefined
            }
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'visible',
  },
  content: {
    paddingHorizontal: 64,
  },
});

export default PosterRow;
