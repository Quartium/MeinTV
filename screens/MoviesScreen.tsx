import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import PosterRow from '../components/rows/PosterRow';
import {
  getAnticipatedMovies,
  getPopularMovies,
  getTrendingMovies,
  TraktMovie,
} from '../services/traktClient';
import { playInKodiWithElementum } from '../services/kodiClient';

type PosterItem = {
  id: string;
  title: string;
  image: string;
  tmdbId?: number;
};

type MoviesScreenProps = {
  activeTabHandle: number | null;
  onFirstRowNativeIdChange: (id: number | null) => void;
  onRequestScroll: (y: number) => void;
};

const MoviesScreen: React.FC<MoviesScreenProps> = ({
  activeTabHandle,
  onFirstRowNativeIdChange,
  onRequestScroll,
}) => {
  const [trending, setTrending] = useState<PosterItem[]>([]);
  const [popular, setPopular] = useState<PosterItem[]>([]);
  const [anticipated, setAnticipated] = useState<PosterItem[]>([]);
  const [rowLayouts, setRowLayouts] = useState<{ y: number; height: number }[]>([]);
  const [firstIds, setFirstIds] = useState<(number | null)[]>([]);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  useEffect(() => {
    let cancelled = false;

    const toPosterItems = (movies: TraktMovie[]): PosterItem[] =>
      movies.map((m, index) => ({
        id: m.id || `movie-${index}`,
        title: m.title,
        image: m.thumbUrl || m.posterUrl,
        tmdbId: m.tmdbId,
      }));

    const load = async () => {
      try {
        const [trendingRes, popularRes, anticipatedRes] = await Promise.all([
          getTrendingMovies(12),
          getPopularMovies(12),
          getAnticipatedMovies(12),
        ]);

        if (cancelled) return;

        setTrending(toPosterItems(trendingRes));
        setPopular(toPosterItems(popularRes));
        setAnticipated(toPosterItems(anticipatedRes));
      } catch (e) {
        console.warn('Failed to load movies screen rows', e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const noopFocus = () => {};
  const handlePress = (_index: number, item: PosterItem) => {
    playInKodiWithElementum({
      id: item.id,
      title: item.title,
      tmdbId: item.tmdbId,
    });
  };

  const handleRowFocus = (rowIndex: number) => {
    const layout = rowLayouts[rowIndex];
    if (!layout) return;
    const target =
      rowIndex === 0
        ? 0
        : Math.max(0, layout.y - SCREEN_HEIGHT / 2 + layout.height / 2);
    onRequestScroll(target);
  };

  useEffect(() => {
    const first = firstIds.find(id => !!id) || null;
    if (first) onFirstRowNativeIdChange(first);
  }, [firstIds, onFirstRowNativeIdChange]);

  const setFirstIdAt = (index: number, id: number | null) => {
    setFirstIds(prev => {
      const next = [...prev];
      next[index] = id;
      return next;
    });
  };

  const onRowLayout =
    (index: number) =>
    (e: any) => {
      const { y, height } = e.nativeEvent.layout;
      setRowLayouts(prev => {
        const next = [...prev];
        next[index] = { y, height };
        return next;
      });
    };

  return (
    <View>
      {trending.length > 0 && (
        <>
          <RowTitle title="Trending movies" />
          <View onLayout={onRowLayout(0)}>
            <PosterRow
              items={trending}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(0);
              }}
              nextFocusUpId={activeTabHandle}
              onFirstItemNativeId={id => setFirstIdAt(0, id)}
              onItemPress={handlePress}
              nextFocusDownId={firstIds[1] || firstIds[2] || null}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {popular.length > 0 && (
        <>
          <RowTitle title="Most popular" />
          <View onLayout={onRowLayout(1)}>
            <PosterRow
              items={popular}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(1);
              }}
              nextFocusUpId={firstIds[0] || activeTabHandle}
              onFirstItemNativeId={id => setFirstIdAt(1, id)}
              nextFocusDownId={firstIds[2] || null}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {anticipated.length > 0 && (
        <>
          <RowTitle title="Most anticipated" />
          <View onLayout={onRowLayout(2)}>
            <PosterRow
              items={anticipated}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(2);
              }}
              nextFocusUpId={firstIds[1] || firstIds[0] || activeTabHandle}
              onFirstItemNativeId={id => setFirstIdAt(2, id)}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.footerSpacer} />
        </>
      )}
    </View>
  );
};

function RowTitle({ title }: { title: string }) {
  return <Text style={styles.rowTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  rowTitle: {
    color: 'white',
    fontSize: 16,
    lineHeight: 19,
    fontFamily: 'Inter-Medium',
    marginTop: 24,
    marginHorizontal: 75,
    opacity: 0.7,
  },
  rowSpacer: {
    height: 32,
  },
  footerSpacer: {
    height: 160,
  },
});

export default MoviesScreen;
