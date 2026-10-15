import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "node:crypto";
import { cookies } from "next/headers";
import { all, one, run, transaction } from "./db";
import { AppError } from "./errors";

const cookieName = "clipvero_session";
export type Identity = {
  userId: string;
  workspaceId: string;
  email: string;
  name: string;
  workspaceName: string;
  credits: number;
  plan: string;
  subscriptionStatus: string;
};
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  const actual = scryptSync(password, salt, 64);
  return (
    actual.length === Buffer.from(hash, "hex").length &&
    timingSafeEqual(actual, Buffer.from(hash, "hex"))
  );
}
function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + 1000 * 60 * 60 * 24 * 14;
  run("DELETE FROM sessions WHERE expires_at < ?", Date.now());
  run(
    "INSERT INTO sessions VALUES (?, ?, ?)",
    tokenHash(token),
    userId,
    expires,
  );
  (await cookies()).set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(appUrl()).protocol === "https:",
    path: "/",
    expires: new Date(expires),
  });
}
export async function identity(): Promise<Identity | null> {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  return (
    one<Identity>(
      `SELECT u.id AS userId, u.email, u.name, w.id AS workspaceId, w.name AS workspaceName, w.credits, w.plan, w.subscription_status AS subscriptionStatus FROM sessions s JOIN users u ON s.user_id=u.id JOIN workspaces w ON w.owner_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,
      tokenHash(token),
      Date.now(),
    ) ?? null
  );
}
export async function requireIdentity() {
  const me = await identity();
  if (!me) throw new AppError(401, "Sign in to continue.");
  return me;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(cookieName)?.value;
  if (token) run("DELETE FROM sessions WHERE token_hash=?", tokenHash(token));
  jar.delete(cookieName);
}
export function register(email: string, name: string, password: string) {
  if (
    process.env.NODE_ENV === "production" &&
    (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
  )
    throw new AppError(
      503,
      "Set SESSION_SECRET before enabling registration in production.",
    );
  return transaction(() => {
    if (one("SELECT id FROM users WHERE email=?", email))
      throw new AppError(409, "An account with that email already exists.");
    const userId = crypto.randomUUID(),
      workspaceId = crypto.randomUUID(),
      now = Date.now();
    run(
      "INSERT INTO users VALUES (?, ?, ?, ?, ?)",
      userId,
      email,
      name,
      hashPassword(password),
      now,
    );
    run(
      "INSERT INTO workspaces(id, owner_id, name, created_at) VALUES (?, ?, ?, ?)",
      workspaceId,
      userId,
      `${name.split(" ")[0]}'s studio`,
      now,
    );
    run(
      "INSERT INTO credit_ledger VALUES (?, ?, NULL, 'trial', 120, 'One-time trial credits', ?, ?)",
      crypto.randomUUID(),
      workspaceId,
      `trial:${workspaceId}`,
      now,
    );
    return userId;
  });
}
export function login(email: string, password: string) {
  const user = one<{ id: string; password_hash: string }>(
    "SELECT id, password_hash FROM users WHERE email=?",
    email,
  );
  const valid = verifyPassword(
    password,
    user?.password_hash ??
      "00000000000000000000000000000000:" + "00".repeat(64),
  );
  if (!user || !valid)
    throw new AppError(401, "Email or password is incorrect.");
  return user.id;
}
export function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(appUrl()).origin)
    throw new AppError(
      403,
      "This request must come from your Clipvero application.",
    );
}
export function rateLimit(key: string, limit: number, windowMs: number) {
  transaction(() => {
    const now = Date.now();
    run("DELETE FROM rate_limits WHERE resets_at < ?", now);
    const current = one<{ count: number }>(
      "SELECT count FROM rate_limits WHERE key=?",
      key,
    );
    if (current && current.count >= limit)
      throw new AppError(429, "Too many attempts. Please try again later.");
    run(
      "INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1",
      key,
      now + windowMs,
    );
  });
}
export function loginLimitKey(email: string) {
  return createHmac("sha256", process.env.SESSION_SECRET || "local-only")
    .update(email)
    .digest("hex");
}
export function listWorkspaces() {
  return all<{ id: string }>("SELECT id FROM workspaces");
}
