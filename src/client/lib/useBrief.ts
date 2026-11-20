/** The daily brief for a plan. Requested only once live data is ready: one model call per visit. */
import { useEffect, useState } from 'preact/hooks';

import type { AiContext, BriefResponse } from '../../shared/schema/ai.js';
import { requestBrief } from './api.js';

export function useBrief(context: AiContext, ready: boolean): BriefResponse | null {
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  // Keyed on content, so re-renders with an equal context do not refetch.
  const key = JSON.stringify(context);
  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const controller = new AbortController();
    void requestBrief(JSON.parse(key) as AiContext, controller.signal).then((next) => {
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
