import { NativeModules } from 'react-native';

const { TvApps } = NativeModules as { TvApps?: any };

export async function loadFavoritePackages(): Promise<string[]> {
  if (TvApps?.getFavoritePackages) {
    try {
      const list = await TvApps.getFavoritePackages();
      if (Array.isArray(list)) {
        return list.filter((p: any) => typeof p === 'string');
      }
    } catch (_e) {
      // ignore
    }
  }
  return [];
}

export async function saveFavoritePackages(pkgs: string[]) {
  if (TvApps?.setFavoritePackages) {
    try {
      await TvApps.setFavoritePackages(pkgs);
    } catch (_e) {
      // ignore write errors
    }
  }
}
