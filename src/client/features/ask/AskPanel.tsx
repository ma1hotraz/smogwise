/** Ask Smogwise: questions about today's plan, answered by Gemini or by the rules (F6). */
import { useState } from 'preact/hooks';

import type { AiContext, AskResponse, Language } from '../../../shared/schema/ai.js';
import { SelectField } from '../../components/Fields.js';
import { useAnnounce } from '../../lib/announcer.js';
import { askSmogwise } from '../../lib/api.js';

const SOURCE_TEXT: Record<AskResponse['source'], string> = {
  gemini: 'Answered by Gemini using only your plan’s figures.',
  rules: 'Answered from your plan’s rules.',
  safety: 'Safety answer. This is not a diagnosis.',
};

const STARTERS = [
  'Can my mother go for her evening walk?',
  'When should I open the windows?',
  'Do I need a mask on my commute?',
];

export function AskPanel({ context }: { context: AiContext }) {
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [answer, setAnswer] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  const ask = async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed === '') {
      setError('Type a question first.');
      return;
    }
    setError(null);
    setQuestion(trimmed);
    setBusy(true);
    const reply = await askSmogwise(trimmed.slice(0, 400), context, language);
    setAnswer(reply);
    setBusy(false);
    announce('Answer ready.');
  };

  const suggestions = answer && answer.followUps.length > 0 ? answer.followUps : STARTERS;
  return (
    <>
      <h2>Ask Smogwise</h2>
      <p>Ask about today: timing, children, masks, purifiers, heating or your commute.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(question);
        }}
      >
        <div class="field">
          <label htmlFor="question">Your question</label>
          {error ? (
            <span class="error" id="question-error">
              {error}
            </span>
          ) : null}
          <textarea
            id="question"
            maxLength={400}
            value={question}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'question-error' : undefined}
            onInput={(event) => {
              setQuestion(event.currentTarget.value);
            }}
          />
        </div>
        <SelectField
          id="language"
          label="Answer in"
          value={language}
          options={[
            { value: 'en', label: 'English' },
            { value: 'hi', label: 'हिन्दी (Hindi)' },
          ]}
          onChange={setLanguage}
        />
        <button class="button" type="submit" disabled={busy}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {answer ? (
        <section class="answer" aria-labelledby="answer-title">
          <h3 id="answer-title">Answer</h3>
          <p lang={language}>{answer.answer}</p>
          <p class="hint">
            {SOURCE_TEXT[answer.source]}
            {answer.citedRuleIds.length > 0
              ? ` Based on rules ${answer.citedRuleIds.join(', ')}.`
              : ''}
          </p>
        </section>
      ) : null}
      <h3>Try asking</h3>
      <ul class="chips">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              class="button button-quiet button-small"
              type="button"
              lang={answer ? language : 'en'}
              onClick={() => {
                void ask(s);
              }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      <p class="hint">
        Not medical advice. For chest pain, breathlessness at rest or blue lips, call your local
        emergency number.
      </p>
    </>
  );
}
