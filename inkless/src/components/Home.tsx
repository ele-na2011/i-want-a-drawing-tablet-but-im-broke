import logo from "../assets/logo.png";
import plus from "../assets/plus-large.svg";
import documentIcon from "../assets/document.png";
import list from "../assets/list.png";
import folderIcon from "../assets/folder.png";
import spinner from "../assets/spinner.png";
import settings from "../assets/settings.png";
import avatar from "../assets/avatar.png";
import more from "../assets/more.png";
import { childFolders, docsIn, type Place, type Store } from "../lib/projects";

interface Props {
  store: Store;
  place: Place;
  onPlace: (p: Place) => void;
  onNewDoc: () => void;
  onNewProject: () => void;
  onNewFolder: () => void;
  onOpenDoc: (id: string) => void;
  onDocMenu: (id: string) => void;
}

export default function Home({ store, place, onPlace, onNewDoc, onNewProject, onNewFolder, onOpenDoc, onDocMenu }: Props) {
  const docs = docsIn(store, place);
  const heading =
    store.folders.find((f) => f.id === place.folderId)?.name ??
    store.projects.find((p) => p.id === place.projectId)?.name ??
    "Recent";
  const selected = (p: Place) => p.projectId === place.projectId && p.folderId === place.folderId;

  // Folders nest, so the tree draws itself one level at a time.
  const tree = (projectId: string, parentId: string | null, depth: number) =>
    childFolders(store, projectId, parentId).map((f) => (
      <li key={f.id}>
        <button
          style={{ paddingLeft: 32 + depth * 24 }}
          aria-pressed={selected({ projectId, folderId: f.id })}
          onClick={() => onPlace({ projectId, folderId: f.id })}
        >
          <img src={depth === 0 ? list : folderIcon} alt="" />{f.name}
        </button>
        <ul>{tree(projectId, f.id, depth + 1)}</ul>
      </li>
    ));

  return (
    <div className="home">
      <nav className="sidebar">
        <div className="logo logo-small"><img src={logo} alt="inkless" /></div>
        <ul className="sidebar-nav">
          <li><button onClick={onNewDoc}><img src={documentIcon} alt="" />New document</button></li>
          <li><button onClick={onNewProject}><img src={list} alt="" />New project</button></li>
          <li>
            <button onClick={onNewFolder} disabled={!place.projectId} title={place.projectId ? undefined : "Pick a project first"}>
              <img src={folderIcon} alt="" />New folder
            </button>
          </li>
          {/* TODO (Person 3): calibration flow */}
          <li><button><img src={spinner} alt="" />Calibrate</button></li>
        </ul>

        <div className="workspaces">
          <button
            className="workspace" aria-pressed={selected({ projectId: null, folderId: null })}
            onClick={() => onPlace({ projectId: null, folderId: null })}
          >
            All documents
          </button>
          {store.projects.map((p) => (
            <div key={p.id}>
              <button
                className="workspace" aria-pressed={selected({ projectId: p.id, folderId: null })}
                onClick={() => onPlace({ projectId: p.id, folderId: null })}
              >
                {p.name}
              </button>
              <ul className="folder-tree">{tree(p.id, null, 0)}</ul>
            </div>
          ))}
        </div>

        <button className="settings">
          <img src={settings} alt="" />
          Settings
        </button>
      </nav>

      <main className="home-main">
        <img className="avatar" src={avatar} alt="Your profile" width={36} height={36} />
        <h1 className="greeting">Hey, Elena!</h1>
        <button className="new-project" onClick={onNewProject}>
          Start a new project
          <img src={plus} alt="" />
        </button>

        <section className="recent">
          <div className="recent-head">
            <h2>{heading}</h2>
            <button className="recent-new" onClick={onNewDoc}>+ New document</button>
          </div>
          {docs.length === 0 ? (
            <p className="recent-empty">No documents here yet.</p>
          ) : (
            <ul className="recent-row">
              {docs.map((d) => (
                <li key={d.id} className="recent-card">
                  <button className="recent-open" onClick={() => onOpenDoc(d.id)}>
                    {d.thumbnail ? <img src={d.thumbnail} alt="" /> : <span className="recent-blank" />}
                    <span className="recent-name">{d.name}</span>
                  </button>
                  <button className="recent-more" aria-label={`Options for ${d.name}`} onClick={() => onDocMenu(d.id)}>
                    <img src={more} alt="" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
