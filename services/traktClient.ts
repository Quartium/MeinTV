// src/services/traktClient.ts
declare const process: { env: Record<string, string | undefined> };

type TraktMediaEntity = {
  title: string;
  year?: number;
  overview?: string;
  tagline?: string;
  ids: {
    trakt?: number;
    slug?: string;
    tmdb?: number;
    imdb?: string;
  };
  images?: {
    fanart?: string[];
    poster?: string[];
    logo?: string[];
    clearart?: string[];
    banner?: string[];
    thumb?: string[];
  };
};

export type TraktMovie = {
  id: string;
  title: string;
  year?: number;
  overview?: string;
  posterUrl: string;
  backdropUrl: string;
  thumbUrl: string;
  tmdbId?: number;
  traktId?: number;
  slug?: string;
};

export type TraktShow = TraktMovie;

export type TraktEpisode = {
  season?: number;
  number?: number;
  title: string;
  overview?: string;
  rating?: number;
  runtime?: number;
};

export type TraktSeason = {
  number: number;
  episodes: TraktEpisode[];
};

type TraktMovieEntity = TraktMediaEntity;
type TraktShowEntity = TraktMediaEntity;

type TraktTrendingMovieResponseItem = {
  watchers: number;
  movie: TraktMovieEntity;
};

type TraktAnticipatedMovieResponseItem = {
  list_count?: number;
  movie: TraktMovieEntity;
};

type TraktTrendingShowResponseItem = {
  watchers: number;
  show: TraktShowEntity;
};

type TraktAnticipatedShowResponseItem = {
  list_count?: number;
  show: TraktShowEntity;
};

const TRAKT_BASE_URL = 'https://api.trakt.tv';

const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID ?? '';
const FALLBACK_POSTER =
  'https://via.placeholder.com/264x147/222222/cccccc?text=No+Image';
const FALLBACK_BACKDROP =
  'https://via.placeholder.com/1280x720/222222/cccccc?text=No+Backdrop';

function buildQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return '';
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    );
  return parts.length ? `?${parts.join('&')}` : '';
}

// images from Trakt come as ["walter-r2.trakt.tv/....webp"]
function normalizeImage(urls?: string[]): string | undefined {
  if (!urls || !urls.length) return undefined;
  const raw = urls[0];
  if (!raw) return undefined;
  if (raw.startsWith('http')) return raw;
  return `https://${raw}`;
}

function mapMediaEntity(m: TraktMediaEntity): TraktMovie {
  const poster = normalizeImage(m.images?.poster) || FALLBACK_POSTER;
  const thumb =
    normalizeImage(m.images?.thumb) ||
    normalizeImage(m.images?.poster) ||
    FALLBACK_POSTER;
  const backdrop = normalizeImage(m.images?.fanart) || FALLBACK_BACKDROP;
  const overview = m.overview || m.tagline || '';

  const tmdbId = m.ids.tmdb;
  const traktId = m.ids.trakt;
  const slug = m.ids.slug;

  const id = String(
    slug ??
      tmdbId ??
      traktId ??
      m.title ??
      Math.random(),
  );

  return {
    id,
    title: m.title,
    year: m.year,
    overview,
    posterUrl: poster,
    backdropUrl: backdrop,
    thumbUrl: thumb,

    tmdbId,
    traktId,
    slug,
  };
}

