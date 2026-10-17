import type { Stroke } from "../types";

// A project is a workspace. Folders live inside a project (and can nest).
// A document sits in a folder, at a project's top level, or on its own.
export interface Project { id: string; name: string }
export interface Folder { id: string; name: string; projectId: string; parentId: string | null }
export interface Doc {
  id: string;
  name: string;
  projectId: string | null;
  folderId: string | null;
  strokes: Stroke[];
  background: string | null;      // imported image (data URL), drawn under the strokes
  size: { w: number; h: number }; // board size in css px when last saved, so previews/PDF keep proportions
  thumbnail: string | null;
  updatedAt: number;
}
export interface Store { projects: Project[]; folders: Folder[]; docs: Doc[] }

// What the sidebar has selected: nothing (all documents), a project, or a folder in a project.
export interface Place { projectId: string | null; folderId: string | null }

// shortcut: everything lives in this browser's localStorage (~5 MB, not synced); move to a backend when accounts exist
const KEY = "inkless:v2";
const OLD_KEY = "inkless:v1";
const empty = (): Store => ({ projects: [], folders: [], docs: [] });
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function loadStore(storage: Pick<Storage, "getItem"> = localStorage): Store {
  try {
    const s = JSON.parse(storage.getItem(KEY) ?? "null");
    if (s && Array.isArray(s.projects) && Array.isArray(s.folders) && Array.isArray(s.docs)) return s;
    // v1 called documents "projects" and had no workspaces: keep the drawings as loose documents.
    const old = JSON.parse(storage.getItem(OLD_KEY) ?? "null");
    if (old && Array.isArray(old.projects)) {
      return {
        ...empty(),
        docs: old.projects.map((p: { id: string; name: string; strokes: Stroke[]; updatedAt: number }) => ({
          id: p.id, name: p.name, projectId: null, folderId: null, strokes: p.strokes ?? [],
          background: null, size: { w: 1280, h: 720 }, thumbnail: null, updatedAt: p.updatedAt ?? Date.now(),
        })),
      };
    }
  } catch { /* corrupt or blocked storage: start empty rather than crash */ }
  return empty();
}

// Returns false when the browser refuses the write (storage full or blocked), so the caller can tell the user.
export function saveStore(store: Store, storage: Pick<Storage, "setItem"> = localStorage): boolean {
  try {
    storage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function addProject(store: Store, name: string): [Store, Project] {
  const p: Project = { id: newId("p"), name };
  return [{ ...store, projects: [...store.projects, p] }, p];
}

export function addFolder(store: Store, name: string, projectId: string, parentId: string | null): [Store, Folder] {
  const f: Folder = { id: newId("f"), name, projectId, parentId };
  return [{ ...store, folders: [...store.folders, f] }, f];
}

export function addDoc(store: Store, name: string, place: Place): [Store, Doc] {
  const d: Doc = {
    id: newId("d"), name, projectId: place.projectId, folderId: place.folderId,
    strokes: [], background: null, size: { w: 1280, h: 720 }, thumbnail: null, updatedAt: Date.now(),
  };
  return [{ ...store, docs: [d, ...store.docs] }, d];
}

export function updateDoc(store: Store, id: string, changes: Partial<Omit<Doc, "id">>): Store {
  return { ...store, docs: store.docs.map((d) => (d.id === id ? { ...d, ...changes, updatedAt: Date.now() } : d)) };
}

export function removeDoc(store: Store, id: string): Store {
  return { ...store, docs: store.docs.filter((d) => d.id !== id) };
}

// Documents shown for a sidebar selection, newest first.
// Nothing selected: every document. A project: everything in it. A folder: just that folder.
export function docsIn(store: Store, place: Place): Doc[] {
  return store.docs
    .filter((d) =>
      place.folderId ? d.folderId === place.folderId
      : place.projectId ? d.projectId === place.projectId
      : true)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

// Folders under a parent (null = a project's top level), in creation order.
export const childFolders = (store: Store, projectId: string, parentId: string | null) =>
  store.folders.filter((f) => f.projectId === projectId && f.parentId === parentId);

// Every place a document can go, labelled like "Robotics / Outreach / brainstorming".
export function allPlaces(store: Store): { place: Place; label: string }[] {
  const out: { place: Place; label: string }[] = [{ place: { projectId: null, folderId: null }, label: "No project" }];
  const walk = (projectId: string, parentId: string | null, prefix: string) => {
    for (const f of childFolders(store, projectId, parentId)) {
      out.push({ place: { projectId, folderId: f.id }, label: `${prefix} / ${f.name}` });
      walk(projectId, f.id, `${prefix} / ${f.name}`);
    }
  };
  for (const p of store.projects) {
    out.push({ place: { projectId: p.id, folderId: null }, label: p.name });
    walk(p.id, null, p.name);
  }
  return out;
}
