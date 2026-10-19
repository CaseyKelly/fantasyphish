// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/auth-client", () => ({ signInWithRetry: vi.fn() }))

import { useRouter, useSearchParams } from "next/navigation"
import { auth } from "@/lib/auth"
import { signInWithRetry } from "@/lib/auth-client"
import AuthLayout from "./layout"
import LoginPage from "./login/page"
import LoginClient from "./login/LoginClient"
import RegisterPage from "./register/page"
import RegisterClient from "./register/RegisterClient"
import ForgotPasswordPage from "./forgot-password/page"
import ForgotPasswordLayout from "./forgot-password/layout"
import ResetPasswordPage from "./reset-password/page"
import ResetPasswordLayout from "./reset-password/layout"
import VerifyRequiredPage from "./verify-required/page"
import VerifyRequiredLayout from "./verify-required/layout"
import VerifyPage from "./verify/page"
import VerifyLayout from "./verify/layout"

const push = vi.fn()
const refresh = vi.fn()
const fetchMock = vi.fn()

function setParams(query = "") {
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(query) as never
  )
}

function json(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const typePlaceholder = (placeholder: string, value: string) =>
  fireEvent.change(screen.getByPlaceholderText(placeholder), {
    target: { value },
  })
const submit = (name: string | RegExp) =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name }))
  })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, refresh } as never)
  setParams()
  vi.stubGlobal("fetch", fetchMock)
  sessionStorage.clear()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("server pages and layouts", () => {
  it("login and register redirect signed-in users", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never)
    await expect(LoginPage()).rejects.toThrow("REDIRECT:/picks")
    await expect(RegisterPage()).rejects.toThrow("REDIRECT:/picks")
  })

  it("login and register render their clients for guests", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    render(await LoginPage())
    expect(screen.getByText("Welcome back")).toBeInTheDocument()
    render(await RegisterPage())
    expect(screen.getByText("Create your account")).toBeInTheDocument()
  })

  it("simple pages and pass-through layouts render their children", () => {
    render(
      <AuthLayout>
        <ForgotPasswordLayout>
          <ResetPasswordLayout>
            <VerifyRequiredLayout>
              <VerifyLayout>
                <p>child</p>
              </VerifyLayout>
            </VerifyRequiredLayout>
          </ResetPasswordLayout>
        </ForgotPasswordLayout>
      </AuthLayout>
    )
    expect(screen.getByText("child")).toBeInTheDocument()
    expect(screen.getByText("phish.net")).toBeInTheDocument()

    render(<ForgotPasswordPage />)
    expect(screen.getByText("Reset your password")).toBeInTheDocument()
    render(<ResetPasswordPage />)
    expect(screen.getByText(/Invalid reset link/)).toBeInTheDocument()
  })
})

