import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.fantasyphish.app",
  appName: "Fantasy Phish",
  webDir: "out",
  server: {
    // Use the production URL for the app
    // For local development, change to: http://localhost:3000
    url: process.env.NEXT_PUBLIC_APP_URL || "https://fantasyphish.com",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SplashScreen: {
      launchShowDuration: 0,
    },
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
