import type { Mode } from "@/lib/model";
import type { CapabilityId } from "./capabilities";
import type { ShowcaseCategory } from "./showcase";

export type FeatureSlug =
  | "ai-video-generator"
  | "fictional-character-videos"
  | "ai-story-videos"
  | "gameplay-videos"
  | "educational-explainers"
  | "podcast-clipping"
  | "ai-marketing-videos";

export type FeaturePage = {
  slug: FeatureSlug;
  navLabel: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  headline: string;
  intro: string;
  mode: Mode;
  showcase: ShowcaseCategory | null;
  examplePrompt: string;
  steps: { title: string; body: string }[];
  highlights: { title: string; body: string; capability: CapabilityId }[];
  useCases: string[];
  faqs: { q: string; a: string }[];
};

export const featurePages: FeaturePage[] = [
  {
    slug: "ai-video-generator",
    navLabel: "AI video generator",
    metaTitle: "AI Video Generator for Short-Form Video",
    metaDescription:
      "Turn an idea or a script into a captioned, narrated vertical video. Edit every scene, render an MP4, and review it before it goes anywhere.",
    eyebrow: "AI video generator",
    headline: "From a sentence to a finished short.",
    intro:
      "Describe the video you want, or paste a script you already wrote. Clipvero breaks it into scenes, adds captions and narration, and gives you an editable timeline that renders to MP4.",
    mode: "prompt",
    showcase: null,
    examplePrompt:
      "A 30-second explainer on why cats knock things off tables, told by a very serious narrator.",
    steps: [
      {
        title: "Start with an idea or a script",
        body: "One line is enough. Pasted scripts are kept word for word unless you ask for a rewrite.",
      },
      {
        title: "Shape the scenes",
        body: "Adjust timing, captions, backgrounds and transitions scene by scene in the browser editor.",
      },
      {
        title: "Render and review",
        body: "Render an MP4, watch it back, approve the revision you are happy with and download it.",
      },
    ],
    highlights: [
      {
        title: "Your script stays yours",
        body: "Scripts you paste are used as written. Rewrites only happen when you request them.",
        capability: "scriptToVideo",
      },
      {
        title: "Narration in the voice you pick",
        body: "AI-written videos can be narrated in the voice and tone you choose, or kept caption-only.",
        capability: "narration",
      },
      {
        title: "Vertical, square or widescreen",
        body: "Render 9:16 for Shorts, Reels and TikTok, or 1:1 and 16:9 when you need them.",
        capability: "mp4Render",
      },
      {
        title: "Preview equals render",
        body: "The editor preview and the final render use the same versioned timeline.",
        capability: "browserEditor",
      },
    ],
    useCases: [
      "Daily short-form posting",
      "Turning blog ideas into video",
      "Testing new content angles",
      "Repurposing scripts",
    ],
    faqs: [
      {
        q: "How long can a video be?",
        a: "Up to 180 seconds per video, which covers TikTok, Reels and YouTube Shorts.",
      },
      {
        q: "Can I bring my own script?",
        a: "Yes. Paste it in and it is used word for word. Captions are built from your text and you can add your own narration track in the editor.",
      },
      {
        q: "Can I change a single scene?",
        a: "Yes. Edit the caption, timing, visual or transition of any scene without rebuilding the whole video, then render a new revision.",
      },
    ],
  },
  {
    slug: "fictional-character-videos",
    navLabel: "Fictional character videos",
    metaTitle: "Fictional Character Video Maker",
    metaDescription:
      "Create original characters once and reuse them across a series of short videos, with consistent looks, voices and personalities.",
    eyebrow: "Character stories",
    headline: "Original characters. A world of your own.",
    intro:
      "Give each character a look, a personality, a voice preference and continuity notes. Those records travel into every new script, so a recurring cast can carry a whole series.",
    mode: "characters",
    showcase: "character",
    examplePrompt:
      "Two robots argue over who invented Wi-Fi while waiting for a software update.",
    steps: [
      {
        title: "Build your cast",
        body: "Describe appearance, personality, speech style and continuity rules. Add a reference image you own.",
      },
      {
        title: "Write the scene",
        body: "Pick up to four characters and describe what happens. The script draws on each character's personality and speech style.",
      },
      {
        title: "Keep the series going",
        body: "Reuse the same cast in every episode and refine them as the story grows.",
      },
    ],
    highlights: [
      {
        title: "Reusable character records",
        body: "Characters live in your workspace and can be added to any project.",
        capability: "characters",
      },
      {
        title: "Voice and speech style",
        body: "Save a voice preference and speech style with each character.",
        capability: "characters",
      },
      {
        title: "Multi-voice dialogue",
        body: "Each character speaking in its own voice within one video.",
        capability: "multiVoiceDialogue",
      },
      {
        title: "Original imagery",
        body: "Generate original visuals for each scene. Only use references you have the rights to.",
        capability: "originalImages",
      },
    ],
    useCases: [
      "Recurring comedy series",
      "Animated chat stories",
      "Mascot-led content",
      "Kids-safe storytelling",
    ],
    faqs: [
      {
        q: "Can I use existing famous characters?",
        a: "No. Clipvero is built for original characters you create or have the rights to use.",
      },
      {
        q: "How many characters can appear in one video?",
        a: "Up to four characters per project.",
      },
      {
        q: "Will the character look the same every time?",
        a: "Character records carry appearance and continuity notes into every new script, and you can attach an approved reference image you own. Review each scene and edit anything that doesn't match.",
      },
    ],
  },
  {
    slug: "ai-story-videos",
    navLabel: "AI story videos",
    metaTitle: "AI Story Video Generator",
    metaDescription:
      "Turn short stories, confessions and Reddit-style original posts into narrated, captioned vertical videos.",
    eyebrow: "Narrated stories",
    headline: "Give your stories a voice.",
    intro:
      "Write a story or let Clipvero draft one from your premise. It is paced into scenes with word-timed captions and narration, ready for a gameplay or visual background.",
    mode: "story",
    showcase: "story",
    examplePrompt:
      "A lighthouse keeper finds a message in a bottle addressed to him, dated fifty years in the future.",
    steps: [
      {
        title: "Bring the story",
        body: "Paste your own writing or describe a premise, tone and length.",
      },
      {
        title: "Choose the delivery",
        body: "Pick a narrator, caption style and the background that suits the mood.",
      },
      {
        title: "Render the episode",
        body: "Review the cut, regenerate any scene and export an MP4.",
      },
    ],
    highlights: [
      {
        title: "Post-style story cards",
        body: "Present original stories in a familiar post layout.",
        capability: "templates",
      },
      {
        title: "Narration and captions",
        body: "Captions stay in time with the narration.",
        capability: "narration",
      },
      {
        title: "Multi-part series",
        body: "Split longer stories across episodes with a consistent look.",
        capability: "presets",
      },
      {
        title: "Your own writing, protected",
        body: "Stories you paste are kept as written unless you ask for edits.",
        capability: "scriptToVideo",
      },
    ],
    useCases: [
      "Original short fiction",
      "Reddit-style storytelling",
      "Serialized mysteries",
      "Bedtime stories",
    ],
    faqs: [
      {
        q: "Can I repost other people's Reddit stories?",
        a: "No. Use stories you wrote or have permission to use. A post-style layout for original writing is upcoming.",
      },
      {
        q: "Can a story run across several videos?",
        a: "Yes. Create a series of projects using the same style preset so each part looks consistent.",
      },
      {
        q: "Can I write the story myself?",
        a: "Yes. Paste it in and it is used word for word.",
      },
    ],
  },
  {
    slug: "gameplay-videos",
    navLabel: "Gameplay background videos",
    metaTitle: "Gameplay Background Video Maker",
    metaDescription:
      "Put narrated stories and commentary on top of gameplay footage you own, with captions and vertical framing handled for you.",
    eyebrow: "Gameplay stories",
    headline: "Your footage, with a story on top.",
    intro:
      "Upload gameplay you recorded or have the rights to use, paste your story, and Clipvero lays it over the footage as captioned scenes in vertical format. Add your own voiceover track if you have one.",
    mode: "gameplay",
    showcase: "gameplay",
    examplePrompt:
      "The story of the worst parkour run ever attempted, told over my speedrun footage.",
    steps: [
      {
        title: "Upload your footage",
        body: "Add gameplay recordings you own or are licensed to use.",
      },
      {
        title: "Add the story",
        body: "Paste your script. Each paragraph becomes a captioned scene over the footage.",
      },
      {
        title: "Frame and render",
        body: "Reframe to 9:16, choose start points per scene and export.",
      },
    ],
    highlights: [
      {
        title: "Your recordings",
        body: "Bring your own gameplay. Uploads stay private to your workspace.",
        capability: "uploads",
      },
      {
        title: "Choose the moment",
        body: "Pick where each scene starts within the source footage.",
        capability: "browserEditor",
      },
      {
        title: "Vertical reframing",
        body: "Cover or contain framing for each scene.",
        capability: "browserEditor",
      },
      {
        title: "AI voice for your script",
        body: "Have your own gameplay script narrated by an AI voice.",
        capability: "scriptNarration",
      },
    ],
    useCases: [
      "Story narration over gameplay",
      "Speedrun commentary",
      "Patch-note recaps",
      "Game lore explainers",
    ],
    faqs: [
      {
        q: "Does Clipvero provide gameplay footage?",
        a: "No. Upload footage you recorded or have rights to use.",
      },
      {
        q: "Can I pick which part of the footage is shown?",
        a: "Yes. Each scene has its own start point in the source video.",
      },
      {
        q: "Are my uploads public?",
        a: "No. Uploads are private to your workspace.",
      },
    ],
  },
  {
    slug: "educational-explainers",
    navLabel: "Educational explainers",
    metaTitle: "Educational Explainer Video Maker",
    metaDescription:
      "Turn lessons and concepts into clear short explainers. Review claims and sources before you export.",
    eyebrow: "Educational explainers",
    headline: "Make a big idea easy to understand.",
    intro:
      "Start from a topic, a lesson plan or your own script. Clipvero structures it into clear steps with visuals and captions, and you review every claim before anything is exported.",
    mode: "explainer",
    showcase: "explainer",
    examplePrompt:
      "Explain how vaccines train the immune system, for curious 12-year-olds, in 45 seconds.",
    steps: [
      {
        title: "Set the topic and audience",
        body: "Describe the concept, who it's for and the tone you want.",
      },
      {
        title: "Check the claims",
        body: "Review the script and sources scene by scene before rendering.",
      },
      {
        title: "Teach in under a minute",
        body: "Render a captioned explainer ready for class or social.",
      },
    ],
    highlights: [
      {
        title: "Structured scenes",
        body: "Each idea gets its own scene with a caption and visual.",
        capability: "promptToVideo",
      },
      {
        title: "Review before export",
        body: "Approve a specific rendered revision before it is downloaded.",
        capability: "reviewApproval",
      },
      {
        title: "Consistent course style",
        body: "Save a style preset for every lesson in a series.",
        capability: "presets",
      },
      {
        title: "Script files",
        body: "Import a TXT or Markdown lesson script from your computer.",
        capability: "scriptFileImport",
      },
    ],
    useCases: [
      "Classroom micro-lessons",
      "Course trailers",
      "Concept explainers",
      "Training refreshers",
    ],
    faqs: [
      {
        q: "Are AI-written facts checked automatically?",
        a: "No. You review every claim before export, and nothing is approved without you.",
      },
      {
        q: "Can I import my slides or PDFs?",
        a: "PDF and slide import are upcoming. You can already import a TXT or Markdown script, or paste the text you want to cover.",
      },
      {
        q: "Can I keep a consistent look across a course?",
        a: "Yes. Save a style preset and apply it to every lesson.",
      },
    ],
  },
  {
    slug: "podcast-clipping",
    navLabel: "Automatic podcast clipping",
    metaTitle: "Automatic Podcast and Long Video Clipping",
    metaDescription:
      "Upload a podcast, interview or webinar. Clipvero transcribes it, suggests highlight segments from the real recording, and turns them into captioned vertical clips.",
    eyebrow: "Long video to clips",
    headline: "Find the moments worth sharing.",
    intro:
      "Upload a long recording you own. Clipvero transcribes it with timestamps, groups the transcript into excerpts that fit your target length, and turns them into captioned vertical clips with the original audio.",
    mode: "clips",
    showcase: "clipped",
    examplePrompt: "Find three moments where we disagree about remote work.",
    steps: [
      {
        title: "Upload the recording",
        body: "Podcasts, interviews, webinars or streams you have rights to.",
      },
      {
        title: "Review the excerpts",
        body: "Every excerpt points to real timestamps in your source. Trim the in and out points.",
      },
      {
        title: "Caption and reframe",
        body: "Add word-timed captions, reframe to vertical and render each clip.",
      },
    ],
    highlights: [
      {
        title: "Timestamped transcript",
        body: "Every suggestion points to a real moment in your source.",
        capability: "autoClipping",
      },
      {
        title: "Up to five clips per run",
        body: "Choose how many timestamped excerpts you want from each recording.",
        capability: "autoClipping",
      },
      {
        title: "Captions and vertical framing",
        body: "Ready for Shorts, Reels and TikTok.",
        capability: "browserEditor",
      },
      {
        title: "Speaker tracking and topic ranking",
        body: "Smarter selection that follows speakers and ranks topics.",
        capability: "speakerTracking",
      },
    ],
    useCases: [
      "Podcast promotion",
      "Webinar highlights",
      "Interview pull-quotes",
      "Stream recaps",
    ],
    faqs: [
      {
        q: "How does Clipvero pick highlights?",
        a: "It reads the timestamped transcript and proposes excerpts that exist in your recording. You choose which ones become clips and adjust their in and out points.",
      },
      {
        q: "Do you predict which clips will perform best?",
        a: "No. We suggest excerpts from your recording; we don't make performance predictions.",
      },
      {
        q: "Is my recording private?",
        a: "Yes. Uploads are private to your workspace.",
      },
    ],
  },
  {
    slug: "ai-marketing-videos",
    navLabel: "AI marketing videos",
    metaTitle: "AI Marketing Video Maker for Products",
    metaDescription:
      "Turn approved product information and your brand media into short product videos. No invented claims, no fake endorsements.",
    eyebrow: "Product & marketing",
    headline: "Put your product in the spotlight.",
    intro:
      "Give Clipvero the product details you've approved and your brand media. It drafts short promos, feature highlights and launch teasers using only what you supplied.",
    mode: "marketing",
    showcase: "marketing",
    examplePrompt:
      "A 20-second launch teaser for our reusable coffee cup, focused on the leak-proof lid.",
    steps: [
      {
        title: "Share approved details",
        body: "Product facts, benefits and the brand assets you own.",
      },
      {
        title: "Get a first draft",
        body: "A script and scenes built from your facts. Edit the copy and visuals freely.",
      },
      {
        title: "Review and ship",
        body: "Approve the final render before it goes to your channels.",
      },
    ],
    highlights: [
      {
        title: "Brand presets",
        body: "Colors, caption style and voice saved for every campaign.",
        capability: "presets",
      },
      {
        title: "Only your claims",
        body: "Copy is built from information you provide. No invented reviews or endorsements.",
        capability: "promptToVideo",
      },
      {
        title: "Your media",
        body: "Upload product shots and clips you own.",
        capability: "uploads",
      },
      {
        title: "Website fetching",
        body: "Pull product details straight from a page URL.",
        capability: "urlImport",
      },
    ],
    useCases: [
      "Product launches",
      "Feature highlights",
      "Ad creative testing",
      "Founder-led promos",
    ],
    faqs: [
      {
        q: "Will Clipvero add testimonials or stats?",
        a: "No. It only uses claims and information you supply and approve.",
      },
      {
        q: "Can I keep my brand colors?",
        a: "Yes. Save them in a style preset with your caption and voice settings.",
      },
      {
        q: "Can I start from my product page?",
        a: "You can add the link as context today. Automatic website fetching is upcoming, so paste the product details you want used.",
      },
    ],
  },
];

export function getFeaturePage(slug: string): FeaturePage | undefined {
  return featurePages.find((page) => page.slug === slug);
}

export function featureHref(slug: FeatureSlug): string {
  return `/features/${slug}`;
}
