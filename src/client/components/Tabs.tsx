/** WAI-ARIA tabs: roving tabindex, ←/→/Home/End, panels linked by aria-controls (docs/06 §2). */
import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';

export interface TabItem {
  id: string;
  label: string;
}

interface TabsProps {
  label: string;
  tabs: readonly TabItem[];
  active: string;
  onChange: (id: string) => void;
  children: ComponentChildren;
}

const KEY_STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };

export function Tabs({ label, tabs, active, onChange, children }: TabsProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = (index: number): void => {
    const next = tabs[(index + tabs.length) % tabs.length];
    if (next) {
      onChange(next.id);
      refs.current[(index + tabs.length) % tabs.length]?.focus();
    }
  };

  const onKeyDown = (event: KeyboardEvent, index: number): void => {
    const step = KEY_STEP[event.key];
    if (step !== undefined) {
      focusTab(index + step);
    } else if (event.key === 'Home') {
      focusTab(0);
    } else if (event.key === 'End') {
      focusTab(tabs.length - 1);
    } else {
      return;
    }
    event.preventDefault();
  };

  return (
    <>
      <div class="tablist no-print" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el;
            }}
            class="tab"
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={tab.id === active}
            aria-controls={`panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => {
              onChange(tab.id);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${active}`} aria-labelledby={`tab-${active}`} tabIndex={0}>
        {children}
      </div>
    </>
  );
}
