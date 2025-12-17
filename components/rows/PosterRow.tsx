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
};

const PosterRow: React.FC<PosterRowProps> = ({
  items,
  onItemFocus,
  onItemPress,
  nextFocusUpId,
  nextFocusDownId,
  onFirstItemNativeId,
}) => {
  const listRef = useRef<FlatList | null>(null);

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
            onFocus={() => onItemFocus(index, item)}
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
