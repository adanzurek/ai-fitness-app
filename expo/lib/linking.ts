import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';

export const APP_SCHEME = 'optimal';
export const redirectUri = makeRedirectUri({ scheme: APP_SCHEME, path: 'auth/callback' });

export const getCodeFromUrl = (url: string): string | null => {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams || {};
  return (query['code'] as string) ?? null;
};
