import type { SQLiteDatabase } from 'expo-sqlite';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_initial_schema',
    sql: `
      CREATE TABLE vehicles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        registration_number TEXT NOT NULL COLLATE NOCASE UNIQUE,
        current_odometer INTEGER NOT NULL DEFAULT 0 CHECK (current_odometer >= 0),
        image_uri TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE odometer_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        odometer INTEGER NOT NULL CHECK (odometer >= 0),
        recorded_at TEXT NOT NULL,
        note TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE TABLE maintenance_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (
          type IN (
            'OIL_CHANGE',
            'CHAIN_LUBRICATION',
            'SERVICE',
            'TYRE_CHANGE',
            'BRAKE_MAINTENANCE',
            'BATTERY',
            'AIR_FILTER',
            'OTHER'
          )
        ),
        serviced_at TEXT NOT NULL,
        odometer INTEGER NOT NULL CHECK (odometer >= 0),
        cost REAL CHECK (cost IS NULL OR cost >= 0),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE TABLE maintenance_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('ENGINE_OIL', 'CHAIN_LUBRICATION')),
        last_service_odometer INTEGER NOT NULL CHECK (last_service_odometer >= 0),
        interval_km INTEGER NOT NULL CHECK (interval_km > 0),
        last_service_date TEXT NOT NULL,
        due_soon_threshold_km INTEGER NOT NULL DEFAULT 300 CHECK (due_soon_threshold_km >= 0),
        product_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (vehicle_id, kind),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE TABLE documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('INSURANCE', 'REVENUE_LICENCE')),
        provider TEXT,
        policy_number TEXT,
        start_date TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        cost REAL CHECK (cost IS NULL OR cost >= 0),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE TABLE notification_reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        days_before INTEGER NOT NULL CHECK (days_before >= 0),
        notification_identifier TEXT NOT NULL UNIQUE,
        scheduled_for TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (document_id, days_before),
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_odometer_history_vehicle_date
        ON odometer_history(vehicle_id, recorded_at DESC);

      CREATE INDEX idx_maintenance_records_vehicle_date
        ON maintenance_records(vehicle_id, serviced_at DESC);

      CREATE INDEX idx_documents_vehicle_expiry
        ON documents(vehicle_id, expiry_date);

      CREATE UNIQUE INDEX idx_documents_one_active_per_type
        ON documents(vehicle_id, type)
        WHERE is_active = 1;

      CREATE TRIGGER prevent_odometer_decrease
      BEFORE INSERT ON odometer_history
      FOR EACH ROW
      WHEN NEW.odometer < (
        SELECT current_odometer FROM vehicles WHERE id = NEW.vehicle_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'Odometer cannot be lower than the current reading');
      END;

      CREATE TRIGGER sync_vehicle_odometer
      AFTER INSERT ON odometer_history
      FOR EACH ROW
      BEGIN
        UPDATE vehicles
        SET current_odometer = NEW.odometer,
            updated_at = NEW.created_at
        WHERE id = NEW.vehicle_id;
      END;
    `,
  },
  {
    version: 2,
    name: 'add_last_service_cost',
    sql: `
      ALTER TABLE maintenance_settings
      ADD COLUMN last_service_cost REAL
      CHECK (last_service_cost IS NULL OR last_service_cost >= 0);
    `,
  },
  {
    version: 3,
    name: 'add_preferences_and_active_vehicle',
    sql: `
      CREATE TABLE document_reminder_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vehicle_id INTEGER NOT NULL,
        document_type TEXT NOT NULL CHECK (
          document_type IN ('INSURANCE', 'REVENUE_LICENCE')
        ),
        days_before INTEGER NOT NULL CHECK (days_before BETWEEN 0 AND 365),
        created_at TEXT NOT NULL,
        UNIQUE (vehicle_id, document_type, days_before),
        FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_document_reminder_preferences_vehicle
        ON document_reminder_preferences(vehicle_id, document_type);

      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
];

export async function runMigrations(database: SQLiteDatabase) {
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = await database.getFirstAsync<{ version: number }>(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
  );
  const currentVersion = applied?.version ?? 0;

  for (const migration of migrations) {
    if (migration.version <= currentVersion) {
      continue;
    }

    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(migration.sql);
      await transaction.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}
