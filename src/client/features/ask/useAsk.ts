/** Ask Smogwise state: validation, the request, and the answer with the language it was asked in. */
import { useState } from 'preact/hooks';

import { MAX_QUESTION_CHARS } from '../../../shared/limits.js';
import type { AiContext, AskResponse, Language } from '../../../shared/schema/ai.js';
import { useAnnounce } from '../../lib/announcer.js';
import { askSmogwise } from '../../lib/api.js';

/** An answer keeps its own language, so `lang` stays right if the picker changes afterwards. */
export type Answer = AskResponse & { language: Language };

interface AskState {
  answer: Answer | null;
  busy: boolean;
  error: string | null;
  ask: (question: string, language: Language) => Promise<void>;
}

export function useAsk(context: AiContext): AskState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  const ask = async (question: string, language: Language): Promise<void> => {
    const trimmed = question.trim();
    if (trimmed === '') {
      setError('Type a question first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const reply = await askSmogwise(trimmed.slice(0, MAX_QUESTION_CHARS), context, language);
      setAnswer({ ...reply, language });
      announce('Answer ready.');
    } finally {
      setBusy(false);
    }
  };

  return { answer, busy, error, ask };
}
