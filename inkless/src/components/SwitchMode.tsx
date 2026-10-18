import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { IoMoon, IoSunny } from "react-icons/io5";

export default function SwitchMode() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="theme-switch"
      aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
      onClick={() => setTheme(dark ? "light" : "dark")}
      style={{
        background: dark ? "#000000" : "#ffffff",
        borderColor: dark ? "#555555" : "#d8d6e0",
      }}
    >
      <motion.span
        className="theme-switch-knob"
        animate={{ x: dark ? 40 : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        style={{
          background: dark ? "#333333" : "#efedf4",
        }}
      />

      <IoSunny
        className="theme-switch-icon"
        color={dark ? "#999999" : "#686771"}
      />

      <IoMoon
        className="theme-switch-icon"
        color={dark ? "#ffffff" : "#ababb4"}
      />
    </button>
  );
}