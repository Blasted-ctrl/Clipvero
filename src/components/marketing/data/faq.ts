import { plans } from "@/lib/model";

export type FaqEntry = { id: string; q: string; a: string };

const credits = (key: keyof typeof plans) =>
  plans[key].credits.toLocaleString("en-US");

export const faqEntries: FaqEntry[] = [
  {
    id: "what-can-it-create",
    q: "What can Clipvero create?",
    a: "Short-form videos up to 180 seconds: fictional character stories, narrated short stories, gameplay narration, educational explainers, product promos and clips cut from your own long recordings. Videos render to MP4 in 9:16, 1:1 or 16:9.",
  },
  {
    id: "editing-experience",
    q: "Do I need video editing experience?",
    a: "No. Clipvero builds the scenes, captions and timing for you. When you want control, the browser editor lets you change scenes, captions, timing and transitions without a traditional timeline.",
  },
  {
    id: "upload-existing",
    q: "Can I upload existing videos?",
    a: "Yes. Upload recordings, gameplay or brand media you own or are licensed to use. You confirm ownership when uploading, and uploads stay private to your workspace.",
  },
  {
    id: "reuse-characters",
    q: "Can I reuse fictional characters?",
    a: "Yes. Save original characters with their appearance, personality, voice and continuity notes, then add up to four of them to any project. Characters must be your own creations or ones you have rights to use.",
  },
  {
    id: "autopilot",
    q: "How does Autopilot work?",
    a: "You save a format, topic and style as a pipeline, then choose how often it runs (from daily to monthly), how many runs it may make and a total credit budget. Pipelines are saved paused until you activate them. Each run drafts a video for your review queue, and nothing is posted for you.",
  },
  {
    id: "edit-ai-videos",
    q: "Can I edit AI-generated videos?",
    a: "Yes. Every generated video opens as an editable timeline. Change captions, timing, visuals, music and transitions, or type an instruction like “make the captions yellow” and apply the proposed change. Then render a new revision.",
  },
  {
    id: "publish-platforms",
    q: "Can I publish to TikTok, Instagram, and YouTube?",
    a: "Direct publishing through official TikTok, Instagram and YouTube integrations is upcoming. Today you download the approved MP4 and post it yourself, and you can set a calendar reminder for each reviewed video.",
  },
  {
    id: "credits",
    q: "What are generation credits?",
    a: `Credits pay for generation and rendering. A standard video (up to 60 seconds with a script, AI narration with timed captions, up to six images and the final render) uses 10 credits. Your own scripts only use credits when you render: 1 per started minute. Plans add a monthly allowance (Starter ${credits("starter")}, Creator ${credits("creator")}, Studio ${credits("studio")}) that accumulates in your balance. Credits are reserved when a job starts and refunded if it fails.`,
  },
  {
    id: "commercial-use",
    q: "Can I use videos commercially?",
    a: "You can use videos you create for your own channels and business, provided the scripts, media and characters you supply are yours or properly licensed. Final usage terms will be published in our Terms of Service.",
  },
  {
    id: "render-fails",
    q: "What happens when a render fails?",
    a: "Credits are reserved when a job starts and refunded automatically if it fails. The job shows why it failed, and you can retry it once the issue is fixed. Every reservation and refund appears in your credit history.",
  },
  {
    id: "cancel",
    q: "What happens when I cancel?",
    a: "You cancel from the billing portal and your monthly allowance stops renewing. Your projects, rendered videos and remaining credit balance stay in your workspace.",
  },
  {
    id: "privacy",
    q: "Are my uploads private?",
    a: "Yes. Every upload, project and character belongs to a private workspace and is only accessible to you when signed in. Media is never used publicly without your action.",
  },
];
