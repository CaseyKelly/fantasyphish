# App Store Submission Guide

This guide will walk you through submitting Fantasy Phish to both the Apple App Store and Google Play Store.

## Prerequisites

### Required Accounts

1. **Apple Developer Program** (iOS)
   - Cost: $99/year
   - Sign up at: https://developer.apple.com/programs/
   - Processing time: 1-2 business days
   - You'll need:
     - Apple ID
     - Credit card
     - D-U-N-S Number (free, Apple helps you get one)

2. **Google Play Console** (Android)
   - Cost: $25 one-time fee
   - Sign up at: https://play.google.com/console/signup
   - Processing time: Usually instant
   - You'll need:
     - Google account
     - Credit card

### Required Software

- **Xcode** (for iOS builds) - Free from Mac App Store
  - You must have a Mac to build iOS apps
  - Install from: https://apps.apple.com/us/app/xcode/id497799835

- **Android Studio** (for Android builds) - Free
  - Optional but recommended for Android builds
  - Download from: https://developer.android.com/studio

## Local Testing

### Test on iOS Simulator

1. Open the iOS project in Xcode:

   ```bash
   npm run cap:open:ios
   ```

2. In Xcode:
   - Select a simulator device (e.g., iPhone 15 Pro)
   - Click the Play button or press Cmd+R
   - The app will launch in the simulator

3. Alternatively, run from CLI:
   ```bash
   npm run cap:run:ios
   ```

### Test on Android Emulator

1. Open Android Studio and create an emulator:
   - Tools > Device Manager
   - Create a new device (Pixel 7 or similar)

2. Start the emulator, then run:

   ```bash
   npm run cap:run:android
   ```

3. Or open in Android Studio:
   ```bash
   npm run cap:open:android
   ```
   Then click Run in Android Studio

### Important: The app is configured to load from your production URL

The app is set up to load content from `https://fantasyphish.com` (or whatever your `NEXT_PUBLIC_APP_URL` is set to). This means:

- No need to build static files
- Changes to your website automatically appear in the app
- The app essentially acts as a native wrapper around your web app

## iOS App Store Submission

### Step 1: Set Up App Store Connect

1. Go to https://appstoreconnect.apple.com/
2. Click "My Apps" > "+" > "New App"
3. Fill in the details:
   - **Platform**: iOS
   - **Name**: Fantasy Phish
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: com.fantasyphish.app (this must match your Capacitor config)
   - **SKU**: fantasyphish-001 (can be anything unique)

### Step 2: Prepare App Information

In App Store Connect, you'll need to provide:

1. **App Information**
   - Category: Games > Sports
   - Subcategory: Music
   - Content Rights: Check if applicable

2. **Pricing and Availability**
   - Price: Free
   - Availability: All countries or select specific ones

3. **App Privacy**
   - Privacy Policy URL: https://fantasyphish.com/privacy (you'll need to create this)
   - Data collection details (what user data you collect)

4. **Screenshots** (Required for each device size)
   - 6.7" iPhone (iPhone 15 Pro Max): 1290 x 2796 pixels
   - 6.5" iPhone: 1284 x 2778 pixels
   - 5.5" iPhone: 1242 x 2208 pixels
   - 12.9" iPad Pro: 2048 x 2732 pixels

   **Tip**: Take screenshots in the iOS Simulator:
   - Cmd+S to capture
   - Screenshots saved to Desktop

5. **App Description**

   ```
   Fantasy Phish - The ultimate fantasy game for Phish fans!

   Make your picks before each show and compete with friends to predict which songs the band will play. Earn points for correct predictions and climb the leaderboard.

   Features:
   - Pick songs before every show
   - Live scoring during concerts
   - Global and friends leaderboards
   - Achievement badges
   - Show history and statistics

   Join the community and prove you know Phish better than anyone!
   ```

6. **Keywords**: phish, fantasy, music, concert, setlist, jam band, prediction

7. **Support URL**: https://fantasyphish.com/support (create this page)

8. **Marketing URL** (optional): https://fantasyphish.com

### Step 3: Configure Xcode Project

1. Open the iOS project:

   ```bash
   npm run cap:open:ios
   ```

2. In Xcode, select the "App" project in the left sidebar

3. Under "Signing & Capabilities":
   - Enable "Automatically manage signing"
   - Select your Apple Developer team
   - Xcode will create provisioning profiles automatically

