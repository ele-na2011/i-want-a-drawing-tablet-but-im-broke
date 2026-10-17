/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDoc, addFolder, addProject, allPlaces, docsIn, loadStore, saveStore, updateDoc, type Store } from "./projects.ts";

const memory = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};
const none = { projectId: null, folderId: null };

// Robotics (project) > Outreach (folder) > brainstorming (folder), plus a loose document.
function sample() {
  let store: Store = { projects: [], folders: [], docs: [] };
  const [s1, robotics] = addProject(store, "Robotics");
  const [s2, outreach] = addFolder(s1, "Outreach", robotics.id, null);
  const [s3, brainstorm] = addFolder(s2, "brainstorming", robotics.id, outreach.id);
  const [s4, poster] = addDoc(s3, "Poster", { projectId: robotics.id, folderId: brainstorm.id });
  const [s5, plan] = addDoc(s4, "Plan", { projectId: robotics.id, folderId: null });
  [store] = addDoc(s5, "Shopping list", none);
  return { store, robotics, outreach, brainstorm, poster, plan };
}

test("documents show up where they were put", () => {
  const { store, robotics, brainstorm, outreach } = sample();
  assert.deepEqual(docsIn(store, none).map((d) => d.name).sort(), ["Plan", "Poster", "Shopping list"]);
  assert.deepEqual(docsIn(store, { projectId: robotics.id, folderId: null }).map((d) => d.name).sort(), ["Plan", "Poster"]);
  assert.deepEqual(docsIn(store, { projectId: robotics.id, folderId: brainstorm.id }).map((d) => d.name), ["Poster"]);
  assert.deepEqual(docsIn(store, { projectId: robotics.id, folderId: outreach.id }), []);
});

test("move targets list nested folders under their project", () => {
  const { store } = sample();
  assert.deepEqual(allPlaces(store).map((p) => p.label), [
    "No project", "Robotics", "Robotics / Outreach", "Robotics / Outreach / brainstorming",
  ]);
});

test("moving a document out of a project makes it loose", () => {
  const { store, plan } = sample();
  const moved = updateDoc(store, plan.id, none);
  assert.equal(moved.docs.find((d) => d.id === plan.id)!.projectId, null);
});

test("the store survives a save and reload", () => {
  const storage = memory();
  const { store } = sample();
  assert.equal(saveStore(store, storage), true);
  assert.deepEqual(loadStore(storage), store);
});

test("old saves keep their drawings as loose documents", () => {
  const v1 = { projects: [{ id: "p1", name: "Old", strokes: [], updatedAt: 1 }], folders: [] };
  const s = loadStore(memory({ "inkless:v1": JSON.stringify(v1) }));
  assert.deepEqual(s.docs.map((d) => [d.name, d.projectId]), [["Old", null]]);
});

test("a full or broken storage is reported, not thrown", () => {
  const full = { setItem: () => { throw new Error("QuotaExceededError"); } };
  assert.equal(saveStore({ projects: [], folders: [], docs: [] }, full), false);
  assert.deepEqual(loadStore({ getItem: () => "{not json" }), { projects: [], folders: [], docs: [] });
});
