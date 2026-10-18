import { useEffect, useRef, useState } from "react";
import avatar from "../assets/avatar.png";

// shortcut: one hardcoded account (from the Figma mock) until real sign-in exists
export const USER = { first: "Elena", name: "Elena Y", email: "elenay.hello@gmail.com" };

// Figma "MacBook Air - 4": opened from the sidebar's Settings button or the avatar.
export default function SettingsDialog({ onClose, onLogOut }: { onClose: () => void; onLogOut: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState<"account" | "guide">("account");
  useEffect(() => { ref.current?.showModal(); }, []);

  return (
    <dialog
      ref={ref} className="settings-dialog" aria-labelledby="settings-title" onClose={onClose}
      // click outside the card closes; tell the parent directly rather than waiting for the async close event
      onClick={(e) => { if (e.target === e.currentTarget) { ref.current?.close(); onClose(); } }}
    >
      <h2 id="settings-title">Settings</h2>
      <nav className="settings-nav" aria-label="Settings pages">
        <button type="button" aria-current={page === "account" ? "page" : undefined} onClick={() => setPage("account")}>Account</button>
        <button type="button" aria-current={page === "guide" ? "page" : undefined} onClick={() => setPage("guide")}>How to use Inkless</button>
      </nav>
      {page === "account" ? (
        <>
          <div className="settings-account">
            <img src={avatar} alt="" />
            <div>
              <p className="settings-name">{USER.name}</p>
              <p className="settings-email">{USER.email}</p>
            </div>
          </div>
          <button className="settings-logout" onClick={onLogOut}>Log out</button>
          <button className="settings-switch" onClick={onLogOut}>Switch account</button>
        </>
      ) : (
        <section className="settings-guide" aria-labelledby="guide-title">
          <h3 id="guide-title">Set up your drawing tablet</h3>
          <p>Use the camera to follow your hand and draw on the page without touching it.</p>
          <ol>
            <li><strong>Connect the hardware.</strong> Plug in the camera and the green LED, then open a drawing.</li>
            <li><strong>Choose a camera.</strong> In Camera view, select the camera that sees your workspace and choose <strong>Use selected</strong>.</li>
            <li><strong>Calibrate.</strong> Click <strong>Calibrate workspace</strong>, then tap the four corners in order: top-left, top-right, bottom-right, and bottom-left.</li>
            <li><strong>Start tracking.</strong> Choose <strong>Track index finger</strong>. Keep your hand and the green LED visible; drawing pauses when the hand is lost.</li>
            <li><strong>Draw and save.</strong> Use the toolbar to pick a pen, color, and thickness. Your work saves when you return home; use Export when you need a PDF.</li>
          </ol>
          <p>Camera previews are mirrored for a natural, selfie-like view. Calibration keeps the detected camera coordinates aligned behind the scenes, so the labels and controls remain readable.</p>
        </section>
      )}
    </dialog>
  );
}