async function traktRequest<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
  authToken?: string,
): Promise<T> {
  if (!TRAKT_CLIENT_ID) {
    throw new Error(
      'TRAKT_CLIENT_ID is not set. Add it to your .env file before running the app.',
    );
  }

  const url = `${TRAKT_BASE_URL}${path}${buildQuery(params)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID,
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('Trakt error body:', text);
    throw new Error(`Trakt request failed ${res.status}`);
  }

  return (await res.json()) as T;
}

export async function getTrendingMovies(limit = 10): Promise<TraktMovie[]> {
  const data = await traktRequest<TraktTrendingMovieResponseItem[]>(
    '/movies/trending',
    {
      limit,
      // gets overview (full) plus images object
      extended: 'full,images',
    },
  );

  if (!Array.isArray(data)) return [];

  return data.map(item => mapMediaEntity(item.movie));
}

export async function getPopularMovies(limit = 10): Promise<TraktMovie[]> {
  const data = await traktRequest<TraktMovieEntity[]>('/movies/popular', {
    limit,
    extended: 'full,images',
  });

  if (!Array.isArray(data)) return [];
  return data.map(mapMediaEntity);
}

export async function getAnticipatedMovies(
  limit = 10,
): Promise<TraktMovie[]> {
  const data = await traktRequest<TraktAnticipatedMovieResponseItem[]>(
    '/movies/anticipated',
    {
      limit,
      extended: 'full,images',
    },
  );

  if (!Array.isArray(data)) return [];
  return data.map(item => mapMediaEntity(item.movie));
}

export async function getTrendingShows(limit = 10): Promise<TraktShow[]> {
  const data = await traktRequest<TraktTrendingShowResponseItem[]>(
    '/shows/trending',
    {
      limit,
      extended: 'full,images',
    },
  );

  if (!Array.isArray(data)) return [];
  return data.map(item => mapMediaEntity(item.show));
}

export async function getPopularShows(limit = 10): Promise<TraktShow[]> {
  const data = await traktRequest<TraktShowEntity[]>('/shows/popular', {
    limit,
    extended: 'full,images',
  });

  if (!Array.isArray(data)) return [];
  return data.map(mapMediaEntity);
}

export async function getAnticipatedShows(limit = 10): Promise<TraktShow[]> {
  const data = await traktRequest<TraktAnticipatedShowResponseItem[]>(
    '/shows/anticipated',
    {
      limit,
      extended: 'full,images',
    },
  );

  if (!Array.isArray(data)) return [];
  return data.map(item => mapMediaEntity(item.show));
}

export async function getRecommendedMovies(
  authToken: string,
  limit = 10,
): Promise<TraktMovie[]> {
  const data = await traktRequest<TraktMovieEntity[]>('/recommendations/movies', {
    limit,
    extended: 'full,images',
  }, authToken);
  if (!Array.isArray(data)) return [];
  return data.map(mapMediaEntity);
}

export async function getRecommendedShows(
  authToken: string,
  limit = 10,
): Promise<TraktShow[]> {
  const data = await traktRequest<TraktShowEntity[]>('/recommendations/shows', {
    limit,
    extended: 'full,images',
  }, authToken);
  if (!Array.isArray(data)) return [];
  return data.map(mapMediaEntity);
}

export async function getUpNextShows(
  authToken: string,
  limit = 10,
): Promise<TraktShow[]> {
  const data = await traktRequest<any[]>(
    '/sync/watched/shows',
    {
      limit,
      extended: 'full,images',
    },
    authToken,
  );
  if (!Array.isArray(data)) return [];
  return data
    .map(item => (item && item.show ? item.show : null))
    .filter(Boolean)
    .map((s: any) => mapMediaEntity(s as TraktMediaEntity));
}

export async function getShowSeasons(
  showIdOrSlug: string | number,
): Promise<TraktSeason[]> {
  const showKey = encodeURIComponent(String(showIdOrSlug));
  const data = await traktRequest<any[]>(
    `/shows/${showKey}/seasons`,
    {
      // includes episodes array inside each season
      extended: 'episodes,full',
    },
  );

  if (!Array.isArray(data)) return [];

  const seasons: TraktSeason[] = data
    .filter(s => s && typeof s.number === 'number')
    .map((s: any): TraktSeason => {
      const episodesRaw = Array.isArray(s.episodes) ? s.episodes : [];
      const episodes: TraktEpisode[] = episodesRaw
        .filter((e: any) => e)
        .map(
          (e: any): TraktEpisode => ({
            season: typeof e.season === 'number' ? e.season : s.number,
            number: typeof e.number === 'number' ? e.number : undefined,
            title: e.title || '',
            overview: e.overview || '',
            rating: typeof e.rating === 'number' ? e.rating : undefined,
            runtime: typeof e.runtime === 'number' ? e.runtime : undefined,
          }),
        );
      episodes.sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

      return {
        number: s.number,
        episodes,
      };
    });
  seasons.sort((a, b) => a.number - b.number);
  return seasons;
}
