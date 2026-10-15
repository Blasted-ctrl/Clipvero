/**
 * Single source of truth for what the marketing site may claim.
 * Statuses follow the release priorities in AGENTS.md. Update a status here and
 * every badge, FAQ answer and CTA that depends on it changes with it.
 */
export type CapabilityStatus = "available" | "upcoming";

export const capabilities = {
  scriptToVideo: { label: "Script to video", status: "available" },
  promptToVideo: { label: "Idea to video", status: "available" },
  browserEditor: { label: "Scene editor", status: "available" },
  mp4Render: { label: "MP4 rendering", status: "available" },
  reviewApproval: { label: "Review and approval", status: "available" },
  narration: {
    label: "AI narration for AI-written videos",
    status: "available",
  },
  originalImages: { label: "Original AI imagery", status: "available" },
  characters: { label: "Reusable fictional characters", status: "available" },
  presets: { label: "Saved creator styles", status: "available" },
  autopilot: { label: "Autopilot pipelines", status: "available" },
  uploads: { label: "Recording uploads", status: "available" },
  autoClipping: { label: "Long video to clips", status: "available" },
  scriptFileImport: {
    label: "TXT and Markdown script import",
    status: "available",
  },
  editCommands: { label: "Typed edit instructions", status: "available" },
  reminders: { label: "Posting reminders", status: "available" },
  urlImport: { label: "Website fetching from links", status: "upcoming" },
  documentImport: { label: "PDF and slide import", status: "upcoming" },
  multiVoiceDialogue: {
    label: "Multi-voice character dialogue",
    status: "upcoming",
  },
  chatStories: { label: "Animated chat conversations", status: "upcoming" },
  elementRegeneration: {
    label: "Regenerate individual elements",
    status: "upcoming",
  },
  scriptNarration: {
    label: "AI narration for your own scripts",
    status: "upcoming",
  },
  templates: {
    label: "Format templates (post cards, quizzes, chat layouts)",
    status: "upcoming",
  },
  speakerTracking: {
    label: "Speaker tracking and topic highlight ranking",
    status: "upcoming",
  },
  directPublishing: {
    label: "Direct publishing to TikTok, Instagram and YouTube",
    status: "upcoming",
  },
  analytics: { label: "Performance analytics", status: "upcoming" },
  teamReview: { label: "Team reviewers", status: "upcoming" },
} as const satisfies Record<
  string,
  { label: string; status: CapabilityStatus }
>;

export type CapabilityId = keyof typeof capabilities;

export function isAvailable(id: CapabilityId): boolean {
  return capabilities[id].status === "available";
}