4. Update version numbers:
   - Version: 1.0
   - Build: 1

5. Add capabilities (if not already added):
   - Click "+ Capability"
   - Add "Push Notifications"
   - The biometric auth works automatically

### Step 4: Create Archive and Upload

1. In Xcode:
   - Select "Any iOS Device (arm64)" as the build target (not a simulator)
   - Menu: Product > Archive
   - Wait for archive to complete (5-10 minutes)

2. In the Organizer window that appears:
   - Select your archive
   - Click "Distribute App"
   - Select "App Store Connect"
   - Select "Upload"
   - Follow the wizard (keep default options)
   - Click "Upload"

3. Wait for processing (30-60 minutes)
   - You'll get an email when it's ready

### Step 5: Submit for Review

1. Return to App Store Connect
2. Go to your app > Version 1.0
3. In the "Build" section, click "+" and select your uploaded build
4. Fill in "What's New in This Version":

   ```
   Initial release of Fantasy Phish!
   - Make song predictions before every show
   - Live scoring and leaderboards
   - Track your achievements
   ```

5. Fill in the App Review Information:
   - Contact info (your email/phone)
   - Demo account (create a test account with login credentials for reviewers)
   - Notes: "This app requires knowledge of the band Phish to fully enjoy."

6. Click "Submit for Review"

### Step 6: Wait for Review

- Review time: 1-3 days typically
- You'll get status updates via email
- Common rejection reasons:
  - Missing privacy policy
  - Crashes on launch
  - Incomplete demo account
  - Broken links

## Google Play Store Submission

### Step 1: Set Up Google Play Console

1. Go to https://play.google.com/console/
2. Click "Create app"
3. Fill in details:
   - **App name**: Fantasy Phish
   - **Default language**: English (United States)
   - **App or game**: Game
   - **Free or paid**: Free

4. Complete declarations:
   - Privacy policy: https://fantasyphish.com/privacy
   - App access: Not restricted (or provide test credentials)
   - Ads: Declare if you have ads
   - Content rating questionnaire
   - Target audience
   - News app declaration: No
   - COVID-19 contact tracing: No
   - Data safety form

### Step 2: Prepare Store Listing

1. **App details**
   - Short description (80 chars):

     ```
     Fantasy game for Phish fans. Pick songs, earn points, climb leaderboards!
     ```

   - Full description (4000 chars):

     ```
     Fantasy Phish is the ultimate fantasy game for Phish fans!

     Make your picks before each show and compete with friends to predict which songs the band will play. Earn points for correct predictions and climb the leaderboard.

     🎵 FEATURES
     • Pick songs before every Phish show
     • Live scoring during concerts
     • Global and friends leaderboards
     • Achievement badges and milestones
     • Complete show history and statistics
     • Track your prediction accuracy

     🏆 COMPETE
     Challenge your friends and prove you know Phish better than anyone. Climb the global leaderboard and earn exclusive achievement badges.

     📊 TRACK YOUR STATS
     See your prediction accuracy, total points, and show history. Learn from your picks and improve your strategy.

     Join thousands of Phish fans in the most exciting way to experience shows!
     ```

2. **Graphics** (All required)
   - App icon: 512 x 512 px (already created at `resources/icon.png`)
   - Feature graphic: 1024 x 500 px
   - Phone screenshots: At least 2, up to 8 (JPEG or PNG)
     - Minimum dimension: 320px
     - Maximum dimension: 3840px
     - Portrait recommended
   - 7-inch tablet screenshots (optional)
   - 10-inch tablet screenshots (optional)

3. **Categorization**
   - App category: Games > Music
   - Tags: fantasy, music, phish, setlist

4. **Contact details**
   - Email: your-email@example.com
   - Phone: (optional)
   - Website: https://fantasyphish.com

### Step 3: Build Release APK/AAB

1. Open Android project:

   ```bash
   npm run cap:open:android
   ```

2. In Android Studio:
   - Menu: Build > Generate Signed Bundle / APK
   - Select "Android App Bundle" (AAB format - required for Play Store)
   - Click "Next"

