import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme/theme';

import { initializeDatabase } from './migrations';
import { createRepositories, type Repositories } from './repositories';

const RepositoryContext = createContext<Repositories | null>(null);

// Keep a single connection across renders and retries; migrations never erase data.
let connection: ReturnType<typeof openDatabaseAsync> | undefined;
let initialization: Promise<Repositories> | undefined;
async function initializeRepositories() {
  connection ??= openDatabaseAsync('calories-counter.db').catch((error) => {
    connection = undefined;
    throw error;
  });
  const db = await connection;
  await initializeDatabase(db);
  return createRepositories(db, randomUUID);
}

function loadRepositories() {
  initialization ??= initializeRepositories().catch((error) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
}

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [repositories, setRepositories] = useState<Repositories | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    loadRepositories().then((value) => {
      if (active) setRepositories(value);
    }).catch((error: unknown) => {
      console.error('Database initialization failed', error);
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, [attempt]);

  if (!repositories) {
    return (
      <View style={styles.status}>
        {failed ? (
          <>
            <Text accessibilityRole="alert" style={styles.message}>
              Your local data could not be opened. Please try again.
            </Text>
            <Button title="Try again" color={theme.colors.accent} onPress={() => {
              setFailed(false);
              setAttempt((value) => value + 1);
            }} />
          </>
        ) : <ActivityIndicator accessibilityLabel="Opening local data" color={theme.colors.accent} />}
      </View>
    );
  }
  return <RepositoryContext.Provider value={repositories}>{children}</RepositoryContext.Provider>;
}

export function useRepositories() {
  const repositories = useContext(RepositoryContext);
  if (!repositories) throw new Error('useRepositories must be used within DatabaseProvider.');
  return repositories;
}

const styles = StyleSheet.create({
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16, backgroundColor: theme.colors.background },
  message: { fontSize: 17, lineHeight: 26, color: theme.colors.text, textAlign: 'center' },
});
