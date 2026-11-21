/**
 * API client. Every response is validated before use; the AI calls fall back to the same
 * deterministic answers in the browser if the server cannot be reached (docs/04 §7).
 */
import type * as z from 'zod/mini';

import { composeBrief } from '../../shared/ai/fallback.js';
import { rulesAnswer } from '../../shared/ai/rules.js';
import {
  type AiContext,
  AskReply,
  type AskResponse,
  BriefReply,
  type BriefResponse,
  type Language,
} from '../../shared/schema/ai.js';
import { AirData, GeocodeResponse, roundCoord } from '../../shared/schema/air.js';
import type { Location } from '../../shared/schema/profile.js';

/**
 * The client's only door to the network (an adapter over the browser's fetch): validates every
 * response and throws on failure; callers decide the fallback.
 */
async function request<T>(
  url: string,
  schema: z.ZodMiniType<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('accept', 'application/json');
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Unexpected response');
  }
  return parsed.data;
}

/** Request options carrying an abort signal when one is given. */
const withSignal = (signal?: AbortSignal): RequestInit => (signal ? { signal } : {});

const postJson = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
  ...withSignal(signal),
});

/** Live air data for the 0.1° cell around a point (coordinates are rounded here, too). */
export function fetchAir(lat: number, lon: number, signal?: AbortSignal): Promise<AirData> {
  const query = new URLSearchParams({ lat: String(roundCoord(lat)), lon: String(roundCoord(lon)) });
  return request(`/api/air?${query.toString()}`, AirData, withSignal(signal));
}

/** Places matching a name. */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Location[]> {
  const query = new URLSearchParams({ q });
  const body = await request(
    `/api/geocode?${query.toString()}`,
    GeocodeResponse,
    withSignal(signal),
  );
  return body.results;
}

/** The daily brief; never rejects (falls back to the template). */
export async function requestBrief(
  context: AiContext,
  signal?: AbortSignal,
): Promise<BriefResponse> {
  try {
    return await request('/api/brief', BriefReply, postJson({ context }, signal));
  } catch {
    // Offline, aborted or rejected: by design the browser composes the same rules-based brief,
    // and the UI labels its source ("Written from your plan's rules").
    return composeBrief(context);
  }
}

/** Ask Smogwise; never rejects (falls back to safety or intent answers in the browser). */
export async function askSmogwise(
  question: string,
  context: AiContext,
  language: Language,
  signal?: AbortSignal,
): Promise<AskResponse> {
  try {
    return await request('/api/ask', AskReply, postJson({ question, context, language }, signal));
  } catch {
    // Offline or rejected: by design the browser answers from the same rules (safety first), and
    // the UI labels the answer's source.
    return rulesAnswer(question, context, language);
  }
}
