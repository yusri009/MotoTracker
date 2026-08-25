import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Appearance,
  useColorScheme,
} from 'react-native';

import {
  appSettingRepository,
} from '@/db/repositories';
import type { ThemeMode } from '@/db/repositories/appSettingRepository';
import { useDatabaseStatus } from '@/hooks/useDatabaseStatus';

interface ThemePreferenceValue {
  themeMode: ThemeMode;
  isDark: boolean;
  ready: boolean;
  toggleTheme: () => Promise<void>;
}

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const database = useDatabaseStatus();
  const systemScheme = useColorScheme();
  const [selectedMode, setSelectedMode] = useState<ThemeMode | null>(null);
  const [ready, setReady] = useState(false);
  const themeMode = selectedMode ?? (systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    if (database.state !== 'ready') {
      setReady(false);
      return;
    }

    let active = true;
    void appSettingRepository.getThemeMode().then(
      (savedMode) => {
        if (!active) return;
        if (savedMode) {
          Appearance.setColorScheme(savedMode);
          setSelectedMode(savedMode);
        } else {
          setSelectedMode(systemScheme === 'dark' ? 'dark' : 'light');
        }
        setReady(true);
      },
      () => {
        if (active) setReady(true);
      },
    );

    return () => {
      active = false;
    };
  }, [database.state]);

  const toggleTheme = useCallback(async () => {
    if (database.state !== 'ready') return;

    const previousMode = themeMode;
    const nextMode: ThemeMode = previousMode === 'dark' ? 'light' : 'dark';
    Appearance.setColorScheme(nextMode);
    setSelectedMode(nextMode);

    try {
      await appSettingRepository.setThemeMode(nextMode);
    } catch (reason: unknown) {
      Appearance.setColorScheme(previousMode);
      setSelectedMode(previousMode);
      throw reason;
    }
  }, [database.state, themeMode]);

  const value = useMemo(
    () => ({ themeMode, isDark: themeMode === 'dark', ready, toggleTheme }),
    [ready, themeMode, toggleTheme],
  );

  return (
    <ThemePreferenceContext.Provider value={value}>
      {children}
    </ThemePreferenceContext.Provider>
  );
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) {
    throw new Error('useThemePreference must be used inside ThemePreferenceProvider.');
  }
  return value;
}
