import { useCallback, useEffect, useRef } from 'react';

export function useDrawHold() {
  const held = useRef(false);
  const keyboard = useRef(false);
  const pointer = useRef(false);
  const update = useCallback(() => { held.current = keyboard.current || pointer.current; }, []);
  const press = useCallback(() => { pointer.current = true; update(); }, [update]);
  const release = useCallback(() => { pointer.current = false; update(); }, [update]);
  useEffect(() => {
    const editable = (target: EventTarget | null) => target instanceof HTMLElement &&
      (target.isContentEditable || !!target.closest('input, textarea, select, button'));
    const down = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || editable(e.target)) return;
      e.preventDefault(); keyboard.current = true; update();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') { keyboard.current = false; update(); }
    };
    const reset = () => { keyboard.current = pointer.current = held.current = false; };
    const visibility = () => { if (document.hidden) reset(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up);
      window.removeEventListener('blur', reset); document.removeEventListener('visibilitychange', visibility); reset();
    };
  }, [update]);
  return { held, press, release };
}
