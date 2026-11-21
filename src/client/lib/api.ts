/**
 * API client. Every response is validated before use; the AI calls fall back to the same
 * deterministic answers in the browser if the server cannot be reached (docs/04 §7).
 */
import type * as z from 'zod/mini';

import { composeBrief } from '../../shared/ai/fallback.js';
import { rulesAnswer } from '../../shared/ai/rules.js';
import {
  AskReply,
  BriefReply,
  type AiContext,
  type AskResponse,
  type BriefResponse,
  type Language,
} from '../../shared/schema/ai.js';
import { AirData, GeocodeResponse, roundCoord, type Place } from '../../shared/schema/air.js';

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
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<Place[]> {
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
    return composeBrief(context);
  }
}

/** Ask Smogwise; never rejects (falls back to safety or intent answers in the browser). */
export async function askSmogwise(
  question: string,
  context: AiContext,
  language: Language,
): Promise<AskResponse> {
  try {
    return await request('/api/ask', AskReply, postJson({ question, context, language }));
  } catch {
    return rulesAnswer(question, context, language);
  }
}
