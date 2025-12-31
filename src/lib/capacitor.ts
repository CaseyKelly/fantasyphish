import { Capacitor } from "@capacitor/core"
import { PushNotifications } from "@capacitor/push-notifications"
import {
  BiometricAuth,
  type BiometryType,
} from "@aparajita/capacitor-biometric-auth"

/**
 * Check if the app is running as a native mobile app
 */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

/**
 * Get the current platform (ios, android, web)
 */
export function getPlatform(): string {
  return Capacitor.getPlatform()
}

/**
 * Request push notification permissions and register for notifications
 */
export async function setupPushNotifications(): Promise<void> {
  if (!isNativePlatform()) {
    console.log("Push notifications are only available on native platforms")
    return
  }

  try {
    // Request permission
    let permStatus = await PushNotifications.checkPermissions()

    if (permStatus.receive === "prompt") {
      permStatus = await PushNotifications.requestPermissions()
    }

    if (permStatus.receive !== "granted") {
      throw new Error("Push notification permission denied")
    }

    // Register for push notifications
    await PushNotifications.register()

    // Listen for registration events
    await PushNotifications.addListener("registration", (token) => {
      console.log("Push registration success, token: " + token.value)
      // TODO: Send this token to your backend to store for the user
    })

    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error)
    })

    // Handle incoming push notifications
    await PushNotifications.addListener(
      "pushNotificationReceived",
      (notification) => {
        console.log("Push notification received:", notification)
        // TODO: Handle notification display
      }
    )

    await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        console.log("Push notification action performed:", notification)
        // TODO: Handle notification tap/action
      }
    )
  } catch (error) {
    console.error("Error setting up push notifications:", error)
    throw error
  }
}

/**
 * Check if biometric authentication is available
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNativePlatform()) {
    return false
  }

  try {
    const result = await BiometricAuth.checkBiometry()
    return result.isAvailable
  } catch (error) {
    console.error("Error checking biometric availability:", error)
    return false
  }
}

/**
 * Authenticate user with biometrics (Face ID, Touch ID, or fingerprint)
 */
export async function authenticateWithBiometrics(
  reason: string = "Authenticate to continue"
): Promise<boolean> {
  if (!isNativePlatform()) {
    console.log("Biometric auth is only available on native platforms")
    return false
  }

  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use Passcode",
      androidTitle: "Biometric Authentication",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    })

    return true
  } catch (error) {
    console.error("Biometric authentication error:", error)
    return false
  }
}

/**
 * Get the type of biometric authentication available
 */
export async function getBiometricType(): Promise<BiometryType | null> {
  if (!isNativePlatform()) {
    return null
  }

  try {
    const result = await BiometricAuth.checkBiometry()
    if (result.isAvailable && result.biometryType) {
      return result.biometryType
    }
    return null
  } catch (error) {
    console.error("Error getting biometric type:", error)
    return null
  }
}
