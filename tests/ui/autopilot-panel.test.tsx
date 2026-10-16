import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AutopilotPanel } from "@/components/autopilot-panel";
import { api } from "@/components/app-provider";

let credits = 120;
vi.mock("@/components/app-provider", () => ({
  api: vi.fn(),
  useAction: () => ({
    busy: false,
    act: async (fn: () => Promise<unknown>) => fn(),
  }),
  useApp: () => ({ data: { me: { credits }, assets: [] } }),
}));
vi.mock("@/components/social-connections", () => ({
  useSocialStatus: () => ({
    data: {
      connections: [
        {
          id: "ig-1",
          provider: "instagram",
          name: "tech.account",
          disconnectedAt: null,
        },
      ],
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  credits = 120;
});
const view = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AutopilotPanel />
    </QueryClientProvider>,
  );
const button = (name: RegExp) =>
  screen.getByRole("button", { name }) as HTMLButtonElement;

test("the batch size is blocked when credits can't cover it, and says how many can be made", async () => {
  credits = 12;
  view();
  expect(screen.getByRole("status").textContent).toMatch(
    /10 videos reserve 30 credits.*balance is 12.*can make 4 now/i,
  );
  expect(button(/make 10 videos/i).disabled).toBe(true);
  await userEvent.selectOptions(screen.getByLabelText("Videos"), "3");
  expect(button(/make 3 videos/i).disabled).toBe(false);
});

test("automatic publishing is off until chosen and the request carries exactly what was picked", async () => {
  vi.mocked(api).mockResolvedValue({
    requested: 5,
    queued: 5,
    perVideoCredits: 3,
    intervalMinutes: 28,
    firstUpload: 1800000000000,
    lastUpload: 1800005000000,
    automatic: false,
    topics: ["Why binary search needs a sorted list"],
    stoppedBecause: null,
  } as never);
  view();
  expect(screen.getByText(/waits for your approval/i)).toBeTruthy();
  await userEvent.selectOptions(screen.getByLabelText("Videos"), "5");
  await userEvent.click(
    screen.getByRole("checkbox", { name: /tech\.account/i }),
  );
  const auto = screen.getByRole("checkbox", {
    name: /publish automatically/i,
  }) as HTMLInputElement;
  expect(auto.checked).toBe(false);
  await userEvent.click(button(/make 5 videos/i));
  await waitFor(() => expect(api).toHaveBeenCalled());
  expect(api).toHaveBeenCalledWith(
    "automation/runs",
    "POST",
    expect.objectContaining({
      count: 5,
      hours: 24,
      style: "explainer",
      connectionIds: ["ig-1"],
      automatic: false,
    }),
  );
  expect(await screen.findByText(/queued 5 of 5 videos/i)).toBeTruthy();
  expect(screen.getByText(/each needing your approval/i)).toBeTruthy();
});
