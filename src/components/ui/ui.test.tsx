// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { createRef } from "react"
import { render, screen } from "@testing-library/react"
import { Button } from "./button"
import { Card, CardHeader, CardContent, CardFooter } from "./card"
import { Input } from "./input"

describe("Button", () => {
  it("renders children with variant and size classes, letting className win", () => {
    render(
      <Button variant="success" size="lg" className="p-0">
        Save
      </Button>
    )
    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toBeEnabled()
    expect(button.className).toContain("bg-green-600")
    expect(button.className).toContain("p-0")
    expect(button.className).not.toContain("px-6")
  })

  it("shows a loading state and disables the button", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(<Button isLoading>Save</Button>)
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent("Loading...")
    expect(button).not.toHaveTextContent("Save")
  })

  it("forwards refs and the disabled prop", () => {
    const ref = createRef<HTMLButtonElement>()
    render(
      <Button ref={ref} disabled variant="ghost" size="sm">
        Go
      </Button>
    )
    expect(ref.current).toBeDisabled()
  })
})

describe("Card", () => {
  it("renders all sections, with blur toggled off", () => {
    render(
      <Card blur={false} data-testid="card">
        <CardHeader>Header</CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(screen.getByTestId("card").className).not.toContain("backdrop-blur")
    expect(screen.getByText("Header")).toBeInTheDocument()
    expect(screen.getByText("Body")).toBeInTheDocument()
    expect(screen.getByText("Footer")).toBeInTheDocument()
  })

  it("blurs by default", () => {
    render(<Card data-testid="card">x</Card>)
    expect(screen.getByTestId("card").className).toContain("backdrop-blur-sm")
  })
})

describe("Input", () => {
  it("derives an id from the label and shows errors", () => {
    render(<Input label="Email Address" error="Required" />)
    const input = screen.getByLabelText("Email Address")
    expect(input.id).toBe("email-address")
    expect(screen.getByText("Required")).toBeInTheDocument()
  })

  it("prefers an explicit id and renders without a label", () => {
    const ref = createRef<HTMLInputElement>()
    render(<Input id="custom" ref={ref} placeholder="type" />)
    expect(ref.current?.id).toBe("custom")
    expect(screen.queryByRole("paragraph")).not.toBeInTheDocument()
  })
})
