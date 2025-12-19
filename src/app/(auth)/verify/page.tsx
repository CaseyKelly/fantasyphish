"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DonutLogo } from "@/components/DonutLogo";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.message);
          
          // Auto-login the user after verification
          // The user's email is now verified, but we need them to enter their password
          // OR we can redirect them to login with a special flag
          // Since we don't have their password stored in plaintext, 
          // we'll redirect to a pre-filled login
          const email = data.email;
          if (email) {
            // Store email in sessionStorage for the login page to use
            sessionStorage.setItem("verified-email", email);
          }
          
          // Redirect to login after 2 seconds
          setTimeout(() => {
            router.push("/login?verified=true");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(data.error);
        }
      } catch {
        setStatus("error");
        setMessage("An error occurred during verification");
      }
    };

    verifyEmail();
  }, [token, router]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          {status === "loading" && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3d5a6c] mb-6">
                <Loader2 className="h-8 w-8 text-[#c23a3a] animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Verifying your email...
              </h1>
              <p className="text-gray-400">Please wait a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-6">
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Email verified!
              </h1>
              <p className="text-gray-400 mb-6">
                Your account is now active. Redirecting you to login...
              </p>
              <div className="inline-flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-[#c23a3a] animate-spin" />
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c23a3a]/20 mb-6">
                <XCircle className="h-8 w-8 text-[#d64545]" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Verification failed
              </h1>
              <p className="text-gray-400 mb-6">{message}</p>
              <Link href="/register">
                <Button>Try Again</Button>
              </Link>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#2d4654]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <DonutLogo size="lg" />
            <span className="text-2xl font-bold text-white">FantasyPhish</span>
          </Link>
        </div>
        <Suspense fallback={
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#3d5a6c] mb-6">
                  <Loader2 className="h-8 w-8 text-[#c23a3a] animate-spin" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-4">
                  Loading...
                </h1>
              </div>
            </CardContent>
          </Card>
        }>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}
