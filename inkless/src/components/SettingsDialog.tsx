import { useEffect, useRef } from "react";
import avatar from "../assets/avatar.png";

// shortcut: one hardcoded account (from the Figma mock) until real sign-in exists
export const USER = { first: "Elena", name: "Elena Y", email: "elenay.hello@gmail.com" };

// Figma "MacBook Air - 4": opened from the sidebar's Settings button or the avatar.
export default function SettingsDialog({ onClose, onLogOut }: { onClose: () => void; onLogOut: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  return (
    <dialog
      ref={ref} className="settings-dialog" aria-labelledby="settings-title" onClose={onClose}
      // click outside the card closes; tell the parent directly rather than waiting for the async close event
      onClick={(e) => { if (e.target === e.currentTarget) { ref.current?.close(); onClose(); } }}
    >
      <h2 id="settings-title">Settings</h2>
      <div className="settings-account">
        <img src={avatar} alt="" />
        <div>
          <p className="settings-name">{USER.name}</p>
          <p className="settings-email">{USER.email}</p>
        </div>
      </div>
      <button className="settings-logout" onClick={onLogOut}>Log out</button>
      <button className="settings-switch" onClick={onLogOut}>Switch account</button>
    </dialog>
  );
}
