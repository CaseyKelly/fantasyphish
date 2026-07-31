import webpush from "web-push"

let configured = false

function ensureConfigured() {
  if (configured) return
  const subject = process.env.VAPID_SUBJECT
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!subject || !publicKey || !privateKey) {
    throw new Error("VAPID environment variables are not configured")
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

export interface PushSendResult {
  success: boolean
  expired: boolean
  error?: string
}

export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<PushSendResult> {
  try {
    ensureConfigured()

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    )
    return { success: true, expired: false }
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode
    const expired = statusCode === 404 || statusCode === 410
    return { success: false, expired, error: String(error) }
  }
}
