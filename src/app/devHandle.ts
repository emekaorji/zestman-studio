import { useStore } from "@/state/store";
import type { NavCommand } from "@/state/types";
import { getClient } from "./client";
import { freezeFixtures } from "@/daemon/fixture/FixtureClient";

declare global {
  interface Window {
    __zest?: {
      nav: (cmd: NavCommand) => void;
      state: () => unknown;
      client: () => unknown;
      fx: { freeze: () => void; thaw: () => void };
    };
  }
}

/** Dev-only handle so browser automation can drive the URL-less SPA. */
export function installDevHandle() {
  window.__zest = {
    nav: (cmd) => useStore.getState().navigate(cmd),
    state: () => useStore.getState(),
    client: () => getClient(),
    fx: {
      freeze: () => freezeFixtures(true),
      thaw: () => freezeFixtures(false),
    },
  };
}
