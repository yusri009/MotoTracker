# MotoTracker

MotoTracker is an Android-first, offline vehicle maintenance tracker built with Expo, React Native, Expo Router, and TypeScript.

## Current status

MotoTracker's first-version feature set is implemented:

- Multiple vehicle profiles with a persistent active-vehicle switcher
- Non-decreasing odometer updates and full reading history
- Engine-oil and chain-lubrication reminders with completion history
- Combined maintenance history and manual service, tyre, brake, battery, air-filter, and other events
- Insurance and revenue-licence expiry tracking with renewal history
- Configurable local expiry reminder days per vehicle and document type
- Portable JSON export of all user-entered data
- Branded Android icon, splash screen, native prebuild, and EAS build profiles

On startup, MotoTracker opens `mototracker.db`, enables foreign keys and write-ahead logging, and applies pending versioned migrations without clearing existing data.

Installed Expo-native modules:

- `expo-sqlite` for offline persistence
- `expo-notifications` for local document-expiry reminders
- `expo-image-picker` for optional vehicle photos
- `expo-file-system` for durable app-local image storage
- `expo-sharing` for portable JSON backup exports
- `expo-dev-client` for installable development builds with notification support
- `expo-splash-screen` and `expo-system-ui` for branded native startup and light/dark presentation

The initial migration creates separate tables for vehicles, odometer history, maintenance history, maintenance settings, documents, notification reminders, and migration history. Later versioned migrations preserve existing data while extending the schema. Repository modules provide the only interface that feature screens use for database operations.

## Run in Expo Go

Requirements:

- Node.js LTS
- Android Studio with an emulator, or an Android device with Expo Go

Install dependencies and start Metro:

```bash
npm install
npm start
```

Scan the QR code with Expo Go. All tracking and export features work there. Expo Go cannot load this project's notification runtime, so expiry alerts are scheduled only in development and production builds.

## Android development build

A full Android SDK with a platform and build-tools is required:

```bash
npm run prebuild:android
npm run android
npm run start:dev-client
```

The generated `android` folder is intentionally ignored and can always be recreated from `app.json`.

## EAS preview and production builds

Authenticate once, then choose an APK preview or Play Store app bundle:

```bash
npx eas-cli login
npm run build:android:preview
npm run build:android:production
```

The `preview` profile creates an internally distributable APK. The `production` profile creates an Android App Bundle and auto-increments the version code.

## Verification

```bash
npm run typecheck
EXPO_NO_TELEMETRY=1 npx expo install --check
EXPO_NO_TELEMETRY=1 npx expo export --platform android
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

## Architecture

- UI screens call repositories and application services rather than embedding SQLite statements.
- Repository tables remain separated by concern and use foreign keys with vehicle IDs.
- Business calculations remain pure functions in `src/utils`.
- Notification imports are guarded so Expo Go remains usable while installed builds retain local scheduling.
- Backup files exclude device-specific notification identifiers and vehicle image binaries; all user-entered records and preferences are included.
