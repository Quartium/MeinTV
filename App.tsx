import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  ImageBackground,
  NativeModules,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import TopBar, { TabKey } from './components/TopBar';
import HomeScreen from './screens/HomeScreen';
import MoviesScreen from './screens/MoviesScreen';
import ShowsScreen from './screens/ShowsScreen';
import AppsScreen from './screens/AppsScreen';
import ShowDetailsScreen from './screens/ShowDetailsScreen';
import { loadFavoritePackages, saveFavoritePackages } from './services/favorites';
import DeviceCodeModal from './components/DeviceCodeModal';
import {
  requestDeviceCode,
  pollForToken,
  loadStoredToken,
  isTokenValid,
} from './services/traktAuth';
import { getRecommendedMovies, getRecommendedShows, getUpNextShows, TraktMovie, TraktShow } from './services/traktClient';

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
  banner?: string | null;
};

const HERO_FADE_END = 190;
const tabsOrder: TabKey[] = ['forYou', 'movies', 'shows', 'apps'];
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('forYou');
  const [activeShowDetails, setActiveShowDetails] = useState<{
    id: string;
    title: string;
    image?: string;
    tmdbId?: number;
    traktId?: number;
    slug?: string;
  } | null>(null);

  // No Gladiator default, start empty
  const [hero, setHero] = useState<HeroData>({
    title: '',
    subtitle: '',
    background: '',
  });

  const [apps, setApps] = useState<TvAppInfo[]>([]);
  const [favoritePackages, setFavoritePackages] = useState<string[]>([]);
  const [favoriteApps, setFavoriteApps] = useState<TvAppInfo[]>([]);
  const [activeTopPickIndex, setActiveTopPickIndex] = useState(0);
  const [activeTabHandle, setActiveTabHandle] = useState<number | null>(null);
  const [tabDownTarget, setTabDownTarget] = useState<number | null>(null);
  const [deviceCode, setDeviceCode] = useState<string | undefined>();
  const [deviceUrl, setDeviceUrl] = useState<string | undefined>();
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [traktToken, setTraktToken] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<TraktMovie[]>([]);
  const [recommendedShows, setRecommendedShows] = useState<TraktShow[]>([]);
  const [upNextShows, setUpNextShows] = useState<TraktShow[]>([]);
  const [needsTraktAuth, setNeedsTraktAuth] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.ScrollView | null>(null);
  const pollCancelRef = useRef<() => void>(() => {});

  const contentTranslateX = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const bgOpacity = scrollY.interpolate({
    inputRange: [0, HERO_FADE_END],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const bgTranslateY = scrollY.interpolate({
    inputRange: [0, HERO_FADE_END * 2],
    outputRange: [0, -120],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (Platform.OS === 'android' && TvApps?.getInstalledApps) {
      TvApps.getInstalledApps()
        .then((list: TvAppInfo[]) => {
          const sorted = [...list].sort((a, b) =>
            a.label.localeCompare(b.label),
          );
          setApps(sorted);
        })
        .catch(err => console.warn('getInstalledApps error', err));
    }
    loadFavoritePackages()
      .then(setFavoritePackages)
      .catch(err => console.warn('loadFavoritePackages error', err));

    loadStoredToken()
      .then(tok => {
        if (tok && isTokenValid(tok)) {
          setTraktToken(tok);
          setNeedsTraktAuth(false);
        } else {
          setNeedsTraktAuth(true);
        }
      })
      .catch(() => setNeedsTraktAuth(true));
  }, []);

  useEffect(() => {
    if (traktToken?.access_token) {
      getRecommendedMovies(traktToken.access_token, 12)
        .then(setRecommendations)
        .catch(() => setRecommendations([]));
      getRecommendedShows(traktToken.access_token, 12)
        .then(setRecommendedShows)
        .catch(() => setRecommendedShows([]));
      getUpNextShows(traktToken.access_token, 12)
        .then(setUpNextShows)
        .catch(() => setUpNextShows([]));
    }
  }, [traktToken]);

  useEffect(() => {
    setFavoriteApps(
      apps.filter(app => favoritePackages.includes(app.packageName)),
    );
  }, [apps, favoritePackages]);

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const scrollToHalf = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: SCREEN_HEIGHT * 0.5, animated: true });
    }
  };

  const scrollToPosition = (y: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  };

  const addFavorite = (pkg: string) => {
    setFavoritePackages(prev => {
      if (prev.includes(pkg)) return prev;
      const next = [...prev, pkg];
      saveFavoritePackages(next);
      return next;
    });
  };

  const removeFavorite = (pkg: string) => {
    setFavoritePackages(prev => {
      if (!prev.includes(pkg)) return prev;
      const next = prev.filter(p => p !== pkg);
      saveFavoritePackages(next);
      return next;
    });
  };

  const startDeviceCode = () => {
    let cancelled = false;

    pollCancelRef.current = () => {
      cancelled = true;
      setShowDeviceModal(false);
    };

    setNeedsTraktAuth(true);

    requestDeviceCode().then(res => {
      if (!res || cancelled) return;
      setDeviceCode(res.user_code);
      setDeviceUrl(res.verification_url);
      setShowDeviceModal(true);
      const code = res.device_code;
      const intervalMs = Math.max((res.interval || 5) * 1000, 5000);
      const maxAttempts = Math.ceil((res.expires_in || 300) * 1000 / intervalMs);
      let attempts = 0;
      const poll = () => {
        if (cancelled) return;
        attempts += 1;
        pollForToken(code)
          .then(tok => {
            if (cancelled) return;
            if (tok && tok.access_token) {
              setTraktToken(tok);
              setNeedsTraktAuth(false);
              setShowDeviceModal(false);
            } else if (attempts < maxAttempts) {
              setTimeout(poll, intervalMs);
            } else {
              setShowDeviceModal(false);
            }
          })
          .catch(() => {
            if (cancelled) return;
            if (attempts < maxAttempts) {
              setTimeout(poll, intervalMs);
            } else {
              setShowDeviceModal(false);
            }
          });
      };
      setTimeout(poll, intervalMs);
    });
  };

  const handleCloseDeviceModal = () => {
    pollCancelRef.current();
    setNeedsTraktAuth(true);
  };

  const handleTabChange = (next: TabKey) => {
    if (next === activeTab) return;

    const prevIndex = tabsOrder.indexOf(activeTab);
    const nextIndex = tabsOrder.indexOf(next);
    const direction = nextIndex > prevIndex ? 1 : -1;
    setTabDownTarget(null);

    contentTranslateX.setValue(40 * direction);
    contentOpacity.setValue(0);

    setActiveTab(next);
    setTabDownTarget(null);

    Animated.parallel([
      Animated.timing(contentTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <View style={styles.root}>
      <DeviceCodeModal
        visible={showDeviceModal}
        code={deviceCode}
        url={deviceUrl}
        onClose={handleCloseDeviceModal}
      />
      {activeShowDetails ? (
        <ShowDetailsScreen
          show={activeShowDetails}
          activeTabHandle={null}
          onBack={() => {
            setActiveShowDetails(null);
            setActiveTab('shows');
          }}
          onFirstFocusableIdChange={() => {}}
        />
      ) : (
        <>
          {activeTab === 'forYou' && (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: bgOpacity,
                  transform: [{ translateY: bgTranslateY }],
                },
              ]}
            >
              {hero.background ? (
                <ImageBackground
                  source={{ uri: hero.background }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,1)']}
                    style={StyleSheet.absoluteFill}
                  />
                </ImageBackground>
              ) : (
                // no hero background yet, just keep a plain dark backdrop
                <LinearGradient
                  colors={['rgba(0,0,0,1)', 'rgba(0,0,0,1)']}
                  style={StyleSheet.absoluteFill}
                />
              )}
            </Animated.View>
          )}

          <Animated.ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            scrollEventThrottle={16}
            onScroll={
              activeTab === 'forYou'
                ? Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: true },
                  )
                : undefined
            }
          >
            <TopBar
              activeTab={activeTab}
              onChangeTab={handleTabChange}
              scrollToTop={scrollToTop}
              onActiveTabHandleChange={setActiveTabHandle}
              nextFocusDownId={tabDownTarget}
            />

            <Animated.View
              style={{
                transform: [{ translateX: contentTranslateX }],
                opacity: contentOpacity,
              }}
            >
          {activeTab === 'forYou' ? (
            <HomeScreen
              hero={hero}
              onChangeHero={setHero}
              apps={favoriteApps}
              scrollToTop={scrollToTop}
              scrollToHalf={scrollToHalf}
              activeTopPickIndex={activeTopPickIndex}
              setActiveTopPickIndex={setActiveTopPickIndex}
              activeTabHandle={activeTabHandle}
              onFirstRowNativeIdChange={setTabDownTarget}
              recommendedMovies={recommendations}
              showTraktBanner={needsTraktAuth}
              onConnectTrakt={startDeviceCode}
              onRemoveFavorite={removeFavorite}
              onGoToAppsTab={() => handleTabChange('apps')}
            />
          ) : activeTab === 'movies' ? (
                <MoviesScreen
                  activeTabHandle={activeTabHandle}
                  onFirstRowNativeIdChange={setTabDownTarget}
                  onRequestScroll={scrollToPosition}
                />
              ) : activeTab === 'shows' ? (
                <ShowsScreen
                  activeTabHandle={activeTabHandle}
                  onFirstRowNativeIdChange={setTabDownTarget}
                  recommendedShows={recommendedShows}
                  upNextShows={upNextShows}
                  onRequestScroll={scrollToPosition}
                  onOpenShowDetails={show => {
                    setActiveTab('shows');
                    setActiveShowDetails(show);
                  }}
                />
              ) : activeTab === 'apps' ? (
            <AppsScreen
              apps={apps}
              activeTabHandle={activeTabHandle}
              onFirstAppNativeIdChange={setTabDownTarget}
              favoritePackages={favoritePackages}
              onAddFavorite={addFavorite}
              onRemoveFavorite={removeFavorite}
            />
          ) : (
            <PlaceholderTab activeTab={activeTab} />
          )}
        </Animated.View>
          </Animated.ScrollView>
        </>
      )}
    </View>
  );
}

function PlaceholderTab({ activeTab: _activeTab }: { activeTab: TabKey }) {
  const label = 'Apps tab - static for now';

  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'black',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
  },
  placeholderContainer: {
    minHeight: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'gray',
    fontSize: 20,
  },
});

export default App;
