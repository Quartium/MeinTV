import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import PosterRow from '../components/rows/PosterRow';
import UpNextRow from '../components/rows/UpNextRow';
import {
  getAnticipatedShows,
  getPopularShows,
  getTrendingShows,
  TraktShow,
  TraktUpNextShow,
} from '../services/traktClient';
import { playInKodiWithElementum } from '../services/kodiClient';

type PosterItem = {
  id: string;
  title: string;
  image: string;
  tmdbId?: number;
  traktId?: number;
  slug?: string;
};

type UpNextItem = PosterItem & {
  episodeCode?: string;
  episodeTitle?: string;
  runtimeMinutes?: number;
  isSeriesPremiere?: boolean;
  remainingEpisodes?: number;
  seasonNumber?: number;
  episodeNumber?: number;
};

function formatEpisodeCode(season?: number, episode?: number) {
  if (typeof season !== 'number' || typeof episode !== 'number') return undefined;
  return `${season}x${String(episode).padStart(2, '0')}`;
}

function normalizeRuntimeMinutes(runtime?: number) {
  if (typeof runtime !== 'number') return undefined;
  if (!Number.isFinite(runtime) || runtime <= 0) return undefined;
  return Math.round(runtime);
}

type ShowsScreenProps = {
  activeTabHandle: number | null;
  onFirstRowNativeIdChange: (id: number | null) => void;
  recommendedShows?: TraktShow[];
  upNextShows?: TraktUpNextShow[];
  onRequestScroll: (y: number) => void;
  onOpenShowDetails?: (show: PosterItem) => void;
};