describe("LoginClient", () => {
  const fill = () => {
    type("Email address", "a@b.com")
    type("Password", "pw")
  }

  it.each([
    [
      "Configuration",
      "No account found with this email. Please sign up first.",
    ],
    [
      "CredentialsSignin",
      "Invalid credentials. Please check your email and password.",
    ],
    [
      "AccessDenied",
      "Access denied. Please verify your email or contact support.",
    ],
    ["Weird", "Weird"],
    ["Please verify your email first", "Please verify your email first"],
  ])("maps the %s error code", (code, message) => {
    setParams(`error=${encodeURIComponent(code)}`)
    render(<LoginClient />)
    expect(screen.getByRole("alert")).toHaveTextContent(message)
  })

  it("prefills a just-verified email and focuses the password", () => {
    vi.useFakeTimers()
    setParams("verified=true")
    sessionStorage.setItem("verified-email", "new@b.com")
    render(<LoginClient />)
    expect(screen.getByRole("status")).toHaveTextContent("verified")
    expect(screen.getByLabelText("Email address")).toHaveValue("new@b.com")
    expect(sessionStorage.getItem("verified-email")).toBeNull()
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(screen.getByLabelText("Password")).toHaveFocus()
  })

  it("shows the verified banner without a stored email", () => {
    setParams("verified=true")
    render(<LoginClient />)
    expect(screen.getByLabelText("Email address")).toHaveValue("")
  })

  it("rejects unknown emails", async () => {
    fetchMock.mockResolvedValue(json({ exists: false }))
    render(<LoginClient />)
    fill()
    await submit("Sign In")
    expect(screen.getByRole("alert")).toHaveTextContent("No account found")
  })

  it("sends unverified users to verify-required", async () => {
    fetchMock.mockResolvedValue(json({ exists: true, verified: false }))
    render(<LoginClient />)
    fill()
    await submit("Sign In")
    expect(sessionStorage.getItem("unverified-email")).toBe("a@b.com")
    expect(push).toHaveBeenCalledWith("/verify-required")
  })

  it("reports a wrong password, then signs in to the callback URL", async () => {
    setParams("callbackUrl=/leaderboard")
    fetchMock.mockResolvedValue(json({ exists: true, verified: true }))
    vi.mocked(signInWithRetry)
      .mockResolvedValueOnce({ error: "x" } as never)
      .mockResolvedValueOnce({ ok: true } as never)
    render(<LoginClient />)
    fill()
    await submit("Sign In")
    expect(screen.getByRole("alert")).toHaveTextContent("Incorrect password")
    await submit("Sign In")
    expect(push).toHaveBeenCalledWith("/leaderboard")
    expect(refresh).toHaveBeenCalled()
  })

  it("handles network errors", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    render(<LoginClient />)
    fill()
    await submit("Sign In")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An unexpected error occurred"
    )
  })
})

describe("RegisterClient", () => {
  function fill(overrides: Partial<Record<string, string>> = {}) {
    const v = {
      username: "alice_1",
      email: "a@b.com",
      password: "password1",
      confirm: "password1",
      ...overrides,
    }
    type("Username", v.username)
    type("Email address", v.email)
    type("Password (minimum 8 characters)", v.password)
    type("Confirm password", v.confirm)
  }

  it.each([
    [{ confirm: "different" }, "Passwords do not match"],
    [
      { password: "short", confirm: "short" },
      "Password must be at least 8 characters",
    ],
    [{ username: "ab" }, "Username must be between 3 and 20 characters"],
    [
      { username: "bad name!" },
      "Username can only contain letters, numbers, and underscores",
    ],
  ])("validates %o", async (overrides, message) => {
    render(<RegisterClient />)
    fill(overrides)
    await submit("Create Account")
    expect(screen.getByRole("alert")).toHaveTextContent(message)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("shows server and network errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Email taken" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    render(<RegisterClient />)
    fill()
    await submit("Create Account")
    expect(screen.getByRole("alert")).toHaveTextContent("Email taken")
    await submit("Create Account")
    expect(screen.getByRole("alert")).toHaveTextContent("Registration failed")
    await submit("Create Account")
    expect(screen.getByRole("alert")).toHaveTextContent(
      "An unexpected error occurred"
    )
  })

  it("shows the check-your-email screen, with a way back", async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    render(<RegisterClient />)
    fill()
    await submit("Create Account")
    expect(screen.getByText("Check your email")).toBeInTheDocument()
    expect(screen.getByText("a@b.com")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "try again" }))
    expect(screen.getByText("Create your account")).toBeInTheDocument()
  })
})

describe("ForgotPasswordClient", () => {
  it("sends a reset link", async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    render(<ForgotPasswordPage />)
    typePlaceholder("Email address", "a@b.com")
    await submit("Send reset link")
    expect(screen.getByText("Check your email")).toBeInTheDocument()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "a@b.com",
    })
  })

  it("shows errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Invalid email address" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    render(<ForgotPasswordPage />)
    typePlaceholder("Email address", "a@b.com")
    await submit("Send reset link")
    expect(screen.getByText("Invalid email address")).toBeInTheDocument()
    await submit("Send reset link")
    expect(screen.getByText("An error occurred")).toBeInTheDocument()
    await submit("Send reset link")
    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument()
  })
})

