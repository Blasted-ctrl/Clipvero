import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { estimateCost, modeSchema, plans } from "@/lib/model";
import { capabilities } from "@/components/marketing/data/capabilities";
import { faqEntries } from "@/components/marketing/data/faq";
import {
  featurePages,
  getFeaturePage,
} from "@/components/marketing/data/features";
import { videoFormats } from "@/components/marketing/data/formats";
import {
  filterShowcase,
  formatDuration,
  showcaseEntries,
  showcaseFilters,
} from "@/components/marketing/data/showcase";
import { marketingRoutes } from "@/components/marketing/data/site";
import {
  captionColors,
  parseInstruction,
  type CaptionStyle,
} from "@/components/marketing/editor/edit-instructions";
import { signUpHref } from "@/components/marketing/lib/app-routes";
import {
  DRAFT_STORAGE_KEY,
  buildCreateHref,
  createDraft,
  draftModes,
  parseCreationDraft,
  validateDraftInput,
} from "@/components/marketing/lib/creation-draft";

const publicDir = join(process.cwd(), "public");

describe("creation draft hand-off", () => {
  it("mirrors every creation mode the application accepts", () => {
    assert.deepEqual([...draftModes].sort(), [...modeSchema.options].sort());
  });

  it("rejects empty and too-short ideas with actionable messages", () => {
    assert.deepEqual(validateDraftInput("idea", "   "), {
      ok: false,
      error: "Describe the video you want to create.",
    });
    const short = validateDraftInput("idea", "robots");
    assert.equal(short.ok, false);
  });

  it("accepts and trims a valid idea", () => {
    assert.deepEqual(
      validateDraftInput("idea", "  Two robots argue over Wi-Fi  "),
      { ok: true, content: "Two robots argue over Wi-Fi" },
    );
  });

  it("enforces script bounds", () => {
    assert.equal(validateDraftInput("script", "Too short").ok, false);
    assert.equal(validateDraftInput("script", "x".repeat(12001)).ok, false);
    assert.equal(validateDraftInput("script", "A".repeat(60)).ok, true);
  });

  it("only accepts web links in the URL tab", () => {
    assert.equal(validateDraftInput("url", "not a link").ok, false);
    assert.equal(validateDraftInput("url", "javascript:alert(1)").ok, false);
    assert.deepEqual(validateDraftInput("url", "https://example.com/post"), {
      ok: true,
      content: "https://example.com/post",
    });
  });

  it("allows empty upload notes", () => {
    assert.deepEqual(validateDraftInput("upload", ""), {
      ok: true,
      content: "",
    });
  });

  it("builds a create URL that carries mode, source and short prompts", () => {
    const draft = createDraft(
      "idea",
      "A story about a lighthouse",
      "story",
      1000,
    );
    const url = new URL(buildCreateHref(draft), "http://localhost");
    assert.equal(url.pathname, "/create");
    assert.equal(url.searchParams.get("mode"), "story");
    assert.equal(url.searchParams.get("source"), "idea");
    assert.equal(url.searchParams.get("prompt"), "A story about a lighthouse");
    assert.equal(url.searchParams.get("draft"), "1");
  });

  it("keeps long scripts out of the URL (they travel through storage)", () => {
    const draft = createDraft("script", "word ".repeat(600).trim());
    const url = new URL(buildCreateHref(draft), "http://localhost");
    assert.equal(url.searchParams.get("mode"), "script");
    assert.equal(url.searchParams.get("prompt"), null);
  });

  it("round-trips through storage and rejects expired or tampered drafts", () => {
    const now = 1_700_000_000_000;
    const draft = createDraft("upload", "find the debate", undefined, now);
    assert.equal(draft.mode, "clips");
    assert.deepEqual(
      parseCreationDraft(JSON.parse(JSON.stringify(draft)), now + 1000),
      draft,
    );
    assert.equal(parseCreationDraft(draft, now + 1000 * 60 * 60 * 25), null);
    assert.equal(parseCreationDraft({ ...draft, mode: "hack" }, now), null);
    assert.equal(parseCreationDraft({ ...draft, version: 2 }, now), null);
    assert.equal(parseCreationDraft("nope", now), null);
    assert.equal(DRAFT_STORAGE_KEY, "clipvero:creation-draft");
  });

  it("returns visitors to the requested page after sign-up", () => {
    assert.equal(
      signUpHref("/billing?plan=creator"),
      "/signup?next=%2Fbilling%3Fplan%3Dcreator",
    );
    assert.equal(signUpHref(), "/signup");
  });
});

