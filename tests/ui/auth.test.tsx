import { afterEach, expect, test, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthForm } from "@/components/auth-form";
import { foundationApi } from "@/lib/foundation-api";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/login",
}));
vi.mock("@/lib/foundation-api", () => ({ foundationApi: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

test("a rejected sign-in preserves input and shows an actionable server error", async () => {
  vi.mocked(foundationApi).mockRejectedValue(
    new Error("Sign-in is temporarily unavailable."),
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthForm foundation />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText("Email address"),
    "creator@example.com",
  );
  await user.type(screen.getByLabelText("Password"), "a secure password");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByRole("alert")).toHaveProperty(
    "textContent",
    "Sign-in is temporarily unavailable.",
  );
  expect(
    (screen.getByLabelText("Email address") as HTMLInputElement).value,
  ).toBe("creator@example.com");
  expect(vi.mocked(foundationApi)).toHaveBeenCalledWith("auth/login", "POST", {
    email: "creator@example.com",
    password: "a secure password",
  });
});
