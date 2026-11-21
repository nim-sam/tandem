import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { API } from '../api/client';
import { useAppTheme } from '../theme';

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

// Google Calendar sync. With client IDs configured it signs in and syncs for
// real (events added or edited afterwards are mirrored to Google). Without
// them it can only load clearly-labelled demo events.
export const GoogleSync: React.FC<Props> = (props) => {
  const theme = useAppTheme();
  const [busy, setBusy] = useState(false);
  if (WEB_ID) return <SignedSync {...props} />;

  const loadDemo = () => {
    setBusy(true);
    API.syncGoogleCalendar()
      .then((r) =>
        props.onSynced(
          r.simulated
            ? `Loaded ${r.events_synced} demo events for today. No Google account was contacted.`
            : `Synced ${r.events_synced} events from Google Calendar.`
        )
      )
      .catch((e) => props.onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <View style={{ gap: 4 }}>
      <Button mode="outlined" icon="google" loading={busy} disabled={busy} onPress={loadDemo}>
        Load demo Google events
      </Button>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        Google sign-in is not set up (no client ID in .env), so this loads sample events only.
      </Text>
    </View>
  );
};
