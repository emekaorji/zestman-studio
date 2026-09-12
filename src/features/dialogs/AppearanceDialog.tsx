import { useEffect, useRef, useState } from "react";
import { AccentButton, CapsHeader, GhostButton, MiniSwitch, SegmentedControl } from "@/components/primitives";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useStore } from "@/state/store";
import type { ThemeId } from "@/state/slices/session";

type Mode = "system" | "dark" | "light";

const LIGHT_QUERY = "(prefers-color-scheme: light)";

/**
 * The accent's value is read back off the painted swatch rather than written
 * down, so this stays honest when the token changes — and keeps every colour
 * literal out of feature code.
 */
function readSwatchHex(el: HTMLElement | null): string {
  if (!el) return "";
  const rgb = getComputedStyle(el).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!rgb || rgb.length < 3) return "";
  return `#${rgb
    .slice(0, 3)
    .map((n) => Math.round(Number(n)).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function AppearanceDialog() {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const popDialog = useStore((s) => s.popDialog);
  const [mode, setMode] = useState<Mode>(theme === "paper" ? "light" : "dark");
  const [previewOn, setPreviewOn] = useState(true);
  const [previewChecked, setPreviewChecked] = useState(true);
  const swatchRef = useRef<HTMLSpanElement>(null);
  const [accent, setAccent] = useState("");

  /* "System" is a real setting: follow the OS and keep following it while the
     dialog is open, rather than silently resolving to dark once. */
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia(LIGHT_QUERY);
    const apply = (light: boolean) => setTheme(light ? "paper" : "graphite");
    apply(mq.matches);
    const onChange = (e: MediaQueryListEvent) => apply(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, setTheme]);

  /* Re-read after a theme flip, once the new palette has painted. */
  useEffect(() => {
    const raf = requestAnimationFrame(() => setAccent(readSwatchHex(swatchRef.current)));
    return () => cancelAnimationFrame(raf);
  }, [theme]);

  const pick = (m: Mode) => {
    setMode(m);
    if (m === "system") return;
    setTheme((m === "light" ? "paper" : "graphite") satisfies ThemeId);
  };

  return (
    <DialogFrame title="Appearance" width={520} footer={<GhostButton onClick={popDialog}>Done</GhostButton>}>
      <CapsHeader>Mode</CapsHeader>
      <SegmentedControl
        options={[
          { value: "system", label: "System" },
          { value: "dark", label: "Dark" },
          { value: "light", label: "Light" },
        ]}
        value={mode}
        onChange={pick}
        className="w-full"
      />

      <CapsHeader className="mt-4">Accent</CapsHeader>
      <div className="flex items-center gap-2.5">
        <span
          ref={swatchRef}
          aria-hidden
          className="size-5 shrink-0 rounded-md border border-line-strong bg-accent-z transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
        />
        <span className="flex h-6 items-center rounded-md bg-activebg px-2 font-mono text-xs text-ink">
          {accent || "—"}
        </span>
        <span className="text-xs text-ink-3">Geist neutral · fixed</span>
      </div>

      <CapsHeader className="mt-4">Preview</CapsHeader>
      <div className="flex items-center gap-4">
        <AccentButton>Send</AccentButton>
        <div className="flex items-center gap-2">
          <MiniSwitch on={previewOn} onChange={setPreviewOn} label="Preview switch" />
          <span className="text-base text-ink-2">Switch</span>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="appearance-preview-check"
            checked={previewChecked}
            onCheckedChange={(v) => setPreviewChecked(v === true)}
          />
          <Label htmlFor="appearance-preview-check" className="text-base font-normal text-ink-2">
            Checkbox
          </Label>
        </div>
      </div>

      <div className="mt-5 font-mono text-xs text-ink-3">
        Stored per machine — ~/.zestman/studio/theme.json
      </div>
    </DialogFrame>
  );
}
