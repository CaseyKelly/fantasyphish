# Mobile App Setup

Fantasy Phish is available as native iOS and Android apps using Capacitor.

## Quick Start

### Development

```bash
# Sync Capacitor configuration to native projects
npm run cap:sync

# Open iOS in Xcode
npm run cap:open:ios

# Open Android in Android Studio
npm run cap:open:android

# Run on iOS simulator
npm run cap:run:ios

# Run on Android emulator
npm run cap:run:android
```

### How It Works

The mobile apps are configured to load your production website (`https://fantasyphish.com`) inside a native WebView. This means:

- **No static builds needed** - The app always shows your latest deployed website
- **Instant updates** - Changes to your website appear immediately in the app
- **Single codebase** - Same Next.js code powers web and mobile

### Native Features

The app includes native functionality:

1. **Push Notifications** - Via `@capacitor/push-notifications`
2. **Biometric Auth** - Via `@aparajita/capacitor-biometric-auth`
3. **Native App Icon & Splash Screen**

### Using Native Features in Code

```typescript
import {
  isNativePlatform,
  setupPushNotifications,
  authenticateWithBiometrics,
  isBiometricAvailable,
} from "@/lib/capacitor"

// Check if running as native app
if (isNativePlatform()) {
  // Setup push notifications
  await setupPushNotifications()

  // Check for biometric auth
  if (await isBiometricAvailable()) {
    const authenticated = await authenticateWithBiometrics(
      "Authenticate to continue"
    )
  }
}
```

## App Configuration

**App Name**: Fantasy Phish  
**Bundle ID**: com.fantasyphish.app  
**Server URL**: https://fantasyphish.com (from `NEXT_PUBLIC_APP_URL`)

Configuration is in `capacitor.config.ts`.

## Building for Release

### iOS

1. Open in Xcode: `npm run cap:open:ios`
2. Select "Any iOS Device (arm64)" as target
3. Product > Archive
4. Distribute to App Store

### Android

1. Open in Android Studio: `npm run cap:open:android`
2. Build > Generate Signed Bundle / APK
3. Select "Android App Bundle"
4. Upload to Google Play Console

See [APP_STORE_SUBMISSION_GUIDE.md](./APP_STORE_SUBMISSION_GUIDE.md) for complete instructions.

## Icons & Splash Screens

App icons and splash screens are auto-generated from `resources/icon.png`:

```bash
npx @capacitor/assets generate
```

This creates all required sizes for iOS, Android, and PWA.

## Permissions

### iOS (Info.plist)

- Face ID: `NSFaceIDUsageDescription`
- Push Notifications: `UIBackgroundModes` (remote-notification)

### Android (AndroidManifest.xml)

- Internet: `android.permission.INTERNET`
- Notifications: `android.permission.POST_NOTIFICATIONS`
- Biometric: `android.permission.USE_BIOMETRIC`

## Expected Console Messages

When running the iOS app in Xcode, you'll see some console messages that are normal:

- `UIScene lifecycle will soon be required` - iOS warning, can be ignored
- `Failed to resolve host network app id` - WebKit internal message, harmless
- `⚡️ Loading app at https://fantasyphish.com...` - This confirms the app is loading
- `WebContent process took X seconds to launch` - Normal on first launch
- `TypeError: undefined is not an object (evaluating 'window.Capacitor.triggerEvent')` - Can occur during page transitions, Capacitor bridge is injected after page load

If the app loads and you can navigate/interact normally, everything is working correctly!

## Troubleshooting

### Sync Errors

```bash
# Create missing Android assets directory
mkdir -p android/app/src/main/assets

# Re-sync
npm run cap:sync
```

### iOS Pod Install Issues

If you see CocoaPods warnings, install pods manually:

```bash
cd ios/App
pod install
cd ../..
```

### Update Everything

```bash
npm run mobile:setup
```

This runs `cap sync` and `cap update` to refresh native dependencies.

## Testing

Test on physical devices for the best experience:

- **iOS**: Xcode > Product > Destination > Your connected iPhone
- **Android**: Android Studio > Select your connected device

Simulators/emulators work but have limited biometric and push notification support.

### Testing Native Features

#### 1. Biometric Authentication

**On the login page:**

- Log in with your email and password
- When prompted, choose to enable biometric login
- Next time, you'll see a "Sign in with Face ID/Touch ID/Fingerprint" button
- Tap it to test biometric authentication

**On the test page:**

- Navigate to `/test-mobile` in the app
- Tap "Test Biometric Authentication"
- Your device will prompt for Face ID, Touch ID, or fingerprint
- Results will show whether authentication succeeded

**iOS Simulator Testing:**

- Face ID can be simulated: Features > Face ID > Enrolled
- After enrollment, use Features > Face ID > Matching Face to simulate success
- Or Features > Face ID > Non-matching Face to simulate failure

#### 2. Push Notifications

**Setup:**

1. Navigate to `/test-mobile` in the app
2. Tap "Setup Push Notifications"
3. Allow permissions when prompted
4. Your device token will be printed to the Xcode/Android Studio console
5. Look for a line like: `Push registration success, token: xxxxxxxxxx`

**Testing push notifications requires:**

- **iOS**: APNs (Apple Push Notification service) certificate setup
- **Android**: Firebase Cloud Messaging (FCM) setup
- A backend service to send test notifications

For now, the test page confirms permissions work and logs the device token.

**iOS Simulator Notes:**

- Push notifications don't work in the iOS Simulator
- You need a real iPhone to test push notifications
- The simulator will show permission dialogs but won't receive actual notifications

**Android Emulator Notes:**

- Push notifications require Google Play Services
- Use an emulator image with Play Store support
- Or test on a real Android device

## Resources

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Biometric Auth Plugin](https://github.com/aparajita/capacitor-biometric-auth)
- [App Store Submission Guide](./APP_STORE_SUBMISSION_GUIDE.md)
