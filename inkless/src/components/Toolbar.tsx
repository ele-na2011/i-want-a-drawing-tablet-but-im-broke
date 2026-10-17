interface Props {
  thickness: number;
  onThickness: (n: number) => void;
  onUndo: () => void;
  onClear: () => void;
  onExport: () => void;
}

// UI OWNER: buttons are plain <button>s. Swap the text for your own icons/SVGs from src/assets.
export default function Toolbar({ thickness, onThickness, onUndo, onClear, onExport }: Props) {
  return (
    <div className="toolbar">
      <button onClick={onUndo}>Undo</button>
      <button onClick={onClear}>Clear</button>
      <label>
        Thickness
        <input
          type="range" min={1} max={20} value={thickness}
          onChange={(e) => onThickness(Number(e.target.value))}
        />
      </label>
      <button onClick={onExport}>Export PNG</button>
    </div>
  );
}