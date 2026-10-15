/**
 * Hands a showcase example ID to the Explore page so it can scroll to it,
 * keeping the URL clean (no `#fragment`).
 */
const KEY = "clipvero:showcase-target";

export function setShowcaseTarget(id: string): void {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* storage unavailable: Explore simply opens at the top */
  }
}

export function takeShowcaseTarget(): string | null {
  try {
    const id = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return id;
  } catch {
    return null;
  }
}
