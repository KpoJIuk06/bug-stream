import { DEFAULT_PREFS, type Prefs } from "./types";

export async function getPrefs(): Promise<Prefs> {
  const { prefs } = await chrome.storage.local.get({ prefs: DEFAULT_PREFS });
  return { ...DEFAULT_PREFS, ...(prefs as Partial<Prefs>) };
}

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await getPrefs()), ...patch };
  await chrome.storage.local.set({ prefs: next });
  return next;
}

export { filterNetwork, networkMatcher } from "../core/filter";
