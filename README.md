# MotoTracker

MotoTracker is an Android-first, offline vehicle maintenance tracker built with Expo, React Native, Expo Router, and TypeScript.

## Current status

The runnable application shell, offline database foundation, vehicle profile flow, maintenance dashboard, odometer history, engine-oil tracking, chain-lubrication tracking, insurance expiry tracking, and revenue licence tracking are complete. Documents include renewal history and local reminders at 30, 14, 7, and 1 day before expiry in development and production builds. On startup, MotoTracker opens `mototracker.db`, enables foreign keys and write-ahead logging, and applies pending schema migrations.

Installed Expo-native modules:

- `expo-sqlite` for offline persistence
- `expo-notifications` for local document-expiry reminders
- `expo-image-picker` for optional vehicle photos
- `expo-file-system` for durable app-local image storage

The initial migration creates separate tables for vehicles, odometer history, maintenance history, maintenance settings, documents, notification reminders, and migration history. Later versioned migrations preserve existing data while extending the schema. Repository modules provide the only interface that feature screens use for database operations.

## Run the app

Requirements:

- Node.js LTS
- Android Studio with an emulator, or an Android device with Expo Go

Install and start:

```bash
npm install
npm run android
```

To start Metro without immediately opening Android:

```bash
npm start
```

Check TypeScript:

```bash
npm run typecheck
```

## Recommended structure

```text
src/
  app/                 Expo Router screens and route layouts
  components/          Reusable UI components
    ui/                Generic controls such as buttons and inputs
  constants/           Theme tokens and application constants
  db/                  SQLite connection, migrations, and repositories
  hooks/               Reusable React hooks
  models/              Domain models and TypeScript types
  services/            Notifications and application services
  utils/               Maintenance and date calculations
```

Feature route folders such as `history` and `settings` will be introduced with their corresponding features. Keeping the route tree focused prevents unfinished screens from becoming navigable routes. The next feature step is the combined maintenance history and manual maintenance-event flow.

## Architecture direction

- UI screens will call hooks or services, not SQLite directly.
- Repositories in `src/db` will own persistence operations.
- Business calculations will remain pure functions in `src/utils`.
- Database tables will use vehicle IDs from the start so multi-vehicle support can be added later without redesigning persistence.
