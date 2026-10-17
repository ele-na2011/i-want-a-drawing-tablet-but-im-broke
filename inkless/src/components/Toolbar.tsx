import pen from "../assets/pen.png";
import eraser from "../assets/eraser.png";
import undoIcon from "../assets/undo.png";
import redoIcon from "../assets/redo.png";

export type Tool = "pen" | "eraser";
export const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#ff0000" },
  { name: "Blue", value: "#305cde" },
];

interface Props {
  tool: Tool;
  onTool: (t: Tool) => void;
  color: string;
  onColor: (c: string) => void;
  thickness: number;
  onThickness: (n: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

// UI OWNER: buttons are plain <button>s; icons come from src/assets (Figma "MacBook Air - 3").
export default function Toolbar(p: Props) {
  return (
    <div className="toolbar">
      <div className="tool-group">
        <button className="tool" aria-label="Undo" onClick={p.onUndo} disabled={!p.canUndo}><img src={undoIcon} alt="" /></button>
        <button className="tool" aria-label="Redo" onClick={p.onRedo} disabled={!p.canRedo}><img src={redoIcon} alt="" /></button>
      </div>
      <div className="tool-group">
        {/* picking the pen resets the ink to black */}
        <button className="tool" aria-label="Pen" aria-pressed={p.tool === "pen"} onClick={() => { p.onTool("pen"); p.onColor(COLORS[0].value); }}>
          <img src={pen} alt="" />
        </button>
        <div className="swatches" role="group" aria-label="Ink colour">
          {COLORS.map((c) => (
            <button
              key={c.value} className="swatch" style={{ background: c.value }}
              aria-label={c.name} aria-pressed={p.tool === "pen" && p.color === c.value}
              onClick={() => { p.onColor(c.value); p.onTool("pen"); }}
            />
          ))}
        </div>
      </div>
      <button className="tool" aria-label="Eraser" aria-pressed={p.tool === "eraser"} onClick={() => p.onTool("eraser")}>
        <img src={eraser} alt="" />
      </button>
      <label className="thickness">
        Thickness
        <input
          type="range" min={1} max={20} value={p.thickness}
          onChange={(e) => p.onThickness(Number(e.target.value))}
        />
      </label>
    </div>
  );
}
