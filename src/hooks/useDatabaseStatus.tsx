import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { databaseService } from '@/services/databaseService';

type DatabaseState = 'initializing' | 'ready' | 'error';

interface DatabaseStatusValue {
  state: DatabaseState;
  error: string | null;
  retry: () => void;
}

const DatabaseStatusContext = createContext<DatabaseStatusValue | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DatabaseState>('initializing');
  const [error, setError] = useState<string | null>(null);

  const initialize = useCallback(() => {
    setState('initializing');
    setError(null);

    void databaseService.initialize().then(
      () => setState('ready'),
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : 'Unknown database error');
        setState('error');
      },
    );
  }, []);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const value = useMemo(
    () => ({ state, error, retry: initialize }),
    [error, initialize, state],
  );

  return <DatabaseStatusContext.Provider value={value}>{children}</DatabaseStatusContext.Provider>;
}

export function useDatabaseStatus() {
  const value = useContext(DatabaseStatusContext);

  if (!value) {
    throw new Error('useDatabaseStatus must be used inside DatabaseProvider.');
  }

  return value;
}