const ShowsScreen: React.FC<ShowsScreenProps> = ({
  activeTabHandle,
  onFirstRowNativeIdChange,
  recommendedShows = [],
  upNextShows = [],
  onRequestScroll,
  onOpenShowDetails,
}) => {
  const [trending, setTrending] = useState<PosterItem[]>([]);
  const [popular, setPopular] = useState<PosterItem[]>([]);
  const [anticipated, setAnticipated] = useState<PosterItem[]>([]);
  const [recs, setRecs] = useState<PosterItem[]>([]);
  const [upNext, setUpNext] = useState<UpNextItem[]>([]);
  const [recsFirstId, setRecsFirstId] = useState<number | null>(null);
  const [upNextFirstId, setUpNextFirstId] = useState<number | null>(null);
  const [trendingFirstId, setTrendingFirstId] = useState<number | null>(null);
  const [popularFirstId, setPopularFirstId] = useState<number | null>(null);
  const [anticipatedFirstId, setAnticipatedFirstId] = useState<number | null>(null);
  const [rowLayouts, setRowLayouts] = useState<{ y: number; height: number }[]>([]);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  const { height: SCREEN_HEIGHT } = Dimensions.get('window');

  useEffect(() => {
    let cancelled = false;

    const toPosterItems = (shows: TraktShow[]): PosterItem[] =>
      shows.map((s, index) => ({
        id: s.id || `show-${index}`,
        title: s.title,
        image: s.thumbUrl || s.posterUrl,
        tmdbId: s.tmdbId,
        traktId: s.traktId,
        slug: s.slug,
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
        traktId: s.traktId,
        slug: s.slug,
      }));
      setRecs(mapped);
    } else {
      setRecs([]);
    }
  }, [recommendedShows]);

  useEffect(() => {
    if (upNextShows && upNextShows.length > 0) {
      const mapped = upNextShows
        .map((s, index): UpNextItem | null => {
          const next = s.nextEpisode;
          if (!next) return null;

          return {
            id: s.id || `upnext-${index}`,
            title: s.title,
            image: s.thumbUrl || s.posterUrl,
            tmdbId: s.tmdbId,
            traktId: s.traktId,
            slug: s.slug,
            seasonNumber: typeof next.season === 'number' ? next.season : undefined,
            episodeNumber: typeof next.number === 'number' ? next.number : undefined,
            episodeCode: formatEpisodeCode(next.season, next.number),
            episodeTitle: next.title || undefined,
            runtimeMinutes: normalizeRuntimeMinutes(next.runtime),
            isSeriesPremiere:
              typeof next.season === 'number' &&
              typeof next.number === 'number' &&
              next.season === 1 &&
              next.number === 1,
            remainingEpisodes: s.remainingEpisodes,
          };
        })
        .filter(Boolean) as UpNextItem[];
      setUpNext(mapped);
    } else {
      setUpNext([]);
    }
  }, [upNextShows]);

  useEffect(() => {
    const first =
      upNextFirstId ??
      recsFirstId ??
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
    setFocusedRow(rowIndex);
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

  const handlePress = (_index: number, item: PosterItem) => {
    onOpenShowDetails?.(item);
  };

  const handleUpNextPress = (_index: number, item: UpNextItem) => {
    const hasEpisode =
      typeof item.seasonNumber === 'number' &&
      typeof item.episodeNumber === 'number';
    if (hasEpisode && typeof item.tmdbId === 'number') {
      playInKodiWithElementum({
        type: 'episode',
        tmdbShowId: item.tmdbId,
        season: item.seasonNumber as number,
        episode: item.episodeNumber as number,
        title: `${item.title} ${item.episodeCode ?? ''}`.trim(),
        id: item.id,
      });
      return;
    }
    // Fallback: open details if we can't play directly
    onOpenShowDetails?.(item);
  };

  return (
    <View>
      {upNext.length > 0 && (
        <>
          <RowTitle title="Up Next" focused={focusedRow === 0} />
          <View onLayout={onRowLayout(0)}>
            <UpNextRow
              items={upNext}
              onItemFocus={(index, _item) => handleRowFocus(0)}
              nextFocusUpId={activeTabHandle}
              onFirstItemNativeId={setUpNextFirstId}
              nextFocusDownId={recsFirstId || trendingFirstId || popularFirstId || anticipatedFirstId}
              onItemPress={handleUpNextPress}
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {recs.length > 0 && (
        <>
          <RowTitle title="Your recommendations" focused={focusedRow === 1} />
          <View onLayout={onRowLayout(1)}>
            <PosterRow
              items={recs}
              onItemFocus={(index, _item) => handleRowFocus(1)}
              nextFocusUpId={upNextFirstId || activeTabHandle}
              onFirstItemNativeId={setRecsFirstId}
              nextFocusDownId={trendingFirstId || popularFirstId || anticipatedFirstId}
              onItemPress={handlePress}
              showTitle
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {trending.length > 0 && (
        <>
          <RowTitle title="Trending shows" focused={focusedRow === 2} />
          <View onLayout={onRowLayout(2)}>
            <PosterRow
              items={trending}
              onItemFocus={(index, _item) => handleRowFocus(2)}
              nextFocusUpId={recsFirstId || upNextFirstId || activeTabHandle}
              onFirstItemNativeId={setTrendingFirstId}
              nextFocusDownId={popularFirstId || anticipatedFirstId}
              onItemPress={handlePress}
              showTitle
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {popular.length > 0 && (
        <>
          <RowTitle title="Most popular" focused={focusedRow === 3} />
          <View onLayout={onRowLayout(3)}>
            <PosterRow
              items={popular}
              onItemFocus={(index, _item) => handleRowFocus(3)}
              nextFocusUpId={trendingFirstId || recsFirstId || upNextFirstId || activeTabHandle}
              onFirstItemNativeId={setPopularFirstId}
              nextFocusDownId={anticipatedFirstId}
              onItemPress={handlePress}
              showTitle
            />
          </View>
          <View style={styles.rowSpacer} />
        </>
      )}

      {anticipated.length > 0 && (
        <>
          <RowTitle title="Most anticipated" focused={focusedRow === 4} />
          <View onLayout={onRowLayout(4)}>
            <PosterRow
              items={anticipated}
              onItemFocus={(index, _item) => handleRowFocus(4)}
              nextFocusUpId={popularFirstId || trendingFirstId || recsFirstId || upNextFirstId || activeTabHandle}
              onFirstItemNativeId={setAnticipatedFirstId}
              onItemPress={handlePress}
              showTitle
            />
          </View>
          <View style={styles.footerSpacer} />
        </>
      )}
    </View>
  );
};

function RowTitle({ title, focused }: { title: string; focused?: boolean }) {
  return <Text style={[styles.rowTitle, focused && styles.rowTitleFocused]}>{title}</Text>;
}

const styles = StyleSheet.create({
  rowTitle: {
    color: 'white',
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
    marginTop: 24,
    marginHorizontal: 64,
    opacity: 0.7,
  },
  rowTitleFocused: {
    fontSize: 20,
    opacity: 1,
    fontFamily: 'Inter-Medium',
  },
  rowSpacer: {
    height: 8,
  },
  footerSpacer: {
    height: 160,
  },
});

export default ShowsScreen;
