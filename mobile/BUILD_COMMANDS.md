# Build Commands Reference

## Development

### Run on Simulator/Emulator

```bash
# iOS simulator
flutter run -d "iPhone 15 Pro"

# Android emulator
flutter run

# With custom API URL
flutter run --dart-define=API_URL=http://192.168.1.100:3000
```

### Generate Code (after model changes)

```bash
# One-time generation
flutter pub run build_runner build --delete-conflicting-outputs

# Watch mode (auto-generates on file save)
flutter pub run build_runner watch --delete-conflicting-outputs
```

### Clean Build

```bash
flutter clean
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
flutter run
```

## Testing

```bash
# Run all tests
flutter test

# Run specific test
flutter test test/auth_test.dart

# Run with coverage
flutter test --coverage
```

## Production Builds

### iOS

```bash
# Build for App Store
flutter build ios --release

# Build IPA file
flutter build ipa --release

# With specific version
flutter build ipa --release --build-name=1.0.0 --build-number=1
```

### Android

```bash
# Build APK (for sideloading/testing)
flutter build apk --release

# Build App Bundle (for Google Play)
flutter build appbundle --release

# Build APK split by ABI (smaller files)
flutter build apk --split-per-abi --release

# With specific version
flutter build appbundle --release --build-name=1.0.0 --build-number=1
```

## Debugging

```bash
# Run with verbose output
flutter run --verbose

# Run in profile mode (performance testing)
flutter run --profile

# Debug specific device
flutter devices  # list devices
flutter run -d <device-id>

# Attach debugger to running app
flutter attach

# Open DevTools
flutter pub global activate devtools
flutter pub global run devtools
```

## Code Quality

```bash
# Analyze code
flutter analyze

# Format code
flutter format lib/

# Check for outdated packages
flutter pub outdated

# Upgrade packages
flutter pub upgrade
```

## Troubleshooting

```bash
# Doctor check
flutter doctor -v

# Clean everything
flutter clean
cd ios && pod cache clean --all && cd ..
rm -rf pubspec.lock
rm -rf .dart_tool/
flutter pub get

# iOS specific
cd ios
pod deintegrate
pod install
cd ..

# Android specific
cd android
./gradlew clean
cd ..
```

## Useful Aliases

Add to your `.zshrc` or `.bashrc`:

```bash
alias fl='flutter'
alias flr='flutter run'
alias flc='flutter clean'
alias flt='flutter test'
alias flb='flutter pub run build_runner build --delete-conflicting-outputs'
alias flw='flutter pub run build_runner watch --delete-conflicting-outputs'
```
