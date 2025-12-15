import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  ImageBackground,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  findNodeHandle,
} from 'react-native';

import LinearGradient from 'react-native-linear-gradient';
import { playInKodiWithElementum } from '../services/kodiClient';
import {
  getShowSeasons,
  TraktEpisode,
  TraktSeason,
} from '../services/traktClient';

type ShowRef = {
  id: string;
  title: string;
  image?: string;
  tmdbId?: number;
  traktId?: number;
  slug?: string;
};

type Props = {
  show: ShowRef;
  activeTabHandle: number | null;
  onBack: () => void;
  onFirstFocusableIdChange: (id: number | null) => void;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatSeasonLabel(seasonNumber: number) {
  if (seasonNumber === 0) return 'Specials';
  return `Season ${seasonNumber}`;
}

function formatEpisodeLabel(episode: TraktEpisode) {
  const ep = typeof episode.number === 'number' ? `E${pad2(episode.number)}` : '';
  return `${ep}${ep ? ' • ' : ''}${episode.title || 'Episode'}`;
}

function formatRating(rating?: number) {
  if (typeof rating !== 'number') return null;
  if (!Number.isFinite(rating)) return null;
  return `${rating.toFixed(1)}/10`;
}

function formatRuntime(runtime?: number) {
  if (typeof runtime !== 'number') return null;
  if (!Number.isFinite(runtime) || runtime <= 0) return null;
  return `${Math.round(runtime)} min`;
}

function FocusableListItem({
  label,
  selected,
  preferredFocus,
  nextFocusUpId,
  nextFocusLeftId,
  nextFocusRightId,
  onFocus,
  onPress,
  onNativeId,
}: {
  label: string;
  selected: boolean;
  preferredFocus?: boolean;
  nextFocusUpId?: number | null;
  nextFocusLeftId?: number | null;
  nextFocusRightId?: number | null;
  onFocus: () => void;
  onPress: () => void;
  onNativeId?: (id: number | null) => void;
}) {
  const ref = useRef<React.ElementRef<typeof TouchableOpacity> | null>(null);
  const [nativeId, setNativeId] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const id = findNodeHandle(ref.current);
    if (id) setNativeId(id);
    onNativeId?.(id ?? null);
    // Intentionally run once: `onNativeId` is often an inline callback and would
    // otherwise retrigger this effect every render, causing update loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusProps: any = {};
  if (Platform.OS === 'android' && nativeId !== null) {
    if (nextFocusUpId) focusProps.nextFocusUp = nextFocusUpId;
    if (nextFocusLeftId) focusProps.nextFocusLeft = nextFocusLeftId;
    if (nextFocusRightId) focusProps.nextFocusRight = nextFocusRightId;
  }

  return (
    <TouchableOpacity
      ref={ref}
      {...focusProps}
      focusable
      hasTVPreferredFocus={!!preferredFocus}
      activeOpacity={1}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => setFocused(false)}
      style={[
        styles.listItem,
        selected && styles.listItemSelected,
        focused && styles.listItemFocused,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.listItemText,
          (selected || focused) && styles.listItemTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const ShowDetailsScreen: React.FC<Props> = ({
  show,
  activeTabHandle,
  onBack,
  onFirstFocusableIdChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seasons, setSeasons] = useState<TraktSeason[]>([]);
  const [selectedSeasonIndex, setSelectedSeasonIndex] = useState(0);
  const [selectedEpisodeIndex, setSelectedEpisodeIndex] = useState(0);
  const [seasonNativeIds, setSeasonNativeIds] = useState<(number | null)[]>([]);
  const [episodeNativeIds, setEpisodeNativeIds] = useState<(number | null)[]>([]);

  const showKey = useMemo(() => {
    return String(show.slug ?? show.traktId ?? show.tmdbId ?? show.id);
  }, [show.id, show.slug, show.tmdbId, show.traktId]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSeasons([]);
    setSelectedSeasonIndex(0);
    setSelectedEpisodeIndex(0);
    setSeasonNativeIds([]);
    setEpisodeNativeIds([]);

    getShowSeasons(showKey)
      .then(list => {
        if (cancelled) return;
        setSeasons(list);
        if (list.length) {
          const firstRegular = list.findIndex(s => s.number > 0);
          if (firstRegular > 0 && list[0]?.number === 0) {
            setSelectedSeasonIndex(firstRegular);
          }
        }
      })
      .catch(e => {
        if (cancelled) return;
        console.warn('Failed to load show seasons', e);
        setError('Failed to load seasons');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showKey]);

  const selectedSeason = seasons[selectedSeasonIndex];
  const episodes = selectedSeason?.episodes ?? [];
  const selectedEpisode: TraktEpisode | undefined = episodes[selectedEpisodeIndex];

  useEffect(() => {
    const first = seasonNativeIds[0] ?? null;
    onFirstFocusableIdChange(first);
  }, [seasonNativeIds, onFirstFocusableIdChange]);

  useEffect(() => {
    if (selectedSeasonIndex >= seasons.length) {
      setSelectedSeasonIndex(0);
      setSelectedEpisodeIndex(0);
      return;
    }
    setSelectedEpisodeIndex(0);
    setEpisodeNativeIds([]);
  }, [selectedSeasonIndex, seasons.length]);

  const handlePlayEpisode = (episode: TraktEpisode) => {
    const tmdbShowId = show.tmdbId;
    const seasonNumber =
      typeof selectedSeason?.number === 'number' ? selectedSeason.number : episode.season;
    const episodeNumber = episode.number;

    if (typeof tmdbShowId !== 'number' || tmdbShowId <= 0) {
      console.warn('Cannot play episode: missing show.tmdbId', {
        showId: show.id,
        title: show.title,
      });
      return;
    }
    if (typeof seasonNumber !== 'number' || typeof episodeNumber !== 'number') {
      console.warn('Cannot play episode: missing season/episode', {
        tmdbShowId,
        season: seasonNumber,
        episode: episodeNumber,
      });
      return;
    }

    const kodiTitle = `${show.title} S${pad2(seasonNumber)}E${pad2(episodeNumber)} ${episode.title || ''}`.trim();
    console.log('Playing episode in Kodi', { tmdbShowId, season: seasonNumber, episode: episodeNumber });
    playInKodiWithElementum({
      type: 'episode',
      tmdbShowId,
      season: seasonNumber,
      episode: episodeNumber,
      id: `${show.id}-s${seasonNumber}e${episodeNumber}`,
      title: kodiTitle,
    });
  };

  return (
    <View style={styles.container}>
      {show.image ? (
        <ImageBackground
          source={{ uri: show.image }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.98)', 'rgba(0,0,0,0.5)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 6, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {loading ? (
        <Text style={styles.statusText}>Loading…</Text>
      ) : error ? (
        <Text style={styles.statusText}>{error}</Text>
      ) : seasons.length === 0 ? (
        <Text style={styles.statusText}>No seasons found</Text>
      ) : (
        <View style={styles.content}>
          <View style={styles.left}>
            <Text style={styles.sectionTitle}>Seasons</Text>
            <FlatList
              data={seasons}
              keyExtractor={s => `season-${s.number}`}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <FocusableListItem
                  label={formatSeasonLabel(item.number)}
                  selected={index === selectedSeasonIndex}
                  preferredFocus={index === 0}
                  nextFocusUpId={index === 0 ? activeTabHandle : undefined}
                  nextFocusRightId={episodeNativeIds[0] ?? undefined}
                  onNativeId={id => {
                    if (index === 0) onFirstFocusableIdChange(id);
                    setSeasonNativeIds(prev => {
                      const next = [...prev];
                      next[index] = id;
                      return next;
                    });
                  }}
                  onFocus={() => setSelectedSeasonIndex(index)}
                  onPress={() => setSelectedSeasonIndex(index)}
                />
              )}
            />
          </View>

          <View style={styles.right}>
            <View style={styles.details}>
              <View style={styles.header}>
                <Text numberOfLines={1} style={styles.headerTitle}>
                  {show.title}
                </Text>
              </View>
              <Text numberOfLines={2} style={styles.episodeTitle}>
                {selectedEpisode?.title || 'Select an episode'}
              </Text>
              <View style={styles.metaRow}>
                {formatRating(selectedEpisode?.rating) ? (
                  <Text style={styles.metaText}>{formatRating(selectedEpisode?.rating)}</Text>
                ) : null}
                {formatRuntime(selectedEpisode?.runtime) ? (
                  <Text style={styles.metaText}>{formatRuntime(selectedEpisode?.runtime)}</Text>
                ) : null}
              </View>
              {selectedEpisode?.overview ? (
                <Text numberOfLines={3} style={styles.episodeOverview}>
                  {selectedEpisode.overview}
                </Text>
              ) : (
                <Text numberOfLines={2} style={[styles.episodeOverview, styles.episodeOverviewDim]}>
                  No description available
                </Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Episodes</Text>
            <FlatList
              style={styles.episodesList}
              data={episodes}
              keyExtractor={e => `s${e.season ?? selectedSeason?.number ?? 0}-e${e.number ?? 0}`}
              showsVerticalScrollIndicator={false}
              renderItem={({ item, index }) => (
                <FocusableListItem
                  label={formatEpisodeLabel(item)}
                  selected={index === selectedEpisodeIndex}
                  nextFocusLeftId={seasonNativeIds[selectedSeasonIndex] ?? undefined}
                  onNativeId={
                    index === 0
                      ? id => {
                          setEpisodeNativeIds(prev => {
                            const next = [...prev];
                            next[0] = id;
                            return next;
                          });
                        }
                      : id => {
                          setEpisodeNativeIds(prev => {
                            const next = [...prev];
                            next[index] = id;
                            return next;
                          });
                        }
                  }
                  onFocus={() => setSelectedEpisodeIndex(index)}
                  onPress={() => handlePlayEpisode(item)}
                />
              )}
            />
          </View>
        </View>
      )}

      <View style={styles.footerSpacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 75,
    paddingTop: 16,
    backgroundColor: 'black',
    height: '100%'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 14,
  },
  backText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  headerTitle: {
    color: 'white',
    fontSize: 30,
    fontFamily: 'Inter-Medium',
    opacity: 1,
    flex: 1,
  },
  statusText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    marginTop: 18,
  },
  content: {
    flexDirection: 'row',
    gap: 28,
    alignItems: 'flex-start',
  },
  left: {
    width: 240,
    marginTop: 62,
  },
  right: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Inter-Medium',
    opacity: 0.7,
    marginBottom: 8,
    paddingHorizontal: 24,
  },
  episodesList: {
    height: '40%'
  },
  listItem: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginBottom: 8,
    overflow: 'hidden',
  },
  listItemFocused: {
    backgroundColor: '#fff',
  },
  listItemSelected: {
    backgroundColor: 'rgba(255,255,255,0.75)',
  },
  listItemText: {
    color: 'white',
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    opacity: 0.95,
  },
  listItemTextActive: {
    color: 'black',
    opacity: 1,
  },
  details: {
    marginBottom: 48,
  },
  episodeTitle: {
    color: 'white',
    fontSize: 18,
    fontFamily: 'Inter-Medium',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  metaText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
  },
  episodeOverview: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    lineHeight: 18,
    height: 55,
  },
  episodeOverviewDim: {
    opacity: 0.5,
  },
  footerSpacer: {
    height: 160,
  },
});

export default ShowDetailsScreen;
