"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  isNativePlatform,
  getPlatform,
  isBiometricAvailable,
  authenticateWithBiometrics,
  getBiometricType,
  setupPushNotifications,
} from "@/lib/capacitor"
import {
  Smartphone,
  Fingerprint,
  Bell,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react"

export default function TestMobilePage() {
  const [platform, setPlatform] = useState<string>("web")
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricType, setBiometricType] = useState<string | null>(null)
  const [pushStatus, setPushStatus] = useState<string>("Not initialized")
  const [loading, setLoading] = useState<string | null>(null)
  const [results, setResults] = useState<
    Array<{ test: string; success: boolean; message: string }>
  >([])

  useEffect(() => {
    async function checkCapabilities() {
      const plat = getPlatform()
      setPlatform(plat)

      if (isNativePlatform()) {
        const bioAvailable = await isBiometricAvailable()
        setBiometricAvailable(bioAvailable)

        if (bioAvailable) {
          const bioType = await getBiometricType()
          setBiometricType(bioType ? String(bioType) : null)
        }
      }
    }
    checkCapabilities()
  }, [])

  const addResult = (test: string, success: boolean, message: string) => {
    setResults((prev) => [...prev, { test, success, message }])
  }

  const handleTestBiometric = async () => {
    setLoading("biometric")
    try {
      if (!isNativePlatform()) {
        addResult(
          "Biometric Auth",
          false,
          "Not running in native app. Open this page in the iOS/Android app to test."
        )
        return
      }

      if (!biometricAvailable) {
        addResult(
          "Biometric Auth",
          false,
          "Biometric authentication not available on this device"
        )
        return
      }

      const authenticated = await authenticateWithBiometrics(
        "Test biometric authentication"
      )

      if (authenticated) {
        addResult(
          "Biometric Auth",
          true,
          `Successfully authenticated with ${biometricType || "biometrics"}!`
        )
      } else {
        addResult(
          "Biometric Auth",
          false,
          "Authentication failed or was cancelled"
        )
      }
    } catch (error) {
      addResult("Biometric Auth", false, `Error: ${error}`)
    } finally {
      setLoading(null)
    }
  }

  const handleTestPushNotifications = async () => {
    setLoading("push")
    try {
      if (!isNativePlatform()) {
        addResult(
          "Push Notifications",
          false,
          "Not running in native app. Open this page in the iOS/Android app to test."
        )
        return
      }

      setPushStatus("Requesting permissions...")
      await setupPushNotifications()
      setPushStatus("Push notifications enabled! Check console for token.")
      addResult(
        "Push Notifications",
        true,
        "Push notifications initialized successfully. Check the Xcode/Android Studio console for your device token."
      )
    } catch (error) {
      setPushStatus(`Error: ${error}`)
      addResult("Push Notifications", false, `Error: ${error}`)
    } finally {
      setLoading(null)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">
        Mobile Features Test
      </h1>
      <p className="text-gray-400 mb-8">
        Test native mobile features when running in the iOS or Android app
      </p>

      {/* Platform Info */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Smartphone className="h-5 w-5 text-[#c23a3a]" />
            <h2 className="text-xl font-semibold text-white">
              Platform Information
            </h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">Platform:</span>
            <span className="text-white font-medium">
              {platform === "web" ? "Web Browser" : platform.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Native App:</span>
            <span className="text-white font-medium">
              {isNativePlatform() ? "Yes" : "No"}
            </span>
          </div>
          {isNativePlatform() && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">Biometric Available:</span>
                <span className="text-white font-medium">
                  {biometricAvailable ? "Yes" : "No"}
                </span>
              </div>
              {biometricType && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Biometric Type:</span>
                  <span className="text-white font-medium">
                    {biometricType}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Test Buttons */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold text-white">Feature Tests</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Biometric Test */}
          <div>
            <Button
              onClick={handleTestBiometric}
              disabled={loading !== null}
              className="w-full"
              size="lg"
            >
              {loading === "biometric" ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Fingerprint className="h-5 w-5 mr-2" />
                  Test Biometric Authentication
                </>
              )}
            </Button>
            <p className="text-sm text-gray-400 mt-2">
              This will prompt for Face ID, Touch ID, or fingerprint
              authentication
            </p>
          </div>

          {/* Push Notifications Test */}
          <div>
            <Button
              onClick={handleTestPushNotifications}
              disabled={loading !== null}
              className="w-full"
              size="lg"
              variant="outline"
            >
              {loading === "push" ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <Bell className="h-5 w-5 mr-2" />
                  Setup Push Notifications
                </>
              )}
            </Button>
            <p className="text-sm text-gray-400 mt-2">Status: {pushStatus}</p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">Test Results</h2>
              <Button
                onClick={clearResults}
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${
                    result.success
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {result.success ? (
                      <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p
                        className={`font-medium ${
                          result.success ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {result.test}
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        {result.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!isNativePlatform() && (
        <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <p className="text-sm text-blue-400">
            <strong>Note:</strong> You are viewing this in a web browser. To
            test native features, open the FantasyPhish app on iOS or Android
            and navigate to this page.
          </p>
        </div>
      )}
    </div>
  )
}
