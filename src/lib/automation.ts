import { z } from "zod";
import { createSchema } from "./model";
import { publishingPolicySchema, type PublishingPolicy } from "./social";

export const grantSchema = z.object({
  name: z.string().trim().min(1).max(80),
  runLimit: z.number().int().min(1).max(200),
  creditLimit: z.number().int().min(1).max(5000),
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
