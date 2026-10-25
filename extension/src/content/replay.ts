/**
 * Instant replay (injected by the service worker into the top document, the extension's isolated world).
 * Page recording — ReplayBuffer from src/core: the last 2 minutes, nothing is sent
 * until the user presses "Last 2 min".
 */

import { ReplayBuffer } from "../core/replay-buffer";
import { getPrefs } from "../shared/prefs";
import { REPLAY_WINDOW_MS, type Prefs } from "../shared/types";

const w = window as any;
if (!w.__adtaskReplayLoaded) {
  w.__adtaskReplayLoaded = true;
  void setup();
}

async function setup() {
  const buffer = new ReplayBuffer({ windowMs: REPLAY_WINDOW_MS, blockSelector: "adtask-recorder" });
  const enabledFor = (p: Prefs) => p.instantReplay && !p.replayExcluded.includes(location.origin);

  w.__adtaskReplay = () => {
    const events = buffer.events();
    return events ? { events } : null;
  };

  const apply = (p: Prefs) => (enabledFor(p) ? buffer.start() : buffer.stop());
  apply(await getPrefs());
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.prefs) void getPrefs().then(apply);
  });
}
