/**
 * Lazy-loaded panels: the chunk is fetched the first time the panel renders, so rarely used tabs
 * stay out of the initial bundle (docs/08). Declared at module level, so the component is stable.
 */
import { type ComponentType, type FunctionComponent, h } from 'preact';
import { useEffect, useState } from 'preact/hooks';

export function lazyComponent<P extends object>(
  load: () => Promise<ComponentType<P>>,
): FunctionComponent<P> {
  let loaded: ComponentType<P> | null = null;
  return function LazyPanel(props: P) {
    const [component, setComponent] = useState<ComponentType<P> | null>(() => loaded);
    useEffect(() => {
      if (component) {
        return undefined;
      }
      let live = true;
      void load().then((next) => {
        loaded = next;
        if (live) {
          setComponent(() => next);
        }
      });
      return () => {
        live = false;
      };
    }, [component]);
    return component ? h(component, props) : h('p', { role: 'status' }, 'Loading…');
  };
}
