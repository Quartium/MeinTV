// src/screens/HomeScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, NativeModules } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import PosterRow from '../components/rows/PosterRow';
import AppRow from '../components/rows/AppRow';
import { getTrendingMovies, TraktMovie } from '../services/traktClient';
import { playInKodiWithElementum } from '../services/kodiClient';
import TvContextMenu from '../components/TvContextMenu';

const { TvApps } = NativeModules;

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
  showTraktBanner: boolean;
  onConnectTrakt: () => void;
  onRemoveFavorite: (pkg: string) => void;
  onGoToAppsTab: () => void;
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
  showTraktBanner,
  onConnectTrakt,
  onRemoveFavorite,
  onGoToAppsTab,
}) => {

  // ❗ Start empty. No fallback local posters.
  const [topPicks, setTopPicks] = useState<PosterItem[]>([]);
  const traktScale = useRef(new Animated.Value(1)).current;
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPackageName, setSelectedPackageName] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [returnFocusRef, setReturnFocusRef] = useState<TouchableOpacity | null>(null);
  const cardRefs = useRef<Record<string, TouchableOpacity | null>>({});
  const [focusedRow, setFocusedRow] = useState<number | null>(null);

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
    setFocusedRow(0);
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

  const handleLongPressApp = (pkg: string, label: string) => {
    const ref = cardRefs.current[pkg];
    if (ref?.measureInWindow) {
      ref.measureInWindow((x, y, width, height) => {
        setAnchorRect({ x, y, width, height });
        setSelectedPackageName(pkg);
        setReturnFocusRef(ref);
        setMenuVisible(true);
      });
    } else {
      setAnchorRect(null);
      setSelectedPackageName(pkg);
      setReturnFocusRef(ref ?? null);
      setMenuVisible(true);
    }
  };

  const closeMenu = () => setMenuVisible(false);

  useEffect(() => {
    if (!menuVisible) {
      const t = setTimeout(() => {
        setSelectedPackageName(null);
        setAnchorRect(null);
      }, 150);
      return () => clearTimeout(t);
    }
  }, [menuVisible]);

  const menuItems = React.useMemo(() => {
    if (!selectedPackageName) return [];
    return [
      {
        key: 'open',
        label: 'Open',
        iconName: '↗',
        onPress: () => {
          if (TvApps?.launchApp) {
            TvApps.launchApp(selectedPackageName).catch((e: any) =>
              console.warn('launchApp error from home menu', e),
            );
          }
          closeMenu();
        },
      },
      {
        key: 'remove-fav',
        label: 'Remove from favorites',
        iconName: '♡',
        onPress: () => {
          onRemoveFavorite(selectedPackageName);
          closeMenu();
        },
      },
      {
        key: 'info',
        label: 'Info',
        iconName: 'ⓘ',
        onPress: () => {
          console.log('Info requested for', selectedPackageName);
          closeMenu();
        },
      },
      {
        key: 'uninstall',
        label: 'Uninstall',
        iconName: '✕',
        onPress: () => {
          console.log('Uninstall requested for', selectedPackageName);
          closeMenu();
        },
      },
    ];
  }, [onRemoveFavorite, selectedPackageName]);

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
          <RowTitle title="Top picks" focused={focusedRow === 0} />

          <PosterRow
            items={topPicks}
            onItemFocus={handleTopPickFocus}
            onItemPress={handleTopPickPress}
            nextFocusUpId={activeTabHandle}
            onFirstItemNativeId={onFirstRowNativeIdChange}
            anchorToStartOnFocus
          />
        </>
      )}

      <LinearGradient
        colors={['transparent', '#000']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 5 }}
        style={styles.background}
      >

        <>
          <RowTitle title="Your apps" focused={focusedRow === 1} />
          <AppRow
            apps={apps}
            onFocusApp={() => {
              setFocusedRow(1);
              scrollToHalf();
            }}
            onLongPressApp={handleLongPressApp}
            onCardRef={(pkg, ref) => {
              cardRefs.current[pkg] = ref;
            }}
            dimEnabled={menuVisible}
            dimExceptPkg={selectedPackageName}
            anchorToStartOnFocus
            showAddTile
            onPressAddTile={onGoToAppsTab}
          />
        </>

        {showTraktBanner && (
          <Animated.View
            style={[
              styles.traktBannerWrapper,
              { transform: [{ scale: traktScale }] },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.95}
              onPress={onConnectTrakt}
              onFocus={() =>
                Animated.spring(traktScale, {
                  toValue: 1.06,
                  useNativeDriver: true,
                  friction: 7,
                  tension: 90,
                }).start()
              }
              onBlur={() =>
                Animated.spring(traktScale, {
                  toValue: 1,
                  useNativeDriver: true,
                  friction: 7,
                  tension: 90,
                }).start()
              }
              focusable
              style={styles.traktBanner}
            >
              <View style={styles.traktBannerBorder} />
              <Text style={styles.traktBannerTitle}>Explore movies on Trakt</Text>
              <View style={{ height: 10 }} />
              <Text style={styles.traktBannerBody}>
                {`See it. Save it. Watch it later.\nStart curating your personal movie queue.`}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={{ height: 160 }} />
      </LinearGradient>

      <TvContextMenu
        visible={menuVisible}
        anchorRect={anchorRect ?? undefined}
        items={menuItems}
        onRequestClose={closeMenu}
        initialFocusIndex={0}
        returnFocusRef={returnFocusRef}
      />
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
      <Text style={styles.heroTitle} numberOfLines={2}>{hero.title}</Text>

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

function RowTitle({ title, focused }: { title: string; focused?: boolean }) {
  return <Text style={[styles.rowTitle, focused && styles.rowTitleFocused]}>{title}</Text>;
}

const styles = StyleSheet.create({
  heroForegroundBox: {
    marginHorizontal: 64,
    height: '30%',
    borderRadius: 20,
    paddingBottom: 16,
    justifyContent: 'flex-end'
  },
  heroTitle: {
    color: 'white',
    fontSize: 40,
    lineHeight: 48,
    fontFamily: 'Inter-Regular',
    marginTop: 16,
    opacity: 0.8,
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
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Inter-Medium',
    opacity: 0.8,
    flexShrink: 1,
    marginRight: 16,
  },
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
  traktBannerWrapper: {
    marginHorizontal: 64,
    overflow: 'visible',
  },
  traktBanner: {
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: '#000',
  },
  traktBannerTitle: {
    color: 'white',
    fontSize: 32,
    lineHeight: 39,
    fontFamily: 'Inter-Regular',
  },
  traktBannerBody: {
    color: 'white',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  background: {
    borderRadius: 0
  },
});

export default HomeScreen;
