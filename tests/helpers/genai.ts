/** A fake Gemini SDK: tests drive `generateContent` and inspect its calls. No network. */
import { vi } from 'vitest';

export const generateContent = vi.fn();

type GenAiModule = typeof import('@google/genai');

/** Module factory for `vi.mock('@google/genai', …)`: the real module with a fake client class. */
export async function fakeGenAiModule(
  importActual: () => Promise<GenAiModule>,
): Promise<GenAiModule> {
  const actual = await importActual();
  class FakeGoogleGenAI {
    models = { generateContent };
  }
  return { ...actual, GoogleGenAI: FakeGoogleGenAI as unknown as GenAiModule['GoogleGenAI'] };
}