describe("showcase data", () => {
  it("filters by category and returns everything for All", () => {
    assert.equal(
      filterShowcase(showcaseEntries, "all").length,
      showcaseEntries.length,
    );
    for (const entry of filterShowcase(showcaseEntries, "explainer"))
      assert.equal(entry.category, "explainer");
  });

  it("has an example for every filter", () => {
    for (const filter of showcaseFilters)
      assert.ok(
        filterShowcase(showcaseEntries, filter.id).length > 0,
        filter.id,
      );
  });

  it("points at real media files", () => {
    for (const entry of showcaseEntries) {
      for (const asset of [entry.src, entry.poster, entry.webm].filter(
        Boolean,
      ) as string[]) {
        assert.ok(existsSync(join(publicDir, asset)), `missing ${asset}`);
      }
    }
  });

  it("labels samples that were not generated by Clipvero", () => {
    for (const entry of showcaseEntries)
      assert.ok(["illustrative", "clipvero"].includes(entry.provenance));
  });

  it("formats durations as m:ss", () => {
    assert.equal(formatDuration(12), "0:12");
    assert.equal(formatDuration(154), "2:34");
    assert.equal(formatDuration(-3), "0:00");
  });
});

describe("content stays consistent with the product", () => {
  it("links every format to an existing feature page and capability", () => {
    for (const format of videoFormats) {
      assert.ok(getFeaturePage(format.feature), format.id);
      assert.ok(format.capability in capabilities, format.capability);
    }
    assert.equal(videoFormats.length, 8);
  });

  it("covers the seven required feature pages with valid capabilities", () => {
    assert.equal(featurePages.length, 7);
    for (const page of featurePages) {
      for (const item of page.highlights)
        assert.ok(
          item.capability in capabilities,
          `${page.slug}: ${item.capability}`,
        );
      assert.ok(marketingRoutes.includes(`/features/${page.slug}`));
    }
  });

  it("marks unreleased capabilities as upcoming", () => {
    for (const id of [
      "directPublishing",
      "analytics",
      "teamReview",
      "urlImport",
      "documentImport",
    ] as const) {
      assert.equal(capabilities[id].status, "upcoming", id);
    }
  });

  it("answers the twelve required FAQ questions without promising virality", () => {
    assert.equal(faqEntries.length, 12);
    const text = JSON.stringify([
      faqEntries,
      featurePages,
      videoFormats,
    ]).toLowerCase();
    for (const banned of [
      "go viral",
      "guaranteed",
      "guarantee",
      "millions of views",
      "will go viral",
    ]) {
      assert.ok(!text.includes(banned), `found "${banned}"`);
    }
  });

  it("presents the specified plan prices", () => {
    assert.deepEqual(
      Object.values(plans).map((plan) => [plan.name, plan.price]),
      [
        ["Starter", 29],
        ["Creator", 79],
        ["Studio", 199],
      ],
    );
  });

  it("prices a standard video at 10 credits, as the pricing page states", () => {
    const standard = estimateCost({
      title: "t",
      mode: "prompt",
      content: "c",
      duration: 60,
      aspect: "9:16",
      voice: "sage",
      tone: "Conversational",
      language: "English",
      generateImages: true,
      characterIds: [],
      clipCount: 3,
      rightsConfirmed: true,
    });
    assert.equal(standard, 10);
  });
});

describe("editor demo instructions", () => {
  const base: CaptionStyle = {
    color: captionColors.white,
    colorName: "White",
    position: "bottom",
    size: 17,
    visible: true,
  };

  it("proposes color, position and size changes", () => {
    const proposals = parseInstruction(
      "Make the captions bigger and yellow at the top",
      base,
    );
    assert.deepEqual(
      proposals.map((p) => p.label),
      [
        "Caption color → Yellow",
        "Caption position → Top",
        "Caption size → 20px",
      ],
    );
  });

  it("does not propose no-op changes", () => {
    assert.deepEqual(
      parseInstruction("white captions at the bottom", base),
      [],
    );
  });

  it("can hide and show captions", () => {
    assert.equal(
      parseInstruction("hide the captions", base)[0]?.patch.visible,
      false,
    );
    assert.equal(
      parseInstruction("show captions", { ...base, visible: false })[0]?.patch
        .visible,
      true,
    );
  });
});
