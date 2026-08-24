import * as SQLite from 'expo-sqlite';

import { runMigrations } from '@/db/migrations';

const DATABASE_NAME = 'mototracker.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }

  return databasePromise;
}

export function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const database = await openDatabase();

      await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      await runMigrations(database);

      return database;
    })().catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  }

  return initializationPromise;
}

export async function getDatabase() {
  return initializeDatabase();
}

