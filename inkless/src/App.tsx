import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ERASER, type DrawingState, type Point } from "./types";
import {
  allStrokes, beginStroke, emptyDrawing,
  extendStroke, finishStroke, redo, undo,
} from "./lib/strokes";
import {
  addDoc, addFolder, addProject, allPlaces, loadStore, PAGE,
  removeDoc, removeFolder, removeProject, saveStore, updateDoc,
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
import SettingsDialog, {
  USER,
  type AccountInfo,
} from "./components/SettingsDialog";
import CalibrationOverlay from "./components/CalibrationOverlay";
import { useCamera } from "./lib/src/lib/useCamera";
import type { Homography } from "./lib/homography";
import type { ZCalibration } from "./lib/ledDetect";
import { beautifyStrokes } from "./lib/beautify";
import { useDrawHold } from "./lib/useDrawHold";
import { useHandTracking } from "./lib/useHandTracking";
import { useLedTracking } from "./lib/useLedTracking";
import "./styles.css";

const placeKey = (p: Place) =>
  `${p.projectId ?? ""}|${p.folderId ?? ""}`;

const keyPlace = (k: string): Place => {
  const [projectId, folderId] = k.split("|");
  return {
    projectId: projectId || null,
    folderId: folderId || null,
  };
};

export default function App() {
  const { session, loading, googleToken, firstName } = useAuth();

  const [view, setView] = useState<"home" | "editor">("home");
  const [store, setStore] = useState<Store>(() => loadStore());
  const storeRef = useRef(store);
  storeRef.current = store;

  const [place, setPlace] = useState<Place>({
    projectId: null,
    folderId: null,
  });

  const [docId, setDocId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<DrawingState>(emptyDrawing);
  const [background, setBackground] = useState<string | null>(null);

  const [saved, setSaved] = useState({
    strokes: emptyDrawing.strokes,
    background: null as string | null,
  });

  const [justSaved, setJustSaved] = useState(false);
  const [thickness, setThickness] = useState(4);
  const [beautified, setBeautified] = useState(true);
  const [smoothing, setSmoothing] = useState(0.5);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [penOn, setPenOn] = useState(true);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(true);

  const camera = useCamera();
  const drawHold = useDrawHold();
  const [automaticSurface, setAutomaticSurface] = useState(false);

  const [homography, setHomography] = useState<Homography | null>(null);
  const [zCalibration, setZCalibration] = useState<ZCalibration | null>(null);
  const [tracking, setTracking] = useState(false);
  const [trackingMode, setTrackingMode] = useState<"pen" | "finger">("pen");
  const importInput = useRef<HTMLInputElement>(null);

  const doc = store.docs.find((d) => d.id === docId);
  const dirty =
    drawing.strokes !== saved.strokes ||
    background !== saved.background;

  const cleanStrokes = useMemo(
    () => beautified ? beautifyStrokes(drawing.strokes, smoothing) : drawing.strokes,
    [drawing.strokes, beautified, smoothing]
  );
  // Live stroke stays raw to avoid adding smoothing latency during tracking.
  const strokes = useMemo(() => allStrokes({ ...drawing, strokes: cleanStrokes }), [drawing, cleanStrokes]);

  useEffect(() => {
    if (!dirty) return;

    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const onSample = useCallback(
    (p: Point, penDown: boolean) => {
      setDrawing((d) => {
        if (!penDown || !penOn || view !== "editor" || calibrationOpen) return finishStroke(d);
        if (d.active) return extendStroke(d, p);

        return tool === "eraser"
          ? beginStroke(d, p, thickness * 4, ERASER)
          : beginStroke(d, p, thickness, color);
      });
    },
    [thickness, tool, color, penOn, view, calibrationOpen]
  );

  const hand = useHandTracking({
    videoRef: camera.videoRef,
    sideVideoRef: camera.secondaryVideoRef,
    zCalibration,
    drawHeld: drawHold.held,
    automatic: automaticSurface,
    homography,
    enabled:
      trackingMode === "finger" &&
      tracking &&
      camera.status === "ready",
    onSample,
  });

  const led = useLedTracking({
    videoRef: camera.videoRef,
    drawHeld: drawHold.held,
    automatic: automaticSurface,
    homography,
    sideVideoRef: camera.secondaryVideoRef,
    zCalibration,
    enabled:
      trackingMode === "pen" &&
      tracking &&
      camera.status === "ready",
    onSample,
  });

  const tracker = trackingMode === "pen" ? led : hand;

  const tell = (title: string, message: string) =>
    setAsk({
      title,
      message,
      confirm: "OK",
      cancel: null,
      onOk: () => {},
    });

  const persist = (next: Store) => {
    setStore(next);
    storeRef.current = next;

    if (!saveStore(next)) {
      tell(
        "Couldn't save",
        "This browser's storage is full or blocked. Export a PDF to keep your work."
      );
    }
  };

  const page = (enhanced = false) => ({
    strokes: enhanced ? cleanStrokes : drawing.strokes,
    background,
    size: { ...PAGE },
  });

  const handleSave = async () => {
    if (!docId) return;

    const p = page();
    const thumb = await thumbnail(p);

    persist(
      updateDoc(storeRef.current, docId, {
        ...p,
        thumbnail: thumb,
      })
    );

    setSaved({
      strokes: p.strokes,
      background: p.background,
    });

    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  const handleExport = async () => {
    try {
      await downloadPdf(page(true), doc?.name ?? "drawing");
    } catch {
      tell(
        "Couldn't export",
        "The page couldn't be turned into a PDF. Try again, or save and reload."
      );
    }
  };

  const handleDrive = async () => {
    const canvas =
      document.querySelector<HTMLCanvasElement>(".canvas-panel canvas");

    if (!canvas) {
      tell("Nothing to save", "Open a document first.");
      return;
    }

    if (!googleToken) {
      tell(
        "Reconnect Google",
        "Your Google connection has expired. Log out and sign in with Google again."
      );
      return;
    }

    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("no image"))),
          "image/png"
        )
      );

      const name = `${doc?.name ?? "Inkless drawing"}.png`;

      await saveToDrive(googleToken, name, blob);

      tell(
        "Saved to Google Drive",
        `"${name}" is now in your Google Drive.`
      );
    } catch (e) {
      if (e instanceof Error && e.message === "reauth") {
        tell(
          "Reconnect Google",
          "Your Google connection has expired. Log out and sign in with Google again."
        );
      } else {
        console.error(e);
        tell(
          "Couldn't save to Drive",
          "Something went wrong. Check the browser console for details."
        );
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

    setSaved({
      strokes: d.strokes,
      background: d.background,
    });

    setView("editor");
  };

  const newDoc = () =>
    setAsk({
      title: "Name your document",
      input: "Untitled",
      confirm: "Create",
      onOk: (name) => {
        const [next, d] = addDoc(storeRef.current, name, place);

        persist(next);
        setDocId(d.id);
        setDrawing(emptyDrawing);
        setBackground(null);

        setSaved({
          strokes: emptyDrawing.strokes,
          background: null,
        });

        setView("editor");
      },
    });

  const newProject = () =>
    setAsk({
      title: "Name your project",
      message: "A project is a workspace for folders and documents.",
      input: "New project",
      confirm: "Create",
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
      title: "Name your folder",
      input: "New folder",
      confirm: "Create",
      onOk: (name) => {
        const [next, f] = addFolder(
          storeRef.current,
          name,
          projectId,
          place.folderId
        );

        persist(next);
        setPlace({ projectId, folderId: f.id });
      },
    });
  };

  const docMenu = (id: string) => {
    const d = store.docs.find((x) => x.id === id);
    if (!d) return;

    setAsk({
      title: d.name,
      message: "Move to",
      confirm: "Move",
      input: placeKey(d),
      options: allPlaces(store).map((o) => ({
        value: placeKey(o.place),
        label: o.label,
      })),
      onOk: (key) =>
        persist(updateDoc(storeRef.current, id, keyPlace(key))),
      extra: {
        label: "Delete",
        onClick: () =>
          setAsk({
            title: `Delete "${d.name}"?`,
            message: "This can't be undone.",
            confirm: "Delete",
            onOk: () => persist(removeDoc(storeRef.current, id)),
          }),
      },
    });
  };

  const deletePlace = (p: Place) => {
    const name = p.folderId
      ? store.folders.find((f) => f.id === p.folderId)?.name
      : store.projects.find((x) => x.id === p.projectId)?.name;

    const cut = (s: Store) =>
      p.folderId
        ? removeFolder(s, p.folderId)
        : removeProject(s, p.projectId!);

    const lost = store.docs.length - cut(store).docs.length;

    setAsk({
      title: `Delete "${name}"?`,
      message: `${
        lost
          ? `This also deletes the ${lost} document${lost === 1 ? "" : "s"} inside. `
          : ""
      }This can't be undone.`,
      confirm: "Delete",
      onOk: () => {
        const next = cut(storeRef.current);
        persist(next);

        setPlace((cur) =>
          allPlaces(next).some(
            (o) => placeKey(o.place) === placeKey(cur)
          )
            ? cur
            : { projectId: null, folderId: null }
        );
      },
    });
  };

  const goHome = async () => {
    if (dirty) await handleSave();
    setView("home");
  };

  const meta: Record<string, unknown> =
    session?.user.user_metadata ?? {};

  const email = session?.user.email ?? "";

  const fullName =
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    email;

  const account: AccountInfo = {
    first: fullName.split(" ")[0] || email,
    name: fullName,
    email,
    avatar:
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined),
  };

  if (session) Object.assign(USER, account);

  const dialog = ask && (
    <AskDialog
      key={ask.title + ask.confirm}
      ask={ask}
      onClose={() => setAsk(null)}
    />
  );

  if (loading) return null;
  if (!session) return <SignIn />;

  if (view === "home") {
    return (
      <>
        <Home
          store={store}
          place={place}
          onPlace={setPlace}
          onNewDoc={newDoc}
          onNewProject={newProject}
          onNewFolder={newFolder}
          onCalibrate={() => setCalibrationOpen(true)}
          onOpenDoc={openDoc}
          onDocMenu={docMenu}
          onDeletePlace={deletePlace}
          onSettings={() => setSettingsOpen(true)}
          firstName={firstName}
        />

        {calibrationOpen && (
          <section
            className="camera-panel hub-calibration-panel"
            aria-label="Workspace calibration"
          >
            <h2>Calibrate workspace</h2>

            <button
              className="camera-close"
              aria-label="Close calibration"
              onClick={() => setCalibrationOpen(false)}
            >
              x
            </button>

            <CalibrationOverlay
              key={trackingMode}
              videoRef={camera.videoRef}
              secondaryVideoRef={camera.secondaryVideoRef}
              activeCameraCount={camera.activeCameraCount}
              cameraStatus={camera.status}
              cameraError={camera.error}
              calibrated={homography !== null}
              onCalibrated={setHomography}
              cameras={camera.devices}
              selectedCamera={camera.selectedDeviceId}
              onSelectCamera={camera.setSelectedDeviceId}
              selectedSecondaryCamera={camera.selectedSecondaryId}
              onSelectSecondaryCamera={camera.setSelectedSecondaryId}
              onStartCamera={camera.start}
              tracking={tracking}
              trackerStatus={tracker.status}
              trackerError={tracker.error}
              onTracking={setTracking}
              trackingMode={trackingMode}
              onTrackingMode={(mode) => {
                if (mode === trackingMode) return;
                setAutomaticSurface(false);
                drawHold.release();
                setHomography(null);
                setZCalibration(null);
                setTrackingMode(mode);
              } }
              onVideoMount={camera.attach}
              ledPoint={tracker.point}
              sideLedPoint={tracker.sidePoint}
              penHeight={tracker.z}
              zCalibrated={zCalibration !== null}
              onZCalibrated={setZCalibration}
              onPage={led.pagePoint !== null} ledThreshold={0} onLedThreshold={function (_threshold: number): void {
                throw new Error("Function not implemented.");
              } } ledMode={"green"} onLedMode={function (_mode: "green" | "bright"): void {
                throw new Error("Function not implemented.");
              } } ledFps={0} automaticSurface={false} onAutomaticSurface={function (_value: boolean): void {
                throw new Error("Function not implemented.");
              } } onDrawPress={function (): void {
                throw new Error("Function not implemented.");
              } } onDrawRelease={function (): void {
                throw new Error("Function not implemented.");
              } }            />
          </section>
        )}

        {dialog}

        {settingsOpen && (
          <SettingsDialog
            user={account}
            onClose={() => setSettingsOpen(false)}
            onLogOut={async () => {
              setSettingsOpen(false);
              await supabase?.auth.signOut();
              setView("home");
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="whiteboard">
      <header className="whiteboard-bar">
        <nav className="menu" aria-label="File">
          <button
            className="menu-back"
            onClick={goHome}
            aria-label="Back to dashboard"
            title="Back to dashboard"
          >
            ‹
          </button>

          <button onClick={handleSave}>
            {justSaved ? "Saved" : "Save"}
          </button>

          <button onClick={handleExport}>Export</button>
          <button onClick={handleDrive}>Save to Drive</button>

          <button onClick={() => importInput.current?.click()}>
            Import
          </button>

          <input
            ref={importInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleImport(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <span className="menu-spacer" />

          <button
            aria-pressed={penOn}
            onClick={() => setPenOn(true)}
          >
            Pen on
          </button>

          <button
            aria-pressed={!penOn}
            onClick={() => setPenOn(false)}
          >
            Pen off
          </button>
        </nav>

        <Toolbar
          tool={tool}
          onTool={setTool}
          color={color}
          onColor={setColor}
          thickness={thickness}
          onThickness={setThickness}
          onUndo={() => setDrawing(undo)}
          onRedo={() => setDrawing(redo)}
          canUndo={drawing.strokes.length > 0}
          canRedo={drawing.undone.length > 0}
          beautified={beautified}
          onBeautified={setBeautified}
          smoothing={smoothing}
          onSmoothing={setSmoothing}
        />
      </header>

      <main className="canvas-panel">
        <PageView>
          <DrawingCanvas
            strokes={strokes}
            onSample={onSample}
            background={background}
            penPoint={trackingMode === "pen" ? led.pagePoint : null}
            cursorColor={
              tool === "eraser"
                ? "rgba(0, 0, 0, 0.56)"
                : color
            }
            cursorSize={Math.max(
              8,
              tool === "eraser" ? thickness * 4 : thickness
            )}
          />
        </PageView>
      </main>

      <section
        className="camera-panel"
        aria-label="Camera view"
        style={cameraOpen ? undefined : { display: "none" }}
      >
        <h2>Camera view</h2>

        <button
          className="camera-close"
          aria-label="Hide camera view"
          onClick={() => setCameraOpen(false)}
        >
          x
        </button>

        <CalibrationOverlay
          key={trackingMode}
          videoRef={camera.videoRef}
          secondaryVideoRef={camera.secondaryVideoRef}
          activeCameraCount={camera.activeCameraCount}
          cameraStatus={camera.status}
          cameraError={camera.error}
          calibrated={homography !== null}
          onCalibrated={setHomography}
          cameras={camera.devices}
          selectedCamera={camera.selectedDeviceId}
          onSelectCamera={camera.setSelectedDeviceId}
          selectedSecondaryCamera={camera.selectedSecondaryId}
          onSelectSecondaryCamera={camera.setSelectedSecondaryId}
          onStartCamera={camera.start}
          tracking={tracking}
          trackerStatus={tracker.status}
          trackerError={tracker.error}
          onTracking={setTracking}
          trackingMode={trackingMode}
          onTrackingMode={(mode) => {
            if (mode === trackingMode) return;
            setAutomaticSurface(false);
            drawHold.release();
            setHomography(null);
            setZCalibration(null);
            setTrackingMode(mode);
          } }
          onVideoMount={camera.attach}
          ledPoint={tracker.point}
          sideLedPoint={tracker.sidePoint}
          penHeight={tracker.z}
          zCalibrated={zCalibration !== null}
          onZCalibrated={setZCalibration}
          onPage={led.pagePoint !== null} ledThreshold={0} onLedThreshold={function (): void {
            throw new Error("Function not implemented.");
          } } ledMode={"green"} onLedMode={function (): void {
            throw new Error("Function not implemented.");
          } } ledFps={0} automaticSurface={false} onAutomaticSurface={function (): void {
            throw new Error("Function not implemented.");
          } } onDrawPress={function (): void {
            throw new Error("Function not implemented.");
          } } onDrawRelease={function (): void {
            throw new Error("Function not implemented.");
          } }        />
      </section>

      {!cameraOpen && (
        <button
          className="camera-tab"
          onClick={() => setCameraOpen(true)}
        >
          Camera view
        </button>
      )}

      {dialog}
    </div>
  );
}