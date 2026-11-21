/** Ask Smogwise: questions about today's plan, answered by Gemini or by the rules (F6). */
import { useState } from 'preact/hooks';

import { MAX_QUESTION_CHARS } from '../../../shared/limits.js';
import type { AiContext, AskResponse, Language } from '../../../shared/schema/ai.js';
import { SelectField } from '../../components/Fields.js';
import { type Answer, useAsk } from './useAsk.js';

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

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
] as const;

interface QuestionFieldProps {
  question: string;
  error: string | null;
  onInput: (text: string) => void;
}

function QuestionField({ question, error, onInput }: QuestionFieldProps) {
  return (
    <div class="field">
      <label htmlFor="question">Your question</label>
      {error ? (
        <span class="error" id="question-error">
          {error}
        </span>
      ) : null}
      <textarea
        id="question"
        maxLength={MAX_QUESTION_CHARS}
        value={question}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'question-error' : undefined}
        onInput={(event) => {
          onInput(event.currentTarget.value);
        }}
      />
    </div>
  );
}

/** The answer, tagged with the language it was asked in, its source and cited rules. */
function AnswerBlock({ answer }: { answer: Answer }) {
  const cited =
    answer.citedRuleIds.length > 0 ? ` Based on rules ${answer.citedRuleIds.join(', ')}.` : '';
  return (
    <section class="answer" aria-labelledby="answer-title">
      <h3 id="answer-title">Answer</h3>
      <p lang={answer.language}>{answer.answer}</p>
      <p class="hint">
        {SOURCE_TEXT[answer.source]}
        {cited}
      </p>
    </section>
  );
}

function Suggestions({
  items,
  lang,
  onPick,
}: {
  items: readonly string[];
  lang: Language;
  onPick: (q: string) => void;
}) {
  return (
    <>
      <h3>Try asking</h3>
      <ul class="chips">
        {items.map((s) => (
          <li key={s}>
            <button
              class="button button-quiet button-small"
              type="button"
              lang={lang}
              onClick={() => {
                onPick(s);
              }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AskPanel({ context }: { context: AiContext }) {
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const { answer, busy, error, ask: send } = useAsk(context);

  const ask = (text: string): void => {
    if (text.trim() !== '') {
      setQuestion(text.trim());
    }
    void send(text, language);
  };

  return (
    <>
      <h2>Ask Smogwise</h2>
      <p>Ask about today: timing, children, masks, purifiers, heating or your commute.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <QuestionField question={question} error={error} onInput={setQuestion} />
        <SelectField
          id="language"
          label="Answer in"
          value={language}
          options={LANGUAGE_OPTIONS}
          onChange={setLanguage}
        />
        <button class="button" type="submit" disabled={busy}>
          {busy ? 'Thinking…' : 'Ask'}
        </button>
      </form>
      {answer ? <AnswerBlock answer={answer} /> : null}
      <Suggestions
        items={answer && answer.followUps.length > 0 ? answer.followUps : STARTERS}
        lang={answer ? answer.language : 'en'}
        onPick={ask}
      />
      <p class="hint">
        Not medical advice. For chest pain, breathlessness at rest or blue lips, call your local
        emergency number.
      </p>
    </>
  );
}
