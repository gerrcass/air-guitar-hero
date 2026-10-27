export interface TestBridge {
  finishRun?: (options?: { passed?: boolean; scoreRatio?: number }) => void;
  completeRun?: () => void;
  failRun?: () => void;
  seek?: (seconds: number) => void;
  autoplay?: (seconds?: number) => void;
  completeLesson?: () => void;
  completeTutorial?: () => void;
  songTime?: () => number;
}

declare global {
  interface Window {
    __AGH_TEST__?: TestBridge;
  }
}

export function isE2E(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("e2e") === "1") return true;
    return window.localStorage.getItem("agh:e2e") === "1";
  } catch {
    return false;
  }
}

/** Register deterministic hooks only when the URL or storage opts in. */
export function installTestBridge(bridge: TestBridge): () => void {
  if (!isE2E()) return () => undefined;
  window.__AGH_TEST__ = { ...window.__AGH_TEST__, ...bridge };
  return () => {
    if (window.__AGH_TEST__ === undefined) return;
    for (const key of Object.keys(bridge) as (keyof TestBridge)[]) {
      delete window.__AGH_TEST__[key];
    }
  };
}