describe("ResetPasswordClient", () => {
  beforeEach(() => setParams("token=tok"))

  const fill = (password = "password1", confirm = password) => {
    typePlaceholder("New password", password)
    typePlaceholder("Confirm password", confirm)
  }

  it("validates matching passwords", async () => {
    render(<ResetPasswordPage />)
    fill("password1", "password2")
    await submit("Reset password")
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument()
  })

  it("resets the password and redirects to login", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] })
    fetchMock.mockResolvedValue(json({ success: true }))
    render(<ResetPasswordPage />)
    fill()
    await submit("Reset password")
    expect(screen.getByText("Password reset successful!")).toBeInTheDocument()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      token: "tok",
      password: "password1",
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(push).toHaveBeenCalledWith("/login")
  })

  it("shows errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Reset token has expired" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    render(<ResetPasswordPage />)
    fill()
    await submit("Reset password")
    expect(screen.getByText("Reset token has expired")).toBeInTheDocument()
    await submit("Reset password")
    expect(screen.getByText("An error occurred")).toBeInTheDocument()
    await submit("Reset password")
    expect(screen.getByText("An unexpected error occurred")).toBeInTheDocument()
  })
})

describe("VerifyRequiredClient", () => {
  it("redirects to login without a stored email", () => {
    render(<VerifyRequiredPage />)
    expect(push).toHaveBeenCalledWith("/login")
  })

  it("resends the email and counts down before allowing another", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    sessionStorage.setItem("unverified-email", "a@b.com")
    fetchMock.mockResolvedValue(json({ success: true }))
    render(<VerifyRequiredPage />)
    expect(screen.getByText("a@b.com")).toBeInTheDocument()
    await submit("Resend Verification Email")
    expect(
      screen.getByText(/Verification email sent successfully/)
    ).toBeInTheDocument()
    const button = screen.getByRole("button", { name: "Wait 60s to resend" })
    expect(button).toBeDisabled()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(
      screen.getByRole("button", { name: "Wait 59s to resend" })
    ).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(59_000)
    })
    expect(
      screen.getByRole("button", { name: "Resend Verification Email" })
    ).toBeEnabled()
  })

  it("shows resend errors", async () => {
    sessionStorage.setItem("unverified-email", "a@b.com")
    fetchMock
      .mockResolvedValueOnce(json({ error: "Too many requests" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    render(<VerifyRequiredPage />)
    await submit("Resend Verification Email")
    expect(screen.getByText("Too many requests")).toBeInTheDocument()
    await submit("Resend Verification Email")
    expect(
      screen.getByText("Failed to resend verification email")
    ).toBeInTheDocument()
    await submit("Resend Verification Email")
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
  })
})

describe("VerifyPage", () => {
  it("errors without a token", async () => {
    render(<VerifyPage />)
    expect(
      await screen.findByText("No verification token provided")
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("verifies, stores the email, and redirects to login", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] })
    setParams("token=tok")
    fetchMock.mockResolvedValue(json({ message: "ok", email: "a@b.com" }))
    const { rerender } = render(<VerifyPage />)
    await act(async () => {})
    expect(screen.getByText("Email verified!")).toBeInTheDocument()
    expect(sessionStorage.getItem("verified-email")).toBe("a@b.com")
    // Re-rendering with the same token doesn't re-hit the one-shot endpoint
    rerender(<VerifyPage />)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(push).toHaveBeenCalledWith("/login?verified=true")
  })

  it("verifies without an email in the response", async () => {
    setParams("token=tok")
    fetchMock.mockResolvedValue(json({ message: "ok" }))
    render(<VerifyPage />)
    expect(await screen.findByText("Email verified!")).toBeInTheDocument()
    expect(sessionStorage.getItem("verified-email")).toBeNull()
  })

  it("shows API and network failures", async () => {
    setParams("token=bad")
    fetchMock.mockResolvedValueOnce(
      json({ error: "Invalid verification token" }, false)
    )
    render(<VerifyPage />)
    expect(
      await screen.findByText("Invalid verification token")
    ).toBeInTheDocument()

    setParams("token=other")
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    render(<VerifyPage />)
    await waitFor(() =>
      expect(
        screen.getByText("An error occurred during verification")
      ).toBeInTheDocument()
    )
  })
})
