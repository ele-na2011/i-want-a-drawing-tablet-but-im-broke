import { useCallback, useEffect, useRef, useState } from "react";
import { ERASER, type DrawingState, type Point } from "./types";
import {
  allStrokes, beginStroke, emptyDrawing,
  extendStroke, finishStroke, redo, undo,
} from "./lib/strokes";
import {
  addDoc, addFolder, addProject, allPlaces, loadStore, PAGE, removeDoc, saveStore, updateDoc,
  type Place, type Store,
} from "./lib/projects";
import { downloadPdf, readImage, thumbnail } from "./lib/canvasImage";
import { useAuth } from "./lib/AuthContext";
import { supabase } from "./lib/supabase";
import { saveToDrive } from "./lib/drive";
import DrawingCanvas from "./components/DrawingCanvas";
import PageView from "./components/PageView";
import Toolbar, { COLORS, type Tool } from "./components/Toolbar";
import SignIn from "./components/SignIn";
import Home from "./components/Home";
import AskDialog, { type Ask } from "./components/AskDialog";
import SettingsDialog from "./components/SettingsDialog";
import "./styles.css";

const placeKey = (p: Place) => `${p.projectId ?? ""}|${p.folderId ?? ""}`;
const keyPlace = (k: string): Place => {
  const [projectId, folderId] = k.split("|");
  return { projectId: projectId || null, folderId: folderId || null };
};

