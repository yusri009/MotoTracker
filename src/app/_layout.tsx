import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { DatabaseProvider } from '@/hooks/useDatabaseStatus';
import { configureNotificationPresentation } from '@/services/notificationService';

void configureNotificationPresentation();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <DatabaseProvider>
      <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen
            name="vehicle/edit"
            options={{
              title: 'Vehicle profile',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="vehicles/index"
            options={{
              title: 'My vehicles',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="odometer/update"
            options={{
              title: 'Odometer',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="maintenance/oil"
            options={{
              title: 'Engine oil',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="maintenance/chain"
            options={{
              title: 'Chain lubrication',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="maintenance/history"
            options={{
              title: 'Maintenance history',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="insurance/index"
            options={{
              title: 'Insurance',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="licence/index"
            options={{
              title: 'Revenue licence',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="settings/index"
            options={{
              title: 'Settings & data',
              headerShadowVisible: false,
            }}
          />
        </Stack>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
