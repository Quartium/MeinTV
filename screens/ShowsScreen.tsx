import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import PosterRow from '../components/rows/PosterRow';
import {
  getAnticipatedShows,
  getPopularShows,
  getTrendingShows,
  TraktShow,
} from '../services/traktClient';
import { playInKodiWithElementum } from '../services/kodiClient';

type PosterItem = {
  id: string;
  title: string;
  image: string;
  tmdbId?: number;
};

type ShowsScreenProps = {
  activeTabHandle: number | null;
  onFirstRowNativeIdChange: (id: number | null) => void;
  recommendedShows?: TraktShow[];
  upNextShows?: TraktShow[];
  onRequestScroll: (y: number) => void;
};

const ShowsScreen: React.FC<ShowsScreenProps> = ({
  activeTabHandle,
  onFirstRowNativeIdChange,
  recommendedShows = [],
  upNextShows = [],
  onRequestScroll,
}) => {
  const [trending, setTrending] = useState<PosterItem[]>([]);
  const [popular, setPopular] = useState<PosterItem[]>([]);
  const [anticipated, setAnticipated] = useState<PosterItem[]>([]);
  const [recs, setRecs] = useState<PosterItem[]>([]);
  const [upNext, setUpNext] = useState<PosterItem[]>([]);
  const [recsFirstId, setRecsFirstId] = useState<number | null>(null);
  const [upNextFirstId, setUpNextFirstId] = useState<number | null>(null);
  const [trendingFirstId, setTrendingFirstId] = useState<number | null>(null);
  const [popularFirstId, setPopularFirstId] = useState<number | null>(null);
  const [anticipatedFirstId, setAnticipatedFirstId] = useState<number | null>(null);
  const [rowLayouts, setRowLayouts] = useState<{ y: number; height: number }[]>([]);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  useEffect(() => {
    let cancelled = false;

    const toPosterItems = (shows: TraktShow[]): PosterItem[] =>
      shows.map((s, index) => ({
        id: s.id || `show-${index}`,
        title: s.title,
        image: s.thumbUrl || s.posterUrl,
        tmdbId: s.tmdbId,
      }));

    const load = async () => {
      try {
        const [trendingRes, popularRes, anticipatedRes] = await Promise.all([
          getTrendingShows(12),
          getPopularShows(12),
          getAnticipatedShows(12),
        ]);

        if (cancelled) return;

        setTrending(toPosterItems(trendingRes));
        setPopular(toPosterItems(popularRes));
        setAnticipated(toPosterItems(anticipatedRes));
        setRecs(toPosterItems(recommendedShows || []));
        setUpNext(toPosterItems(upNextShows || []));
      } catch (e) {
        console.warn('Failed to load shows screen rows', e);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (recommendedShows && recommendedShows.length > 0) {
      const mapped = recommendedShows.map((s, index) => ({
        id: s.id || `rec-${index}`,
        title: s.title,
        image: s.thumbUrl || s.posterUrl,
        tmdbId: s.tmdbId,
      }));
      setRecs(mapped);
    } else {
      setRecs([]);
    }
  }, [recommendedShows]);

  useEffect(() => {
    if (upNextShows && upNextShows.length > 0) {
      const mapped = upNextShows.map((s, index) => ({
        id: s.id || `upnext-${index}`,
        title: s.title,
        image: s.thumbUrl || s.posterUrl,
        tmdbId: s.tmdbId,
      }));
      setUpNext(mapped);
    } else {
      setUpNext([]);
    }
  }, [upNextShows]);

  useEffect(() => {
    const first =
      recsFirstId ??
      upNextFirstId ??
      trendingFirstId ??
      popularFirstId ??
      anticipatedFirstId;
    if (first) onFirstRowNativeIdChange(first);
  }, [
    recsFirstId,
    upNextFirstId,
    trendingFirstId,
    popularFirstId,
    anticipatedFirstId,
    onFirstRowNativeIdChange,
  ]);

  const handleRowFocus = (rowIndex: number) => {
    const layout = rowLayouts[rowIndex];
    if (!layout) return;
    const target =
      rowIndex === 0
        ? 0
        : Math.max(0, layout.y - SCREEN_HEIGHT / 2 + layout.height / 2);
    onRequestScroll(target);
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

  const noopFocus = () => {};
  const handlePress = (_index: number, item: PosterItem) => {
    playInKodiWithElementum({
      id: item.id,
      title: item.title,
      tmdbId: item.tmdbId,
    });
  };

  return (
    <View>
      {recs.length > 0 && (
        <>
          <RowTitle title="Your recommendations" />
          <View onLayout={onRowLayout(0)}>
            <PosterRow
              items={recs}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(0);
              }}
              nextFocusUpId={activeTabHandle}
              onFirstItemNativeId={setRecsFirstId}
              nextFocusDownId={upNextFirstId || trendingFirstId || popularFirstId || anticipatedFirstId}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {upNext.length > 0 && (
        <>
          <RowTitle title="Up Next" />
          <View onLayout={onRowLayout(1)}>
            <PosterRow
              items={upNext}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(1);
              }}
              nextFocusUpId={recsFirstId || activeTabHandle}
              onFirstItemNativeId={setUpNextFirstId}
              nextFocusDownId={trendingFirstId || popularFirstId || anticipatedFirstId}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {trending.length > 0 && (
        <>
          <RowTitle title="Trending shows" />
          <View onLayout={onRowLayout(2)}>
            <PosterRow
              items={trending}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(2);
              }}
              nextFocusUpId={upNextFirstId || recsFirstId || activeTabHandle}
              onFirstItemNativeId={setTrendingFirstId}
              nextFocusDownId={popularFirstId || anticipatedFirstId}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {popular.length > 0 && (
        <>
          <RowTitle title="Most popular" />
          <View onLayout={onRowLayout(3)}>
            <PosterRow
              items={popular}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(3);
              }}
              nextFocusUpId={trendingFirstId || upNextFirstId || recsFirstId || activeTabHandle}
              onFirstItemNativeId={setPopularFirstId}
              nextFocusDownId={anticipatedFirstId}
              onItemPress={handlePress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {anticipated.length > 0 && (
        <>
          <RowTitle title="Most anticipated" />
          <View onLayout={onRowLayout(4)}>
            <PosterRow
              items={anticipated}
              onItemFocus={() => {
                noopFocus();
                handleRowFocus(4);
              }}
              nextFocusUpId={popularFirstId || trendingFirstId || upNextFirstId || recsFirstId || activeTabHandle}
              onFirstItemNativeId={setAnticipatedFirstId}
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

export default ShowsScreen;
