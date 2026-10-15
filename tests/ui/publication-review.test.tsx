import { afterEach, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PublicationReview } from "@/components/publication-review";
import { api } from "@/components/app-provider";
vi.mock("@/components/app-provider", () => ({
  api: vi.fn(),
  useAction: () => ({
    busy: false,
    act: async (fn: () => Promise<unknown>) => fn(),
  }),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
test("TikTok has no default audience or interactions and sends explicit per-video consent", async () => {
  vi.mocked(api).mockImplementation(async (path, method) =>
    path.startsWith("projects/")
      ? ({
          revision: 1,
          renderedRevision: 1,
          outputAssetId: "fixture-asset",
        } as never)
      : method === "POST"
        ? { ok: true }
        : ({
            creator: {
              creator_username: "owner",
              creator_nickname: "Owner nickname",
              privacy_level_options: ["PUBLIC_TO_EVERYONE", "SELF_ONLY"],
              comment_disabled: true,
              duet_disabled: false,
              stitch_disabled: false,
              max_video_post_duration_sec: 60,
            },
            seconds: 5,
          } as never),
  );
  const onSaved = vi.fn().mockResolvedValue(undefined);
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <PublicationReview
        item={{
          id: "publication-id",
          projectId: "project-id",
          revision: 1,
          provider: "tiktok",
          accountName: "My account",
          caption: "Original caption",
          state: "waiting_review",
          scheduledAt: 1800000000000,
          postId: null,
          postUrl: null,
          error: null,
        }}
        onSaved={onSaved}
      />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  const audience = (await screen.findByLabelText(
    "Who can watch this video?",
  )) as HTMLSelectElement;
  expect(audience.value).toBe("");
  expect(
    (screen.getByRole("checkbox", { name: /Comment/ }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("checkbox", { name: "Duet" }) as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(
    (
      screen.getByRole("button", {
        name: "Authorize TikTok post",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.selectOptions(audience, "SELF_ONLY");
  await user.click(
    screen.getByRole("checkbox", { name: /This content promotes/ }),
  );
  expect(
    (
      screen.getByRole("checkbox", {
        name: /Branded content/,
      }) as HTMLInputElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Authorize TikTok post",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await user.click(screen.getByRole("checkbox", { name: /Your brand/ }));
  await user.click(
    screen.getByRole("checkbox", { name: /I reviewed this video/ }),
  );
  await user.click(
    screen.getByRole("button", { name: "Authorize TikTok post" }),
  );
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(api).toHaveBeenCalledWith(
    "social/publications/publication-id",
    "POST",
    {
      caption: "Original caption",
      consent: true,
      revision: 1,
      tiktok: {
        privacy_level: "SELF_ONLY",
        disable_comment: true,
        disable_duet: true,
        disable_stitch: true,
        brand_content_toggle: false,
        brand_organic_toggle: true,
        consent: true,
      },
    },
  );
});
