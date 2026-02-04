# FantasyPhish Mobile

Flutter mobile app for FantasyPhish - Pick 13 songs before each Phish show and compete on the leaderboard.

## Features

- **Onboarding Flow**: 3-screen intro explaining the game
- **Authentication**: Login, register, and email verification
- **Pick Songs**: Select opener (3 pts), encore (3 pts), and 11 regular songs (1 pt each)
- **Live Updates**: Real-time scoring during shows
- **Results History**: View your past submissions and stats
- **Leaderboard**: Compete with other fans on tour-based leaderboards
- **Profile**: View stats and manage settings

## Prerequisites

Before you begin, ensure you have:

- **Flutter SDK** (3.2.0 or higher): [Install Flutter](https://docs.flutter.dev/get-started/install)
- **Xcode** (for iOS development): Available on Mac App Store
- **Android Studio** (for Android development): [Download](https://developer.android.com/studio)
- **Running FantasyPhish API**: The web app must be running locally or deployed

## Installation

### 1. Install Flutter

```bash
# macOS (using Homebrew)
brew install flutter

# Verify installation
flutter doctor
```

Run `flutter doctor` and follow any instructions to complete setup (Xcode command line tools, Android SDK, etc.).

### 2. Install Dependencies

```bash
cd mobile
flutter pub get
```

### 3. Generate Code

The app uses code generation for JSON serialization and API clients:

```bash
# Generate *.g.dart files
flutter pub run build_runner build --delete-conflicting-outputs

# Or watch for changes during development
flutter pub run build_runner watch --delete-conflicting-outputs
```

### 4. Configure API URL

Edit `mobile/lib/services/dio_client.dart` and update the API base URL:

```dart
// For local development on iOS simulator
const baseUrl = 'http://localhost:3000';

// For Android emulator (localhost on host machine)
const baseUrl = 'http://10.0.2.2:3000';

// For physical device (use your computer's local IP)
const baseUrl = 'http://192.168.1.XXX:3000';

// For production
const baseUrl = 'https://fantasyphish.com';
```

Or set it via environment variable:

```bash
flutter run --dart-define=API_URL=http://192.168.1.100:3000
```

## Running the App

### iOS Simulator

```bash
# List available iOS simulators
flutter devices

# Run on iOS simulator
flutter run -d "iPhone 15 Pro"
```

### Android Emulator

```bash
# List available Android emulators
flutter emulators

# Launch an emulator
flutter emulators --launch Pixel_7_API_34

# Run on Android emulator
flutter run
```

### Physical Device

**iOS:**

1. Connect your iPhone via USB
2. Open Xcode and configure signing (Xcode → Preferences → Accounts)
3. Run: `flutter run`

**Android:**

1. Enable Developer Mode on your Android device
2. Enable USB Debugging
3. Connect via USB
4. Run: `flutter run`

## Building for Release

### iOS (requires Mac and Apple Developer account)

```bash
# Build for App Store
flutter build ios --release

# Or build IPA
flutter build ipa
```

The IPA file will be at `build/ios/ipa/*.ipa`. Upload to App Store Connect using Xcode or Transporter.

### Android

```bash
# Build APK
flutter build apk --release

# Build App Bundle (for Google Play)
flutter build appbundle --release
```

The outputs will be at:

- APK: `build/app/outputs/flutter-apk/app-release.apk`
- AAB: `build/app/outputs/bundle/release/app-release.aab`

## Project Structure

```
mobile/
├── lib/
│   ├── main.dart                   # App entry point
│   ├── models/                     # Data models
│   │   ├── user.dart
│   │   ├── show.dart
│   │   ├── song.dart
│   │   ├── submission.dart
│   │   ├── pick.dart
│   │   ├── tour.dart
│   │   └── leaderboard.dart
│   ├── services/                   # API and business logic
│   │   ├── api_service.dart       # Retrofit API client
│   │   ├── dio_client.dart        # Dio HTTP client
│   │   └── auth_service.dart      # Authentication
│   ├── providers/                  # Riverpod state management
│   │   └── auth_provider.dart
│   ├── router/                     # Navigation
│   │   └── app_router.dart        # GoRouter configuration
│   ├── screens/                    # UI screens
│   │   ├── onboarding/
│   │   ├── auth/                  # Login, register, verify
│   │   ├── picks/                 # Main picks screen
│   │   ├── results/               # Submission history
│   │   ├── leaderboard/           # Tour leaderboard
│   │   ├── profile/               # User profile
│   │   └── main_screen.dart       # Bottom navigation
│   ├── widgets/                    # Reusable widgets
│   │   ├── donut_logo.dart
│   │   ├── loading_donut.dart
│   │   ├── live_badge.dart
│   │   └── error_view.dart
│   ├── theme/                      # App styling
│   │   └── app_theme.dart
│   └── utils/                      # Helper functions
│       └── date_utils.dart
├── android/                        # Android-specific config
├── ios/                           # iOS-specific config
├── assets/                        # Images and resources
└── pubspec.yaml                   # Dependencies
```

## Key Dependencies

- **flutter_riverpod**: State management
- **go_router**: Declarative routing
- **dio**: HTTP client
- **retrofit**: Type-safe API client
- **flutter_secure_storage**: Secure token storage
- **json_annotation**: JSON serialization
- **intl**: Date/time formatting
- **timezone**: Timezone handling

## Development Tips

### Hot Reload

While the app is running, press `r` to hot reload or `R` to hot restart.

### Debugging

```bash
# Run with debug output
flutter run --verbose

# Open DevTools
flutter pub global activate devtools
flutter pub global run devtools
```

### Code Generation

After modifying models or API service:

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

### Linting

```bash
# Analyze code
flutter analyze

# Format code
flutter format lib/
```

## Common Issues

### iOS: "Unable to install app"

Run `flutter clean && flutter pub get` and try again.

### Android: "Gradle build failed"

1. Update Android Gradle Plugin in `android/build.gradle`
2. Run `flutter clean`
3. Run `cd android && ./gradlew clean`

### API Connection Issues

- **iOS Simulator**: Use `http://localhost:3000`
- **Android Emulator**: Use `http://10.0.2.2:3000` (emulator's special alias for host)
- **Physical Device**: Use your computer's local IP address (e.g., `http://192.168.1.100:3000`)

### NextAuth Cookie Issues

The app handles NextAuth cookies automatically via `dio_cookie_manager`. Make sure:

1. Your API is accessible from the mobile device
2. CORS is properly configured on your Next.js API
3. Cookies are enabled in your API responses

## Deployment

### iOS App Store

1. Set up app in App Store Connect
2. Configure signing in Xcode
3. Build: `flutter build ipa`
4. Upload IPA via Xcode or Transporter
5. Submit for review

### Google Play Store

1. Create app in Google Play Console
2. Generate signing key:
   ```bash
   keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
3. Configure signing in `android/app/build.gradle`
4. Build: `flutter build appbundle`
5. Upload AAB to Play Console
6. Submit for review

## Environment Configuration

Create different build variants for development, staging, and production:

**Development:**

```bash
flutter run --dart-define=API_URL=http://localhost:3000 --dart-define=ENV=dev
```

**Production:**

```bash
flutter run --dart-define=API_URL=https://fantasyphish.com --dart-define=ENV=prod
```

## License

MIT

## Support

For issues or questions:

- Open an issue in the GitHub repository
- Email: chalupa@fantasyphish.com
