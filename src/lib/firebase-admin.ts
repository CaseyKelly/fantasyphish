import * as admin from "firebase-admin"

// Initialize Firebase Admin SDK (singleton pattern)
function initializeFirebase() {
  if (admin.apps.length > 0) {
    return admin.app()
  }

  // Get credentials from environment variables
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      "Firebase credentials not configured. Push notifications will not work."
    )
    // Return a mock app for development
    return null
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

// Get Firebase Messaging instance
export function getMessaging() {
  const app = initializeFirebase()
  if (!app) {
    throw new Error("Firebase is not initialized")
  }
  return admin.messaging(app)
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  )
}

/**
 * Send a push notification to a single device
 */
export async function sendNotification(params: {
  token: string
  title: string
  body: string
  data?: Record<string, string>
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isFirebaseConfigured()) {
      return {
        success: false,
        error: "Firebase is not configured",
      }
    }

    const messaging = getMessaging()

    const message: admin.messaging.Message = {
      token: params.token,
      notification: {
        title: params.title,
        body: params.body,
      },
      data: params.data,
      // iOS specific
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
      // Android specific
      android: {
        notification: {
          sound: "default",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
        },
      },
    }

    await messaging.send(message)

    return { success: true }
  } catch (error) {
    console.error("Failed to send notification:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Send notifications to multiple devices (batch)
 * Firebase allows up to 500 tokens per batch
 */
export async function sendBatchNotifications(params: {
  tokens: string[]
  title: string
  body: string
  data?: Record<string, string>
}): Promise<{
  successCount: number
  failureCount: number
  invalidTokens: string[]
}> {
  try {
    if (!isFirebaseConfigured()) {
      throw new Error("Firebase is not configured")
    }

    const messaging = getMessaging()
    const invalidTokens: string[] = []
    let successCount = 0
    let failureCount = 0

    // Process in batches of 500 (Firebase limit)
    const batchSize = 500
    for (let i = 0; i < params.tokens.length; i += batchSize) {
      const batch = params.tokens.slice(i, i + batchSize)

      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: params.title,
          body: params.body,
        },
        data: params.data,
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
        android: {
          notification: {
            sound: "default",
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
      }

      const response = await messaging.sendEachForMulticast(message)

      successCount += response.successCount
      failureCount += response.failureCount

      // Collect invalid tokens
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errorCode =
            "code" in resp.error ? (resp.error as { code: string }).code : null
          // These error codes indicate invalid/expired tokens
          if (
            errorCode === "messaging/invalid-registration-token" ||
            errorCode === "messaging/registration-token-not-registered"
          ) {
            invalidTokens.push(batch[idx])
          }
        }
      })
    }

    return {
      successCount,
      failureCount,
      invalidTokens,
    }
  } catch (error) {
    console.error("Failed to send batch notifications:", error)
    throw error
  }
}

/**
 * Verify if a token is valid
 */
export async function verifyToken(token: string): Promise<boolean> {
  try {
    if (!isFirebaseConfigured()) {
      return false
    }

    const messaging = getMessaging()
    // Try to send a dry-run message
    await messaging.send(
      {
        token,
        notification: {
          title: "Test",
          body: "Test",
        },
      },
      true // dry-run mode
    )
    return true
  } catch (error) {
    console.error("Token verification failed:", error)
    return false
  }
}
