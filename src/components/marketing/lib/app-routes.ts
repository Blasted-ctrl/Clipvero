/**
 * Routes owned by the authenticated application. The marketing site links to
 * these and never re-implements their behavior.
 */
export const appRoutes = {
  signIn: "/login",
  signUp: "/signup",
  create: "/create",
  autopilot: "/pipelines",
  billing: "/billing",
  help: "/help",
} as const;

/** Sign-up entry that returns the visitor to `next` once their account exists. */
export function signUpHref(
  next?: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams(extra);
  if (next) params.set("next", next);
  const query = params.toString();
  return query ? `${appRoutes.signUp}?${query}` : appRoutes.signUp;
}
