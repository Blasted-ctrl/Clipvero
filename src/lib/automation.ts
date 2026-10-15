import { z } from "zod";
import { createSchema } from "./model";
import { publishingPolicySchema, type PublishingPolicy } from "./social";

export const grantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  runLimit: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(8)]),
  creditLimit: z.number().int().min(1).max(1200),
  expiresHours: z.number().int().min(1).max(168).default(24),
  publishing: publishingPolicySchema.optional(),
});

export const batchSchema = z
  .object({
    requestId: z.string().uuid(),
    videos: z.array(createSchema).min(1).max(8),
  })
  .strict();

export type AgentGrant = {
  id: string;
  name: string;
  runLimit: number;
  creditLimit: number;
  runs: number;
  spent: number;
  expiresAt: number;
  revokedAt: number | null;
  createdAt: number;
  publishing: PublishingPolicy | null;
  expired?: boolean;
};
