import React, { useEffect, useState } from 'react';
import { Button } from 'react-native-paper';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { API } from '../api/client';

WebBrowser.maybeCompleteAuthSession();

// OAuth client IDs from Google Cloud Console (APIs & Services > Credentials),
// with the Google Calendar API enabled. Set them in frontend/.env.
const WEB_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
const ANDROID_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? WEB_ID;
const IOS_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? WEB_ID;

interface Props {
  onSynced: (message: string) => void;
  onError: (message: string) => void;
}

const SignedSync: React.FC<Props> = ({ onSynced, onError }) => {
  const [busy, setBusy] = useState(false);
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: WEB_ID,
    webClientId: WEB_ID,
    androidClientId: ANDROID_ID,
    iosClientId: IOS_ID,
    scopes: ['https://www.googleapis.com/auth/calendar.events'],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'error') {
      onError(response.error?.message ?? 'Google sign-in failed.');
      return;
    }
    if (response.type !== 'success') return;
    const token = response.authentication?.accessToken;
    if (!token) {
      onError('Google did not return an access token.');
      return;
    }
    setBusy(true);
    API.syncGoogleCalendar(token)
      .then((r) => onSynced(`Synced ${r.events_synced} events from Google Calendar (${r.events_added} new).`))
      .catch((e) => onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
    // callbacks are stable enough for this one-shot effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Button mode="contained-tonal" icon="google" disabled={!request || busy} loading={busy} onPress={() => promptAsync()}>
      Sync Google Calendar
    </Button>
  );
};

// Google Calendar sync: signs in and syncs (events added or edited afterwards
// are mirrored to Google). Shown only when client IDs are configured.
export const GoogleSync: React.FC<Props> = (props) => (WEB_ID ? <SignedSync {...props} /> : null);
