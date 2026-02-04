# FantasyPhish Mobile - Quick Start

Get the mobile app running in 5 minutes!

## Prerequisites

1. **Install Flutter**: https://docs.flutter.dev/get-started/install
2. **Verify installation**: `flutter doctor`
3. **Have your FantasyPhish API running** (web app from parent directory)

## Quick Setup

```bash
# 1. Navigate to mobile directory
cd mobile

# 2. Install dependencies
flutter pub get

# 3. Generate code (JSON serialization)
flutter pub run build_runner build --delete-conflicting-outputs

# 4. Run on iOS simulator (macOS only)
flutter run -d "iPhone 15 Pro"

# OR run on Android emulator
flutter run
```

## Configure API URL

**Option 1: Edit code directly**

Edit `lib/services/dio_client.dart` line 23:

```dart
// For iOS simulator
const baseUrl = 'http://localhost:3000';

// For Android emulator
const baseUrl = 'http://10.0.2.2:3000';

// For physical device (use your computer's IP)
const baseUrl = 'http://192.168.1.XXX:3000';
```

**Option 2: Use environment variable**

```bash
flutter run --dart-define=API_URL=http://192.168.1.100:3000
```

## Testing the App

1. **Onboarding**: You'll see 3 intro screens → tap "Get Started"
2. **Register**: Create an account with email, username, password
3. **Verify Email**: Check your email for verification code (or check your API logs)
4. **Login**: Login with your credentials
5. **Picks**: You'll see the next show and can select your 13 songs
6. **Bottom Nav**: Switch between Picks, Results, Leaderboard, Profile

## Common Issues

### "flutter: command not found"

Add Flutter to your PATH:

```bash
# Add to ~/.zshrc or ~/.bashrc
export PATH="$PATH:/path/to/flutter/bin"
```

### iOS: "Unable to boot device"

```bash
# List available simulators
xcrun simctl list devices

# Boot a simulator
xcrun simctl boot "iPhone 15 Pro"
```

### Android: "No devices found"

```bash
# Create an emulator
flutter emulators --create --name pixel_7

# Launch it
flutter emulators --launch pixel_7
```

### "Cannot connect to API"

- **iOS**: Use `http://localhost:3000`
- **Android**: Use `http://10.0.2.2:3000` (special alias for host machine)
- **Physical device**: Find your computer's IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux)

### Code generation errors

If you see "missing .g.dart files":

```bash
flutter pub run build_runner build --delete-conflicting-outputs
```

## Development Workflow

### Hot Reload

While app is running, press:

- `r` = hot reload (fast, keeps state)
- `R` = hot restart (full restart)
- `q` = quit

### Watch Mode for Code Generation

Run this in a separate terminal to auto-generate on file changes:

```bash
flutter pub run build_runner watch --delete-conflicting-outputs
```

### Debugging

```bash
# Verbose output
flutter run --verbose

# Debug specific device
flutter run -d <device-id>

# List all devices
flutter devices
```

## Next Steps

- Read full [README.md](README.md) for deployment instructions
- Customize app icons in `assets/images/`
- Configure push notifications (optional)
- Set up CI/CD for automated builds
- Submit to App Store and Google Play

## Need Help?

- Flutter Docs: https://docs.flutter.dev
- Dart Docs: https://dart.dev/guides
- FantasyPhish Issues: https://github.com/yourusername/fantasyphish/issues

Happy coding! 🍩
