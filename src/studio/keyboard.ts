import { useEffect } from "react";
import { useStore } from "@/state/store";

/**
 * Global keyboard map: ⌘K palette · ⌘⏎ send · ⌘L focus URL · ⌘W close tab ·
 * ⌃Tab cycle · ⌘/ shortcuts · ⌘B sidebar · ⌘⌥B rail · ⌘J drawer · Esc.
 */
export function useGlobalKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        s.setPaletteOpen(!s.paletteOpen);
        return;
      }
      if (e.key === "Escape") {
        if (s.escape()) e.preventDefault();
        return;
      }
      if (mod && e.key === "Enter") {
        if (s.section === "routes" && s.activeTabId) {
          e.preventDefault();
          void s.send(s.activeTabId);
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "l") {
        if (s.section === "routes") {
          e.preventDefault();
          s.focusUrl();
        }
        return;
      }
      if (mod && e.key.toLowerCase() === "w" && s.section === "routes" && s.activeTabId) {
        e.preventDefault();
        s.closeTab(s.activeTabId);
        return;
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        s.cycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (mod && e.key === "/") {
        e.preventDefault();
        s.pushDialog({ kind: "shortcuts" });
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        s.pushDialog({ kind: "runner" });
        return;
      }
      // Panel tucking — every panel can be shown/hidden from the keyboard.
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (e.altKey) s.toggleRail();
        else s.toggleSidebar();
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        s.toggleDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
