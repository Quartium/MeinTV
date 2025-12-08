import { NativeModules } from 'react-native';

const { TraktAuth } = NativeModules as any;

export type DeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

export type TraktToken = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  created_at: number;
};

export async function requestDeviceCode(): Promise<DeviceCodeResponse | null> {
  if (!TraktAuth?.requestDeviceCode) return null;
  try {
    const res = await TraktAuth.requestDeviceCode();
    return typeof res === 'string' ? JSON.parse(res) : res;
  } catch (e) {
    console.warn('requestDeviceCode error', e);
    return null;
  }
}

export async function pollForToken(deviceCode: string): Promise<TraktToken | null> {
  if (!TraktAuth?.pollForToken) return null;
  try {
    const res = await TraktAuth.pollForToken(deviceCode);
    return typeof res === 'string' ? JSON.parse(res) : res;
  } catch (e) {
    console.warn('pollForToken error', e);
    return null;
  }
}

export async function loadStoredToken(): Promise<TraktToken | null> {
  if (!TraktAuth?.getStoredToken) return null;
  try {
    const tok = await TraktAuth.getStoredToken();
    if (!tok) return null;
    return typeof tok === 'string' ? JSON.parse(tok) : tok;
  } catch (_e) {
    return null;
  }
}

export async function clearStoredToken() {
  if (TraktAuth?.clearToken) {
    try {
      await TraktAuth.clearToken();
    } catch (_e) {}
  }
}

export function isTokenValid(token: TraktToken | null): boolean {
  if (!token?.access_token || !token.created_at || !token.expires_in) return false;
  const now = Math.floor(Date.now() / 1000);
  return now < token.created_at + token.expires_in - 60; // 1 min buffer
}
