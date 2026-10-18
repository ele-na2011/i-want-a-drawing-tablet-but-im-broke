
import { useEffect, useRef } from "react";
import fallbackAvatar from "../assets/avatar.png";


// fallback only: other files may still import USER, so it stays exported
export const USER: AccountInfo = { first: "Guest", name: "Guest", email: "" };

export type AccountInfo = { first: string; name: string; email: string; avatar?: string };

// Figma "MacBook Air - 4": opened from the sidebar's Settings button or the avatar.
export default function SettingsDialog({
  onClose,
  onLogOut,
  user,
}: {
  onClose: () => void;
  onLogOut: () => void;
  user?: AccountInfo;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);

  const account: AccountInfo = user ?? USER;

  return (
    <dialog
      ref={ref} className="settings-dialog" aria-labelledby="settings-title" onClose={onClose}
      // click outside the card closes; tell the parent directly rather than waiting for the async close event
      onClick={(e) => { if (e.target === e.currentTarget) { ref.current?.close(); onClose(); } }}
    >
      <h2 id="settings-title">Settings</h2>
      <div className="settings-account">
        <img src={account.avatar || fallbackAvatar} alt="" referrerPolicy="no-referrer" />
        <div>
          <p className="settings-name">{account.name}</p>
          <p className="settings-email">{account.email}</p>
        </div>
      </div>
      <button className="settings-logout" onClick={onLogOut}>Log out</button>
      <button className="settings-switch" onClick={onLogOut}>Switch account</button>
    </dialog>
  );
}