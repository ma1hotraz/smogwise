/** Read-aloud state for one piece of text (Web Speech API, feature-detected). */
import { useState } from 'preact/hooks';

import { canSpeak, speak, stopSpeaking } from './speech.js';

interface ReadAloud {
  supported: boolean;
  speaking: boolean;
  toggle: (text: string, lang: string) => void;
}

export function useReadAloud(): ReadAloud {
  const [speaking, setSpeaking] = useState(false);
  const toggle = (text: string, lang: string): void => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, lang, () => {
      setSpeaking(false);
    });
  };
  return { supported: canSpeak(), speaking, toggle };
}
