import { useEffect, useRef, useState } from "react";

// In-app replacement for prompt()/confirm()/alert(), which embedded browsers often block.
export interface Ask {
  title: string;
  message?: string;
  input?: string;        // set to show a text field (or the picker below) with this starting value
  options?: { value: string; label: string }[]; // show a picker instead of a text field
  extra?: { label: string; onClick: () => void }; // e.g. a Delete button on the left
  confirm: string;       // label of the main button
  cancel?: string | null; // null hides the cancel button (alert-style)
  onOk: (value: string) => void;
}

export default function AskDialog({ ask, onClose }: { ask: Ask; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(ask.input ?? "");

  useEffect(() => { ref.current?.showModal(); }, []);

  const needsValue = ask.input !== undefined;
  return (
    <dialog ref={ref} className="ask" onClose={onClose} aria-labelledby="ask-title">
      <form
        method="dialog"
        onSubmit={(e) => {
          if (needsValue && !value.trim()) { e.preventDefault(); return; }
          onClose(); // close first: onOk may switch views, which would remount (and reopen) this dialog
          ask.onOk(value.trim());
        }}
      >
        <h2 id="ask-title">{ask.title}</h2>
        {ask.message && <p>{ask.message}</p>}
        {needsValue && ask.options && (
          <select aria-label={ask.title} value={value} onChange={(e) => setValue(e.target.value)} autoFocus>
            {ask.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
        {needsValue && !ask.options && (
          <input aria-label={ask.title} value={value} onChange={(e) => setValue(e.target.value)} autoFocus onFocus={(e) => e.target.select()} />
        )}
        <div className="ask-buttons">
          {ask.extra && (
            <button type="button" className="ask-extra" onClick={() => { onClose(); ask.extra!.onClick(); }}>{ask.extra.label}</button>
          )}
          {ask.cancel !== null && (
            <button type="button" onClick={() => ref.current?.close()}>{ask.cancel ?? "Cancel"}</button>
          )}
          <button type="submit" className="ask-ok" disabled={needsValue && !value.trim()}>{ask.confirm}</button>
        </div>
      </form>
    </dialog>
  );
}
