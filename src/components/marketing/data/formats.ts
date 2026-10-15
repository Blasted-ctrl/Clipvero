import type { Mode } from "@/lib/model";
import type { CapabilityId } from "./capabilities";
import type { FeatureSlug } from "./features";

export type FormatPreview =
  | "characters"
  | "story"
  | "gameplay"
  | "explainer"
  | "forum"
  | "chat"
  | "product"
  | "clips";

export type VideoFormat = {
  id: string;
  title: string;
  description: string;
  useCase: string;
  feature: FeatureSlug;
  mode: Mode;
  capability: CapabilityId;
  preview: FormatPreview;
  prompt: string;
};

export const videoFormats: VideoFormat[] = [
  {
    id: "character-stories",
    title: "Fictional character stories",
    description:
      "A recurring cast with saved looks, personalities and voice preferences for every episode.",
    useCase: "Comedy series and mascot-led channels",
    feature: "fictional-character-videos",
    mode: "characters",
    capability: "characters",
    preview: "characters",
    prompt:
      "Two robots argue over who invented Wi-Fi while waiting for a software update.",
  },
  {
    id: "short-stories",
    title: "AI-generated short stories",
    description:
      "Premise in, narrated short story out, paced into scenes with captions.",
    useCase: "Original fiction and serialized mysteries",
    feature: "ai-story-videos",
    mode: "story",
    capability: "promptToVideo",
    preview: "story",
    prompt:
      "A lighthouse keeper finds a message in a bottle dated fifty years in the future.",
  },
  {
    id: "gameplay-narration",
    title: "Gameplay narration",
    description:
      "Narration and captions layered over gameplay footage you own.",
    useCase: "Story channels and gaming commentary",
    feature: "gameplay-videos",
    mode: "gameplay",
    capability: "uploads",
    preview: "gameplay",
    prompt:
      "Narrate the story of the worst parkour run ever attempted over my footage.",
  },
  {
    id: "explainers",
    title: "Educational explainers",
    description:
      "Concepts broken into clear, captioned steps you review before export.",
    useCase: "Teachers, course creators and science channels",
    feature: "educational-explainers",
    mode: "explainer",
    capability: "promptToVideo",
    preview: "explainer",
    prompt:
      "Explain how vaccines train the immune system for 12-year-olds in 45 seconds.",
  },
  {
    id: "forum-stories",
    title: "Reddit-style original stories",
    description:
      "Your original story-time posts, narrated with captions. A post-card layout template is upcoming.",
    useCase: "Storytime and confession-style channels",
    feature: "ai-story-videos",
    mode: "story",
    capability: "scriptToVideo",
    preview: "forum",
    prompt:
      "An original story-time post: I accidentally became my town's weather forecaster.",
  },
  {
    id: "chat-conversations",
    title: "Animated chat conversations",
    description:
      "Dialogue between your characters, revealed message by message.",
    useCase: "Text-story and dialogue comedy",
    feature: "fictional-character-videos",
    mode: "characters",
    capability: "chatStories",
    preview: "chat",
    prompt:
      "A group chat between three houseplants planning an escape from the windowsill.",
  },
  {
    id: "product-marketing",
    title: "Product marketing",
    description:
      "Promos and launch teasers built only from the product details you approve.",
    useCase: "Launches, feature highlights and ad tests",
    feature: "ai-marketing-videos",
    mode: "marketing",
    capability: "promptToVideo",
    preview: "product",
    prompt:
      "A 20-second launch teaser for our reusable coffee cup, focused on the leak-proof lid.",
  },
  {
    id: "auto-clipping",
    title: "Long-video auto-clipping",
    description:
      "Timestamped transcripts surface highlight segments from your real recording.",
    useCase: "Podcasts, webinars and interviews",
    feature: "podcast-clipping",
    mode: "clips",
    capability: "autoClipping",
    preview: "clips",
    prompt: "Find three moments where the hosts disagree about remote work.",
  },
];
