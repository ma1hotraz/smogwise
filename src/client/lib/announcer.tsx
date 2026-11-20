/** One polite live region for status messages (WCAG 4.1.3), shared through context. */
import type { ComponentChildren } from 'preact';
import { createContext } from 'preact';
import { useCallback, useContext, useState } from 'preact/hooks';

type Announce = (message: string) => void;

const AnnouncerContext = createContext<Announce>(() => undefined);

export function AnnouncerProvider({ children }: { children: ComponentChildren }) {
  const [message, setMessage] = useState('');
  const announce = useCallback((next: string) => {
    // Clearing first makes screen readers repeat an identical message.
    setMessage('');
    setTimeout(() => {
      setMessage(next);
    }, 50);
  }, []);
  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div
        class="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="announcer"
      >
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

/** Returns the function that speaks a status message to assistive technology. */
export function useAnnounce(): Announce {
  return useContext(AnnouncerContext);
}