export default function App() {
  const { session, loading, googleToken } = useAuth();
  const [view, setView] = useState<"home" | "editor">("home");
  const [store, setStore] = useState<Store>(() => loadStore());
  const storeRef = useRef(store); // latest store for code that runs after an await
  storeRef.current = store;
  const [place, setPlace] = useState<Place>({ projectId: null, folderId: null });
  const [docId, setDocId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<DrawingState>(emptyDrawing);
  const [background, setBackground] = useState<string | null>(null);
  const [saved, setSaved] = useState({ strokes: emptyDrawing.strokes, background: null as string | null });
  const [justSaved, setJustSaved] = useState(false);
  const [thickness, setThickness] = useState(4);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [penOn, setPenOn] = useState(true);
  const [ask, setAsk] = useState<Ask | null>(null); // the one open dialog, if any
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(true);
  const importInput = useRef<HTMLInputElement>(null);

  const doc = store.docs.find((d) => d.id === docId);
  const dirty = drawing.strokes !== saved.strokes || background !== saved.background;

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ============ THE ONE FUNCTION EVERYONE FEEDS ============
  // Mouse input calls this now. Later the hand tracker calls it:
  //   onSample({x, y, t}, spaceHeld)
  // If tracking is lost, call it with penDown=false so the stroke ends cleanly.
  const onSample = useCallback(
    (p: Point, penDown: boolean) => {
      setDrawing((d) => {
        if (!penDown || !penOn) return finishStroke(d);
        if (d.active) return extendStroke(d, p);
        return tool === "eraser"
          ? beginStroke(d, p, thickness * 4, ERASER) // an eraser as thin as the pen is unusable
          : beginStroke(d, p, thickness, color);
      });
    },
    [thickness, tool, color, penOn]
  );

  const tell = (title: string, message: string) => setAsk({ title, message, confirm: "OK", cancel: null, onOk: () => {} });

  const persist = (next: Store) => {
    setStore(next);
    storeRef.current = next;
    if (!saveStore(next)) tell("Couldn't save", "This browser's storage is full or blocked. Export a PDF to keep your work.");
  };

  // The document as it stands now, for saving, previews and PDF.
  const page = () => ({ strokes: drawing.strokes, background, size: { ...PAGE } });

  const handleSave = async () => {
    if (!docId) return;
    const p = page();
    const thumb = await thumbnail(p);
    persist(updateDoc(storeRef.current, docId, { ...p, thumbnail: thumb }));
    setSaved({ strokes: p.strokes, background: p.background });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleExport = async () => {
    try {
      await downloadPdf(page(), doc?.name ?? "drawing");
    } catch {
      tell("Couldn't export", "The page couldn't be turned into a PDF. Try again, or save and reload.");
    }
  };

  // Uploads the current canvas as a PNG into the user's Google Drive.
  const handleDrive = async () => {
    const canvas = document.querySelector<HTMLCanvasElement>(".canvas-panel canvas");
    if (!canvas) {
      tell("Nothing to save", "Open a document first.");
      return;
    }
    if (!googleToken) {
      tell("Reconnect Google", "Your Google connection has expired. Log out and sign in with Google again.");
      return;
    }
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no image"))), "image/png")
      );
      const name = `${doc?.name ?? "Inkless drawing"}.png`;
      await saveToDrive(googleToken, name, blob);
      tell("Saved to Google Drive", `"${name}" is now in your Google Drive.`);
    } catch (e) {
      if (e instanceof Error && e.message === "reauth") {
        tell("Reconnect Google", "Your Google connection has expired. Log out and sign in with Google again.");
      } else {
        console.error(e);
        tell("Couldn't save to Drive", "Something went wrong. Check the browser console for details.");
      }
    }
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      setBackground(await readImage(file));
    } catch (e) {
      tell("Couldn't import", (e as Error).message);
    }
  };

  const openDoc = (id: string) => {
    const d = store.docs.find((x) => x.id === id);
    if (!d) return;
    setDocId(id);
    setDrawing({ ...emptyDrawing, strokes: d.strokes });
    setBackground(d.background);
    setSaved({ strokes: d.strokes, background: d.background });
    setView("editor");
  };

  const newDoc = () => setAsk({
    title: "Name your document", input: "Untitled", confirm: "Create",
    onOk: (name) => {
      const [next, d] = addDoc(storeRef.current, name, place);
      persist(next);
      setDocId(d.id);
      setDrawing(emptyDrawing);
      setBackground(null);
      setSaved({ strokes: emptyDrawing.strokes, background: null });
      setView("editor");
    },
  });

  const newProject = () => setAsk({
    title: "Name your project", message: "A project is a workspace for folders and documents.",
    input: "New project", confirm: "Create",
    onOk: (name) => {
      const [next, p] = addProject(storeRef.current, name);
      persist(next);
      setPlace({ projectId: p.id, folderId: null });
    },
  });

  const newFolder = () => {
    const projectId = place.projectId;
    if (!projectId) return;
    setAsk({
      title: "Name your folder", input: "New folder", confirm: "Create",
      onOk: (name) => {
        const [next, f] = addFolder(storeRef.current, name, projectId, place.folderId);
        persist(next);
        setPlace({ projectId, folderId: f.id });
      },
    });
  };

  const docMenu = (id: string) => {
    const d = store.docs.find((x) => x.id === id);
    if (!d) return;
    setAsk({
      title: d.name, message: "Move to", confirm: "Move",
      input: placeKey(d),
      options: allPlaces(store).map((o) => ({ value: placeKey(o.place), label: o.label })),
      onOk: (key) => persist(updateDoc(storeRef.current, id, keyPlace(key))),
      extra: {
        label: "Delete",
        onClick: () => setAsk({
          title: `Delete "${d.name}"?`, message: "This can't be undone.", confirm: "Delete",
          onOk: () => persist(removeDoc(storeRef.current, id)),
        }),
      },
    });
  };

  const goHome = async () => {
    if (dirty) await handleSave(); // leaving the board saves, so work is never dropped silently
    setView("home");
  };

  const dialog = ask && <AskDialog key={ask.title + ask.confirm} ask={ask} onClose={() => setAsk(null)} />;

  if (loading) return null;
  if (!session) return <SignIn />;
  if (view === "home") {
    return (
      <>
        <Home
          store={store} place={place} onPlace={setPlace}
          onNewDoc={newDoc} onNewProject={newProject} onNewFolder={newFolder}
          onOpenDoc={openDoc} onDocMenu={docMenu} onSettings={() => setSettingsOpen(true)}
        />
        {dialog}
        {settingsOpen && (
          <SettingsDialog
            onClose={() => setSettingsOpen(false)}
            onLogOut={async () => { setSettingsOpen(false); await supabase.auth.signOut(); setView("home"); }}
          />
        )}
      </>
    );
  }

  return (
    <div className="whiteboard">
      {/* ---------- MENU + TOOLS (Figma "MacBook Air - 3") ---------- */}
      <header className="whiteboard-bar">
        <nav className="menu" aria-label="File">
          <button className="menu-back" onClick={goHome} aria-label="Back to dashboard" title="Back to dashboard">‹</button>
          <button onClick={handleSave}>{justSaved ? "Saved" : "Save"}</button>
          <button onClick={handleExport}>Export</button>
          <button onClick={handleDrive}>Save to Drive</button>
          <button onClick={() => importInput.current?.click()}>Import</button>
          <input
            ref={importInput} type="file" accept="image/*" hidden
            onChange={(e) => { handleImport(e.target.files?.[0]); e.target.value = ""; }}
          />
          <span className="menu-spacer" />
          <button aria-pressed={penOn} onClick={() => setPenOn(true)}>Pen on</button>
          <button aria-pressed={!penOn} onClick={() => setPenOn(false)}>Pen off</button>
        </nav>
        <Toolbar
          tool={tool} onTool={setTool}
          color={color} onColor={setColor}
          thickness={thickness} onThickness={setThickness}
          onUndo={() => setDrawing(undo)} onRedo={() => setDrawing(redo)}
          canUndo={drawing.strokes.length > 0} canRedo={drawing.undone.length > 0}
        />
      </header>

      {/* ---------- PAGE: one sheet on a desk you can drag around ---------- */}
      <main className="canvas-panel">
        <PageView>
          <DrawingCanvas
            strokes={allStrokes(drawing)} onSample={onSample} background={background}
            cursorColor={tool === "eraser" ? "rgba(0, 0, 0, 0.56)" : color}
            cursorSize={Math.max(8, tool === "eraser" ? thickness * 4 : thickness)}
          />
        </PageView>
      </main>

      {/* ---------- CAMERA: floating preview + calibration ---------- */}
      {cameraOpen ? (
        <section className="camera-panel" aria-label="Camera view">
          <h2>Camera view</h2>
          <button className="camera-close" aria-label="Hide camera view" onClick={() => setCameraOpen(false)}>x</button>
          {/* TODO (Person 1): <CameraView /> goes here */}
          {/* TODO (Person 3): <CalibrationOverlay /> goes on top of it */}
        </section>
      ) : (
        <button className="camera-tab" onClick={() => setCameraOpen(true)}>Camera view</button>
      )}
      {dialog}
    </div>
  );
}