3. Create a keystore (first time only):
   - Click "Create new..."
   - Choose a location: `/path/to/fantasyphish-release.keystore`
   - Password: Choose a strong password (SAVE THIS!)
   - Alias: fantasyphish
   - Alias password: Same as keystore password (or different, SAVE THIS!)
   - Validity: 25 years (minimum)
   - Fill in at least one field (Organization: Fantasy Phish)
   - Click "OK"

   **IMPORTANT**:
   - Keep the keystore file safe (back it up!)
   - Never commit it to git
   - If you lose it, you can never update your app

4. Fill in keystore details:
   - Key store path: Select your keystore
   - Passwords: Enter your saved passwords
   - Click "Next"

5. Select "release" build variant
   - Click "Finish"
   - Wait for build (3-5 minutes)

6. Find your AAB file:
   - Default location: `android/app/release/app-release.aab`

### Step 4: Upload to Play Console

1. In Play Console, go to "Release > Production"
2. Click "Create new release"
3. Upload your AAB file
4. Fill in "Release name": 1.0
5. Fill in "Release notes":

   ```
   Initial release of Fantasy Phish!
   - Make song predictions before every show
   - Live scoring and leaderboards
   - Track your achievements and statistics
   ```

6. Click "Review release"
7. Click "Start rollout to Production"

### Step 5: Wait for Review

- Review time: 2-7 days typically
- Google reviews are generally more lenient than Apple
- Common issues:
  - Privacy policy issues
  - Crashes
  - Permissions not explained

## After Approval

### iOS

- Apps usually go live within 24 hours of approval
- You'll get an email notification
- App will be searchable in the App Store
- Share link: https://apps.apple.com/app/idXXXXXXXXX

### Android

- Apps go live within a few hours of approval
- Available in Play Store immediately
- Share link: https://play.google.com/store/apps/details?id=com.fantasyphish.app

## Updating Your App

### When to Release Updates

Since your app loads from your production website, most changes don't require app updates:

- UI changes: Automatic (reflected immediately)
- New features: Automatic
- Bug fixes: Automatic

**You only need to release new app versions when:**

- Adding new native features (new permissions, plugins)
- Updating Capacitor version
- Changing app icons or splash screens
- Fixing native-layer bugs

### How to Update

1. Increment version numbers:
   - iOS: In Xcode, update Version and Build number
   - Android: In `android/app/build.gradle`, update `versionCode` and `versionName`

2. Build and upload using the same steps above

3. Fill in "What's New" with your changes

4. Submit for review

## Useful Commands

```bash
# Sync Capacitor config to native projects
npm run cap:sync

# Open in Xcode
npm run cap:open:ios

# Open in Android Studio
npm run cap:open:android

# Run on iOS device/simulator
npm run cap:run:ios

# Run on Android device/emulator
npm run cap:run:android

# Update Capacitor
npm run mobile:setup
```

## Troubleshooting

### iOS Build Fails

- Run `xcodebuild -runFirstLaunch` in terminal
- Clean build folder: Xcode > Product > Clean Build Folder
- Delete derived data: Xcode > Preferences > Locations > Derived Data > Delete
- Restart Xcode

### Android Build Fails

- Clean project: Android Studio > Build > Clean Project
- Invalidate caches: File > Invalidate Caches / Restart
- Check `android/app/build.gradle` for errors

### App Crashes on Launch

- Check that your production website is accessible
- Verify `server.url` in `capacitor.config.ts` is correct
- Check iOS/Android logs in Xcode/Android Studio

### Push Notifications Not Working

- iOS: Ensure you've enabled Push Notifications capability in Xcode
- iOS: You need to configure APNs certificates in your Apple Developer account
- Android: Set up Firebase Cloud Messaging (FCM) - see Capacitor docs
- Both: Push notifications require the app to be installed from the actual store (won't work in development)

### Biometric Auth Not Working

- iOS: Ensure Face ID usage description is in Info.plist
- Android: Ensure permissions are in AndroidManifest.xml
- Both: Test on real device (simulators have limited biometric support)

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy](https://play.google.com/about/developer-content-policy/)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Design Guidelines](https://developer.android.com/design)

## Need Help?

If you run into issues:

1. Check Capacitor docs: https://capacitorjs.com/docs
2. Search Stack Overflow
3. Join Capacitor Discord: https://discord.gg/UPYYRhtyzp
4. Apple Developer Forums: https://developer.apple.com/forums/
5. Android Developers: https://developer.android.com/support

Good luck with your submission!
