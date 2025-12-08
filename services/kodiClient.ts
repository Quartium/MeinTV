// Helper to launch Kodi and trigger an Elementum search.
// Uses native helper to send plugin intent + JSON-RPC (works even if RN is backgrounded).
import { NativeModules, Platform, ToastAndroid } from 'react-native';

type TvAppsNative = {
  launchApp?: (pkg: string) => Promise<any>;
  openKodiPlugin?: (pluginUrl: string) => Promise<any>;
  searchElementum?: (
    title: string,
    host: string,
    port: number,
    user: string,
    pass: string,
    tmdbId?: number,
  ) => Promise<any>;
};

const { TvApps } = NativeModules as { TvApps?: TvAppsNative };

const KODI_PACKAGE = 'org.xbmc.kodi';
const KODI_HOST = '192.168.100.12';
const KODI_PORT = 8080;
const KODI_USER = 'kodi';
const KODI_PASS = '0000';
const BASIC_AUTH = 'Basic a29kaTowMDAw'; // precomputed base64 for kodi:0000
const KODI_ENDPOINT = `http://${KODI_HOST}:${KODI_PORT}/jsonrpc`;

export type PlayableMovie = {
  id: string;
  title: string;
  tmdbId?: number;
};

export function triggerElementumSearch(title: string) {
  return playInKodiWithElementum({ id: title, title });
}

export async function playInKodiWithElementum(movie: PlayableMovie) {
  if (!movie.title) return;

  const pingOk = await sendKodiNotification(
    'MeinTV',
    'Pinging Kodi before search…',
  );

  if (!pingOk) {
    showToast('Kodi not reachable yet; still trying…');
  } else {
    showToast('Kodi reachable, opening search…');
  }

  let kickedOff = false;

  if (Platform.OS === 'android' && TvApps?.searchElementum) {
    try {
      await TvApps.searchElementum(
        movie.title,
        KODI_HOST,
        KODI_PORT,
        KODI_USER,
        KODI_PASS,
        movie.tmdbId,
      );
      kickedOff = true;
      // Let the native WorkManager flow handle Kodi; avoid extra intents that might bounce focus back.
      return;
    } catch (e) {
      console.warn('Native searchElementum failed, falling back', e);
      showToast('Kodi request fallback triggered');
    }
  }

  const hasTmdb = typeof movie.tmdbId === 'number' && movie.tmdbId > 0;
  const pluginUrl = hasTmdb
    ? `plugin://plugin.video.elementum/library/play/movie/${movie.tmdbId}`
    : `plugin://plugin.video.elementum/movies/search?q=${encodeURIComponent(
        movie.title,
      )}`;
  const fallbackUrl = hasTmdb
    ? pluginUrl
    : `plugin://plugin.video.elementum/search?q=${encodeURIComponent(
        movie.title,
      )}`;

  // Try direct plugin intent (best chance while app is foreground)
  if (Platform.OS === 'android' && TvApps?.openKodiPlugin) {
    try {
      await TvApps.openKodiPlugin(pluginUrl);
      kickedOff = true;
      return;
    } catch (e) {
      console.warn('Kodi plugin intent failed, falling back to JSON-RPC', e);
    }
  }

  // Otherwise, launch Kodi then try JSON-RPC after a short delay
  if (Platform.OS === 'android' && TvApps?.launchApp) {
    try {
      await TvApps.launchApp(KODI_PACKAGE);
    } catch (e) {
      console.warn('Failed to launch Kodi', e);
    }
  }

  const ok = await jsonRpcOpen(pluginUrl);
  let succeeded = ok;
  if (!ok && !hasTmdb) {
    const fallbackOk = await jsonRpcOpen(fallbackUrl);
    succeeded = fallbackOk;
  }

  if (succeeded) {
    kickedOff = true;
    showToast('Sent search to Kodi');
  } else if (!kickedOff) {
    showToast('Failed to send to Kodi');
  }
}

async function jsonRpcOpen(pluginUrl: string): Promise<boolean> {
  const payload = {
    jsonrpc: '2.0',
    id: 1,
    method: 'Player.Open',
    params: {
      item: {
        file: pluginUrl,
      },
    },
  };

  const endpoint = `http://${KODI_HOST}:${KODI_PORT}/jsonrpc`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: BASIC_AUTH,
  };

  // Retry a few times in case Kodi is still starting
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await delay(800);
    }
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      return true;
    } catch (e) {
      if (attempt === 2) {
        console.warn('Kodi JSON-RPC request failed after retries', e);
      }
    }
  }
  return false;
}

async function sendKodiNotification(
  title: string,
  message: string,
): Promise<boolean> {
  const payload = {
    jsonrpc: '2.0',
    id: 99,
    method: 'GUI.ShowNotification',
    params: { title, message },
  };

  try {
    const res = await fetchWithTimeout(KODI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: BASIC_AUTH,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (e) {
    console.warn('Kodi notification failed', e);
    return false;
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 2500,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // @ts-ignore AbortController not fully typed in RN fetch
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showToast(msg: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(msg, ToastAndroid.SHORT);
  } else {
    console.log(msg);
  }
}
