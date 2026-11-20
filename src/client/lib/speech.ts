/** Read-aloud via the Web Speech API, feature-detected (docs/06 §3). */

/** True when the browser can speak. */
export function canSpeak(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance === 'function'
  );
}

/** Speaks text; calls `onEnd` when finished or stopped. */
export function speak(text: string, lang: string, onEnd: () => void): void {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}
