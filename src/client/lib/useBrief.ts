/**
 * The daily brief for a plan. Waits for live data (no call for the seasonal estimate), then
 * refetches only when the plan summary changes; the server caches identical summaries.
 */
import { useEffect, useRef, useState } from 'preact/hooks';

import type { AiContext, BriefResponse } from '../../shared/schema/ai.js';
import { requestBrief } from './api.js';

export function useBrief(context: AiContext, ready: boolean): BriefResponse | null {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  // Keyed on content, so re-renders with an equal context do not refetch.
  const key = JSON.stringify(context);
  const latest = useRef(context);
  latest.current = context;
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const controller = new AbortController();
    void requestBrief(latest.current, controller.signal).then((next) => {
      if (!controller.signal.aborted) {
        setBrief(next);
      }
    });
    return () => {
      controller.abort();
    };
  }, [key, ready]);
  return brief;
}
