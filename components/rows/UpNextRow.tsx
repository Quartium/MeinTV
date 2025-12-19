import React, { useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import UpNextCard from '../cards/UpNextCard';

type UpNextRowItem = {
  id: string;
  title: string;
  image: string;
  episodeCode?: string;
  episodeTitle?: string;
  runtimeMinutes?: number;
  isSeriesPremiere?: boolean;
  remainingEpisodes?: number;
  tmdbId?: number;
  traktId?: number;
  slug?: string;
};

type UpNextRowProps = {
  items: UpNextRowItem[];
  onItemFocus: (index: number, item: UpNextRowItem) => void;
  onItemPress?: (index: number, item: UpNextRowItem) => void;
  nextFocusUpId?: number | null;
  nextFocusDownId?: number | null;
  onFirstItemNativeId?: (id: number | null) => void;
  anchorToStartOnFocus?: boolean;
};

const ITEM_TOTAL_WIDTH = 175;

const UpNextRow: React.FC<UpNextRowProps> = ({
  items,
  onItemFocus,
  onItemPress,
  nextFocusUpId,
  nextFocusDownId,
  onFirstItemNativeId,
  anchorToStartOnFocus = false,
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
          <UpNextCard
            title={item.title}
            image={item.image}
            episodeCode={item.episodeCode}
            episodeTitle={item.episodeTitle}
            runtimeMinutes={item.runtimeMinutes}
            isSeriesPremiere={item.isSeriesPremiere}
            remainingEpisodes={item.remainingEpisodes}
            isFirst={index === 0}
            isLast={index === items.length - 1}
            nextFocusUpId={nextFocusUpId}
            nextFocusDownId={nextFocusDownId}
            onFocus={() => {
              onItemFocus(index, item);
              if (anchorToStartOnFocus) {
                const offset = ITEM_TOTAL_WIDTH * index;
                listRef.current?.scrollToOffset({ offset, animated: true });
              }
            }}
            onPress={() => onItemPress?.(index, item)}
            scrollToStart={() =>
              listRef.current?.scrollToOffset({ offset: 0, animated: true })
            }
            scrollToEnd={() => listRef.current?.scrollToEnd({ animated: true })}
            onNativeId={index === 0 ? onFirstItemNativeId : undefined}
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

export default UpNextRow;
