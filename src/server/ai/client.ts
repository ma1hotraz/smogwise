/** Language-model client port (AiClient) and its Gemini implementation. */
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';

interface AiUsage {
  promptTokens?: number | undefined;
  outputTokens?: number | undefined;
}

export interface GenerateArgs {
  system: string;
  prompt: string;
  /** JSON schema for structured output. */
  schema: object;
  maxOutputTokens: number;
  signal: AbortSignal;
}

/** The only door to a language model. Tests inject a fake; production uses Gemini. */
export interface AiClient {
  /** Returns raw parsed JSON; callers must validate it with zod. */
  generateJson(args: GenerateArgs): Promise<unknown>;
}

const DEFAULT_MAX_RETRIES = 1;
const RETRY_DELAY_MS = 600;
const RETRYABLE = (status: number): boolean => status === 429 || status >= 500;

/** True when the model refused the request because of the thinking setting. */
const rejectsThinking = (error: unknown): boolean =>
  error instanceof ApiError && error.status === 400 && /thinking/i.test(error.message);

const statusOf = (error: unknown): number | undefined =>
  error instanceof ApiError ? error.status : undefined;

const wait = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new Error(String(signal.reason ?? 'Aborted')),
        );
      },
      { once: true },
    );
  });

interface GeminiOptions {
  apiKey: string;
  model: string;
  maxRetries?: number | undefined;
  onUsage?: ((usage: AiUsage) => void) | undefined;
}

export class GeminiClient implements AiClient {
  private readonly ai: GoogleGenAI;
  private readonly maxRetries: number;

  constructor(private readonly options: GeminiOptions) {
    this.ai = new GoogleGenAI({ apiKey: options.apiKey });
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async generateJson(args: GenerateArgs): Promise<unknown> {
    try {
      return await this.callWithRetry(args, true);
    } catch (error) {
      // A model may reject the thinking parameter; drop it rather than downgrade the model.
      // Any other 400 (a bad request) is not retried, so it never costs a second call.
      if (rejectsThinking(error)) {
        return this.call(args, false);
      }
      throw error;
    }
  }

  private async callWithRetry(args: GenerateArgs, withThinking: boolean): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.call(args, withThinking);
      } catch (error) {
        const status = statusOf(error);
        if (
          attempt >= this.maxRetries ||
          status === undefined ||
          !RETRYABLE(status) ||
          args.signal.aborted
        ) {
          throw error;
        }
        await wait(RETRY_DELAY_MS + Math.random() * 200, args.signal);
      }
    }
  }

  private async call(args: GenerateArgs, withThinking: boolean): Promise<unknown> {
    const response = await this.ai.models.generateContent({
      model: this.options.model,
      contents: [{ role: 'user', parts: [{ text: args.prompt }] }],
      config: {
        systemInstruction: args.system,
        responseMimeType: 'application/json',
        responseJsonSchema: args.schema,
        maxOutputTokens: args.maxOutputTokens,
        abortSignal: args.signal,
        ...(withThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } } : {}),
      },
    });
    this.options.onUsage?.({
      promptTokens: response.usageMetadata?.promptTokenCount,
      outputTokens: response.usageMetadata?.candidatesTokenCount,
    });
    return JSON.parse(response.text ?? '') as unknown;
  }
}
