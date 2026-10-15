import { z } from "zod";
import { appUrl } from "./auth";
import { AppError } from "./errors";
import {
  tikTokCreatorSchema,
  type TikTokPost,
  type SocialProvider,
} from "@/lib/social";

const igBase = "https://graph.instagram.com/v26.0";
const ttBase = "https://open.tiktokapis.com/v2";
const tokenSchema = z.object({
  access_token: z.string().min(1).max(10000),
  refresh_token: z.string().max(10000).optional(),
  expires_in: z
    .number()
    .positive()
    .max(366 * 86400),
  open_id: z.string().max(200).optional(),
  scope: z.string().max(2000).optional(),
});
const instagramTokenSchema = z.object({
  access_token: z.string().min(1).max(10000),
  user_id: z.union([z.string().min(1).max(200), z.number().int().safe()]),
  permissions: z
    .union([z.string().max(2000), z.array(z.string().min(1).max(200)).max(50)])
    .optional(),
});
export type SocialCredentials = { accessToken: string; refreshToken?: string };
export class ProviderError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}
async function request(url: string, options: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new ProviderError(
      "The platform request did not return a response. Check the account before retrying.",
      options.method === "POST",
    );
  }
  let body: unknown = null;
  const reader = response.body?.getReader();
  if (reader) {
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > 1024 * 1024) {
          await reader.cancel();
          throw new Error("Provider response exceeded 1 MB.");
        }
        chunks.push(part.value);
      }
      body = JSON.parse(
        Buffer.concat(chunks).toString("utf8"),
        (_key: string, value: unknown, context?: { source?: string }) =>
          typeof value === "number" &&
          Number.isInteger(value) &&
          !Number.isSafeInteger(value) &&
          context?.source
            ? context.source
            : value,
      );
    } catch {
      throw new ProviderError(
        "The platform returned an unreadable response. Check the account before retrying.",
        options.method === "POST",
      );
    } finally {
      reader.releaseLock();
    }
  }
  const envelope = z
    .object({
      error: z
        .union([
          z.string(),
          z.object({ code: z.union([z.string(), z.number()]).optional() }),
        ])
        .optional(),
    })
    .passthrough()
    .safeParse(body);
  const error = envelope.success ? envelope.data.error : undefined;
  if (
    !response.ok ||
    (error && (typeof error === "string" || error.code !== "ok"))
  ) {
    const code =
      typeof error === "object"
        ? String(error.code ?? response.status)
        : String(response.status);
    throw new ProviderError(
      `The platform rejected this request (${code.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 80)}). Check app permissions and reconnect if needed.`,
      response.status >= 500 && options.method === "POST",
    );
  }
  return body;
}
function get(url: string, token: string) {
  return request(url, { headers: { Authorization: `Bearer ${token}` } });
}
function post(url: string, token: string, body: unknown) {
  return request(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function form(url: string, params: Record<string, string>) {
  return request(url, { method: "POST", body: new URLSearchParams(params) });
}
export function socialConfig(provider: SocialProvider) {
  const clientId =
    process.env[
      provider === "instagram" ? "INSTAGRAM_APP_ID" : "TIKTOK_CLIENT_KEY"
    ];
  const secret =
    process.env[
      provider === "instagram" ? "INSTAGRAM_APP_SECRET" : "TIKTOK_CLIENT_SECRET"
    ];
  if (!clientId || !secret)
    throw new AppError(
      503,
      `Add ${provider === "instagram" ? "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET" : "TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET"} to .env, then restart the website and publisher.`,
    );
  const origin = new URL(appUrl());
  if (origin.protocol !== "https:")
    throw new AppError(
      503,
      "Account connections require a public HTTPS APP_URL and matching platform redirect URLs.",
    );
  return {
    clientId,
    secret,
    redirectUri: `${origin.origin}/api/social/callback/${provider}`,
  };
}
export function authorizeUrl(provider: SocialProvider, state: string) {
  const config = socialConfig(provider);
  const url = new URL(
    provider === "instagram"
      ? "https://www.instagram.com/oauth/authorize/"
      : "https://www.tiktok.com/v2/auth/authorize/",
  );
  url.search = new URLSearchParams({
    [provider === "instagram" ? "client_id" : "client_key"]: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope:
      provider === "instagram"
        ? "instagram_business_basic,instagram_business_content_publish"
        : "user.info.basic,video.publish",
    state,
  }).toString();
  return url.toString();
}
export async function exchangeSocialCode(
  provider: SocialProvider,
  code: string,
) {
  const config = socialConfig(provider);
  if (provider === "instagram") {
    const raw = await form("https://api.instagram.com/oauth/access_token", {
      client_id: config.clientId,
      client_secret: config.secret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    });
    const parsed = z
      .union([
        instagramTokenSchema,
        z
          .object({ data: z.array(instagramTokenSchema).length(1) })
          .transform((value) => value.data[0]),
      ])
      .safeParse(raw);
    if (!parsed.success)
      throw new AppError(
        502,
        "Instagram returned an incomplete authorization response. Start again from Automation.",
      );
    const short = parsed.data;
    const permissions =
      typeof short.permissions === "string"
        ? short.permissions.split(",").map((value) => value.trim())
        : short.permissions;
    if (
      permissions &&
      !permissions.includes("instagram_business_content_publish")
    )
      throw new AppError(
        403,
        "Instagram publishing permission was not granted.",
      );
    const url = new URL("https://graph.instagram.com/access_token");
    url.search = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: config.secret,
      access_token: short.access_token,
    }).toString();
    const long = tokenSchema.parse(await request(url.toString()));
    const profile = z
      .object({
        user_id: z.union([z.string(), z.number()]),
        username: z.string().min(1).max(200),
      })
      .parse(
        await get(`${igBase}/me?fields=user_id,username`, long.access_token),
      );
    if (!permissions) {
      const limit = z
        .object({
          data: z
            .array(z.object({ quota_usage: z.number().int().nonnegative() }))
            .min(1),
        })
        .safeParse(
          await get(
            `${igBase}/${encodeURIComponent(String(profile.user_id))}/content_publishing_limit?fields=quota_usage`,
            long.access_token,
          ),
        );
      if (!limit.success)
        throw new AppError(
          502,
          "Instagram publishing access could not be verified. Start again from Automation.",
        );
    }
    return {
      accountId: String(profile.user_id),
      name: profile.username,
      credentials: { accessToken: long.access_token },
      expiresAt: Date.now() + long.expires_in * 1000,
    };
  }
  const data = tokenSchema.parse(
    await form(`${ttBase}/oauth/token/`, {
      client_key: config.clientId,
      client_secret: config.secret,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
      code,
    }),
  );
  if (
    !data.open_id ||
    !data.refresh_token ||
    !data.scope?.split(",").includes("video.publish")
  )
    throw new AppError(403, "TikTok publishing permission was not granted.");
  const user = z
    .object({
      data: z.object({ user: z.object({ display_name: z.string().max(200) }) }),
    })
    .parse(
      await get(
        `${ttBase}/user/info/?fields=open_id,display_name`,
        data.access_token,
      ),
    );
  return {
    accountId: data.open_id,
    name: user.data.user.display_name,
    credentials: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    },
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
export async function refreshSocialToken(
  provider: SocialProvider,
  credentials: SocialCredentials,
) {
  const config = socialConfig(provider);
  let raw: unknown;
  if (provider === "instagram") {
    const url = new URL("https://graph.instagram.com/refresh_access_token");
    url.search = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: credentials.accessToken,
    }).toString();
    raw = await request(url.toString());
  } else {
    if (!credentials.refreshToken)
      throw new ProviderError("Reconnect your TikTok account.");
    raw = await form(`${ttBase}/oauth/token/`, {
      client_key: config.clientId,
      client_secret: config.secret,
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
    });
  }
  const data = tokenSchema.parse(raw);
  return {
    credentials: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? credentials.refreshToken,
    },
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}
export async function startSocialUpload(
  provider: SocialProvider,
  accountId: string,
  token: string,
  videoUrl: string,
  caption: string,
  postInfo?: TikTokPost,
) {
  if (provider === "instagram")
    return z.object({ id: z.string().min(1).max(200) }).parse(
      await post(`${igBase}/${encodeURIComponent(accountId)}/media`, token, {
        media_type: "REELS",
        video_url: videoUrl,
        caption,
        share_to_feed: true,
        is_ai_generated: true,
      }),
    ).id;
  return z
    .object({ data: z.object({ publish_id: z.string().min(1).max(200) }) })
    .parse(
      await post(`${ttBase}/post/publish/video/init/`, token, {
        post_info: {
          ...postInfo,
          consent: undefined,
          title: caption,
          is_aigc: true,
        },
        source_info: { source: "PULL_FROM_URL", video_url: videoUrl },
      }),
    ).data.publish_id;
}
export async function socialUploadStatus(
  provider: SocialProvider,
  providerId: string,
  token: string,
) {
  if (provider === "instagram")
    return {
      state: z
        .object({
          status_code: z.enum([
            "FINISHED",
            "IN_PROGRESS",
            "PUBLISHED",
            "ERROR",
            "EXPIRED",
          ]),
        })
        .parse(
          await get(
            `${igBase}/${encodeURIComponent(providerId)}?fields=status_code`,
            token,
          ),
        ).status_code,
      postId: null,
    };
  const data = z
    .object({
      data: z.object({
        status: z.enum([
          "PROCESSING_UPLOAD",
          "PROCESSING_DOWNLOAD",
          "SEND_TO_USER_INBOX",
          "PUBLISH_COMPLETE",
          "FAILED",
        ]),
        publicaly_available_post_id: z
          .array(
            z.union([z.string(), z.number().int().safe()]).transform(String),
          )
          .optional(),
      }),
    })
    .parse(
      await post(`${ttBase}/post/publish/status/fetch/`, token, {
        publish_id: providerId,
      }),
    ).data;
  return {
    state: data.status,
    postId: data.publicaly_available_post_id?.[0] ?? null,
  };
}
export async function publishInstagram(
  accountId: string,
  providerId: string,
  token: string,
) {
  return z
    .object({ id: z.string().min(1).max(200) })
    .parse(
      await post(
        `${igBase}/${encodeURIComponent(accountId)}/media_publish`,
        token,
        { creation_id: providerId },
      ),
    ).id;
}
export async function instagramPermalink(postId: string, token: string) {
  const url = z
    .object({ permalink: z.string().url() })
    .parse(
      await get(
        `${igBase}/${encodeURIComponent(postId)}?fields=permalink`,
        token,
      ),
    ).permalink;
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !["www.instagram.com", "instagram.com"].includes(parsed.hostname)
  )
    throw new ProviderError("The platform returned an invalid post link.");
  return url;
}

export async function tikTokCreator(token: string) {
  return z
    .object({ data: tikTokCreatorSchema })
    .parse(await post(`${ttBase}/post/publish/creator_info/query/`, token, {}))
    .data;
}
export function validateTikTokPost(
  creator: z.infer<typeof tikTokCreatorSchema>,
  postInfo: TikTokPost,
  seconds: number,
) {
  if (
    !creator.privacy_level_options.includes(postInfo.privacy_level) ||
    seconds > creator.max_video_post_duration_sec ||
    (creator.comment_disabled && !postInfo.disable_comment) ||
    (creator.duet_disabled && !postInfo.disable_duet) ||
    (creator.stitch_disabled && !postInfo.disable_stitch)
  )
    throw new AppError(
      422,
      "TikTok account settings or video limits changed. Review the video with the latest account settings before posting.",
    );
}
