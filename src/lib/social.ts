import { z } from "zod";

export const providerSchema = z.enum(["instagram", "tiktok"]);
export type SocialProvider = z.infer<typeof providerSchema>;
export const tiktokPostSchema = z
  .object({
    privacy_level: z.enum([
      "PUBLIC_TO_EVERYONE",
      "MUTUAL_FOLLOW_FRIENDS",
      "FOLLOWER_OF_CREATOR",
      "SELF_ONLY",
    ]),
    disable_comment: z.boolean(),
    disable_duet: z.boolean(),
    disable_stitch: z.boolean(),
    brand_content_toggle: z.boolean(),
    brand_organic_toggle: z.boolean(),
    consent: z.literal(true),
  })
  .strict()
  .refine(
    (p) => !p.brand_content_toggle || p.privacy_level !== "SELF_ONLY",
    "Branded content cannot be private.",
  );
export type TikTokPost = z.infer<typeof tiktokPostSchema>;
export const tikTokCreatorSchema = z.object({
  creator_username: z.string().max(200),
  creator_nickname: z.string().max(200),
  privacy_level_options: z
    .array(
      z.enum([
        "PUBLIC_TO_EVERYONE",
        "MUTUAL_FOLLOW_FRIENDS",
        "FOLLOWER_OF_CREATOR",
        "SELF_ONLY",
      ]),
    )
    .max(4),
  comment_disabled: z.boolean(),
  duet_disabled: z.boolean(),
  stitch_disabled: z.boolean(),
  max_video_post_duration_sec: z.number().positive(),
});
export type TikTokCreator = z.infer<typeof tikTokCreatorSchema>;
export type SocialConnection = {
  id: string;
  provider: SocialProvider;
  name: string;
  expiresAt: number;
  disconnectedAt: number | null;
};
export const publishingPolicySchema = z
  .object({
    connectionIds: z.array(z.string().uuid()).max(2).default([]),
    automatic: z.boolean().default(false),
    startAt: z.number().int().positive(),
    intervalMinutes: z.number().int().min(15).max(1440),
    endAt: z.number().int().positive(),
  })
  .refine(
    (p) => p.endAt > p.startAt && p.endAt - p.startAt <= 7 * 86400000,
    "Choose a publishing window of at most seven days.",
  );
export type PublishingPolicy = z.infer<typeof publishingPolicySchema>;
export type Publication = {
  id: string;
  projectId: string;
  revision: number;
  provider: SocialProvider;
  accountName: string;
  caption: string;
  state: string;
  scheduledAt: number;
  postUrl: string | null;
  postId: string | null;
  error: string | null;
};
