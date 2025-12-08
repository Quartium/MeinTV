// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PosterRow from '../components/rows/PosterRow';
import AppRow from '../components/rows/AppRow';
import { getTrendingMovies, TraktMovie } from '../services/traktClient';
import { playInKodiWithElementum } from '../services/kodiClient';

type HeroData = {
  title: string;
  subtitle: string;
  background: string;
};

type TvAppInfo = {
  packageName: string;
  label: string;
  icon?: string | null;
};

type PosterItem = {
  id: string;
  title: string;
  image: string;
  backdropUrl?: string;
  overview?: string;
  tmdbId?: number;
};

type HomeScreenProps = {
  hero: HeroData;
  onChangeHero: (hero: HeroData) => void;
  apps: TvAppInfo[];
  scrollToTop: () => void;
  scrollToHalf: () => void;
  activeTopPickIndex: number;
  setActiveTopPickIndex: (index: number) => void;
  activeTabHandle: number | null;
  onFirstRowNativeIdChange: (id: number | null) => void;
  recommendedMovies?: TraktMovie[];
};

const HomeScreen: React.FC<HomeScreenProps> = ({
  hero,
  onChangeHero,
  apps,
  scrollToTop,
  scrollToHalf,
  activeTopPickIndex,
  setActiveTopPickIndex,
  activeTabHandle,
  onFirstRowNativeIdChange,
  recommendedMovies = [],
}) => {

  // ❗ Start empty. No fallback local posters.
  const [topPicks, setTopPicks] = useState<PosterItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    const useList = async () => {
      const source =
        recommendedMovies && recommendedMovies.length > 0
          ? recommendedMovies
          : await getTrendingMovies(10);

      if (cancelled) return;
      if (!source || source.length === 0) return;

      const mapped: PosterItem[] = source.map((m: TraktMovie, index) => ({
        id: m.id || `trending-${index}`,
        title: m.title,
        image: m.thumbUrl,
        backdropUrl: m.backdropUrl,
        overview: m.overview,
        tmdbId: m.tmdbId,
      }));

      setTopPicks(mapped);

      const first = mapped[0];
      if (first) {
        setActiveTopPickIndex(0);
        onChangeHero({
          title: first.title,
          subtitle: first.overview || hero.subtitle,
          background: first.backdropUrl || hero.background,
        });
      }
    };

    useList();
    return () => { cancelled = true; };
  }, [recommendedMovies]);

  const handleTopPickFocus = (index: number, item: PosterItem) => {
    scrollToTop();
    setActiveTopPickIndex(index);

    onChangeHero({
      title: item.title,
      subtitle: item.overview || hero.subtitle,
      background: item.backdropUrl || hero.background,
    });
  };

  const handleTopPickPress = (index: number, item: PosterItem) => {
    handleTopPickFocus(index, item);
    playInKodiWithElementum({
      id: item.id,
      title: item.title,
      tmdbId: item.tmdbId,
    });
  };

  return (
    <View>

      {/* HERO OVERLAY ALWAYS PRESENT, even if no posters */}
      <HeroOverlay
        hero={hero}
        activeIndex={activeTopPickIndex}
        total={topPicks.length}
      />

      {/* SHOW POSTER ROW ONLY IF DATA EXISTS */}
      {topPicks.length > 0 && (
        <>
          <RowTitle title="Top picks" />

          <PosterRow
            items={topPicks}
            onItemFocus={handleTopPickFocus}
            onItemPress={handleTopPickPress}
            nextFocusUpId={activeTabHandle}
            onFirstItemNativeId={onFirstRowNativeIdChange}
          />

          <View style={{ height: 32 }} />
        </>
      )}

      {apps.length > 0 && (
        <>
          <RowTitle title="Favorite apps" />
          <AppRow apps={apps} onFocusApp={scrollToHalf} />
        </>
      )}

      <View style={{ height: 160 }} />
    </View>
  );
};

function HeroOverlay({
  hero,
  activeIndex,
  total,
}: {
  hero: HeroData;
  activeIndex: number;
  total: number;
}) {
  return (
    <View style={styles.heroForegroundBox}>
      <Text style={styles.heroTitle}>{hero.title}</Text>

      <View style={styles.heroSubtitleRow}>
        <Text style={styles.heroSubtitle} numberOfLines={1}>
          {hero.subtitle}
        </Text>

        {/* If no posters loaded, show empty indicator row */}
        <View style={styles.heroDotsContainerRight}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.heroDot,
                i === activeIndex && styles.heroDotActive,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function RowTitle({ title }: { title: string }) {
  return <Text style={styles.rowTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  heroForegroundBox: {
    marginHorizontal: 75,
    marginBottom: 0,
    paddingVertical: 20,
    borderRadius: 20,
  },
  heroTitle: {
    color: 'white',
    fontSize: 51,
    lineHeight: 62,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
    opacity: 0.7,
  },
  heroSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  heroDotsContainerRight: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  heroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginRight: 6,
  },
  heroDotActive: {
    backgroundColor: 'white',
  },
  heroSubtitle: {
    color: '#dddddd',
    fontSize: 21,
    lineHeight: 25,
    fontFamily: 'Inter-Medium',
    opacity: 0.7,
    flexShrink: 1,
  },
  rowTitle: {
    color: 'white',
    fontSize: 16,
    lineHeight: 19,
    fontFamily: 'Inter-Medium',
    marginTop: 24,
    marginHorizontal: 75,
    opacity: 0.7,
  },
});

export default HomeScreen;
