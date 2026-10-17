import logo from "../assets/logo.png";
import plus from "../assets/plus-large.svg";
import list from "../assets/list.png";
import folder from "../assets/folder.png";
import settings from "../assets/settings.png";
import avatar from "../assets/avatar.png";
import more from "../assets/more.png";

type Props = { onOpenEditor: () => void };

// shortcut: hardcoded sample data until projects/folders are saved somewhere
const folders = [
  { name: "Outreach", icon: list, depth: 0 },
  { name: "brainstorming", icon: folder, depth: 1 },
  { name: "personal", icon: list, depth: 0 },
];
const recent = ["Physics notes", "To-do list", "Robotics", "Untitled"];

export default function Home({ onOpenEditor }: Props) {
  return (
    <div className="home">
      <nav className="sidebar">
        <div className="logo logo-small"><img src={logo} alt="inkless" /></div>
        <ul className="sidebar-nav">
          <li><button onClick={onOpenEditor}>New document</button></li>
          <li><button onClick={onOpenEditor}>New project</button></li>
          {/* TODO: folder creation + calibration flow */}
          <li><button>New folder</button></li>
          <li><button>Calibrate</button></li>
        </ul>

        <p className="sidebar-group">Robotics</p>
        <ul className="folder-tree">
          {folders.map((f) => (
            <li key={f.name} style={{ paddingLeft: 32 + f.depth * 32 }}>
              <img src={f.icon} alt="" width={19} height={19} />
              {f.name}
            </li>
          ))}
        </ul>

        <button className="settings">
          <img src={settings} alt="" width={35} height={35} />
          Settings
        </button>
      </nav>

      <main className="home-main">
        <img className="avatar" src={avatar} alt="Your profile" width={36} height={36} />
        <h1 className="greeting">Hey, Elena!</h1>
        <button className="new-project" onClick={onOpenEditor}>
          Start a new project
          <img src={plus} alt="" width={30} height={30} />
        </button>

        <section className="recent">
          <h2>Recent</h2>
          <ul className="recent-row">
            {recent.map((title) => (
              <li key={title} className="recent-card">
                <button className="recent-open" onClick={onOpenEditor} aria-label={`Open ${title}`} />
                <button className="recent-more" aria-label={`More options for ${title}`}>
                  <img src={more} alt="" width={15} height={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
