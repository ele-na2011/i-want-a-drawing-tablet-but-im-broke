import { useEffect, useRef, useState } from "react";
import avatar from "../assets/avatar.png";

export type AccountInfo = {
  first: string;
  name: string;
  email: string;
  avatar?: string;
};

export const USER: AccountInfo = {
  first: "Guest",
  name: "Guest",
  email: "",
};

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
  const [page, setPage] = useState<"account" | "guide">("account");

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const account: AccountInfo = user ?? USER;

  return (
    <dialog
      ref={ref}
      className="settings-dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          ref.current?.close();
          onClose();
        }
      }}
    >
      <h2 id="settings-title">Settings</h2>

      <nav className="settings-nav" aria-label="Settings pages">
        <button
          type="button"
          aria-current={page === "account" ? "page" : undefined}
          onClick={() => setPage("account")}
        >
          Account
        </button>

        <button
          type="button"
          aria-current={page === "guide" ? "page" : undefined}
          onClick={() => setPage("guide")}
        >
          How to use Inkless
        </button>
      </nav>

      {page === "account" ? (
        <>
          <div className="settings-account">
            <img
              src={account.avatar || avatar}
              alt=""
              referrerPolicy="no-referrer"
            />

            <div>
              <p className="settings-name">{account.name}</p>
              <p className="settings-email">{account.email}</p>
            </div>
          </div>

          <button className="settings-logout" onClick={onLogOut}>
            Log out
          </button>

          <button className="settings-switch" onClick={onLogOut}>
            Switch account
          </button>
        </>
      ) : (
        <section
          className="settings-guide"
          aria-labelledby="guide-title"
        >
          <h3 id="guide-title">Set up your drawing tablet</h3>

          <p>
            Inkless tracks a physical pen with a green LED using two
            cameras.
          </p>

          <ol>
            <li>
              <strong>Connect the hardware.</strong> Attach the green LED to the pen and connect two cameras.
              Both cameras should see the workspace at the same time.
            </li>

            <li>
              <strong>Choose and verify cameras.</strong> In Camera
              view, select a camera and choose{" "}
              <strong>Use selected</strong>. Check the{" "}
              <strong>Two-camera setup</strong> indicator; two cameras
              are needed for the pen workflow.
            </li>

            <li>
              <strong>Calibrate.</strong> Click{" "}
              <strong>Calibrate workspace</strong>, then tap the four
              corners in order: top-left, top-right, bottom-right, and
              bottom-left.
            </li>

            <li>
              <strong>Draw and save.</strong> Use the toolbar to pick a
              pen, color, and thickness. Your work saves when you return
              home; use Export when you need a PDF.
            </li>
          </ol>

          <p>
            Camera previews are mirrored for a natural, selfie-like
            view. Calibration keeps detected camera coordinates aligned
            behind the scenes, so the labels and controls remain
            readable.
          </p>
        </section>
      )}
    </dialog>
  );
}