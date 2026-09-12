import { useStore, type StudioStore } from "@/state/store";

/**
 * The command registry behind ⌘K. Built from a store snapshot when the
 * palette opens; every `run` re-reads state at invocation time so nothing
 * here goes stale.
 */
export interface PaletteCommand {
  id: string;
  group: "routes" | "actions" | "operator";
  label: string;
  /** Right-aligned mono hint (route source file). */
  sublabel?: string;
  /** Right-aligned keyboard chip (actions). */
  kbd?: string;
  /** Routes only — drives MethodBadge + ⌘⏎ send-now. */
  method?: string;
  routeId?: string;
  run: () => void;
}

function closePalette() {
  useStore.getState().setPaletteOpen(false);
}

export function buildCommands(store: StudioStore): PaletteCommand[] {
  const commands: PaletteCommand[] = [];

  /* ── ROUTES ────────────────────────────────────────────────────────── */
  for (const route of store.routes) {
    commands.push({
      id: `route:${route.id}`,
      group: "routes",
      label: route.path,
      method: route.method,
      routeId: route.id,
      sublabel: route.sourceLocations[0]?.file,
      run: () => {
        closePalette();
        useStore.getState().navigate({ go: "route", routeId: route.id });
      },
    });
  }

  /* ── ACTIONS ───────────────────────────────────────────────────────── */
  const httpCount = store.routes.filter((r) => r.protocol === "http").length;
  const targetEnv = store.environments.find((e) => !e.isActive);
  const createUser = store.routes.find((r) => r.method === "POST" && r.path === "/api/v1/users");
  const exampleCount = createUser
    ? store.examples.filter((e) => e.routeId === createUser.id).length
    : 0;

  commands.push({
    id: "act:run-all",
    group: "actions",
    label: `Run all ${httpCount} routes`,
    kbd: "⌘⇧R",
    run: () => {
      closePalette();
      useStore.getState().pushDialog({ kind: "runner", scope: "all" });
    },
  });

  if (targetEnv) {
    commands.push({
      id: "act:switch-env",
      group: "actions",
      label: `Switch environment → ${targetEnv.name}`,
      kbd: "⌘E",
      run: () => {
        closePalette();
        const s = useStore.getState();
        void s.activateEnvironment(targetEnv.id);
        s.pushToast({ kind: "info", text: `Environment switched → ${targetEnv.name}` });
      },
    });
  }

  commands.push(
    {
      id: "act:open-spec",
      group: "actions",
      label: "Open spec",
      kbd: "⌘⇧O",
      run: () => {
        closePalette();
        useStore.getState().navigate({ go: "specs", tab: "document" });
      },
    },
    {
      id: "act:new-request",
      group: "actions",
      label: "New request",
      kbd: "⌘N",
      run: () => {
        closePalette();
        useStore.getState().navigate({ go: "section", section: "routes" });
      },
    },
    {
      id: "act:diagnostics",
      group: "actions",
      label: "View diagnostics",
      run: () => {
        closePalette();
        useStore.getState().navigate({ go: "insights", tab: "diagnostics" });
      },
    },
    {
      id: "act:oauth-tokens",
      group: "actions",
      label: "OAuth tokens",
      run: () => {
        closePalette();
        useStore.getState().pushDialog({ kind: "oauth-tokens" });
      },
    },
  );

  if (createUser) {
    commands.push({
      id: "act:examples",
      group: "actions",
      label: `Examples — POST /users (${exampleCount})`,
      run: () => {
        closePalette();
        useStore.getState().pushDialog({ kind: "examples", routeId: createUser.id });
      },
    });
  }

  commands.push(
    {
      id: "act:import-export",
      group: "actions",
      label: "Import / Export…",
      kbd: "⌘P",
      run: () => {
        closePalette();
        useStore.getState().pushDialog({ kind: "import" });
      },
    },
    {
      id: "act:appearance",
      group: "actions",
      label: "Appearance",
      run: () => {
        closePalette();
        useStore.getState().pushDialog({ kind: "appearance" });
      },
    },
    {
      id: "act:replay-scan",
      group: "actions",
      label: "Replay first scan",
      run: () => {
        closePalette();
        useStore.getState().pushDialog({ kind: "scan-onboarding" });
      },
    },
  );

  /* ── OPERATOR ──────────────────────────────────────────────────────── */
  commands.push(
    {
      id: "op:examples",
      group: "operator",
      label: "✦ generate examples for routes without one",
      run: () => {
        closePalette();
        const s = useStore.getState();
        void s.askOperator("generate examples for routes without one");
        s.pushToast({ kind: "operator", text: "Operator: drafting examples — review in rail" });
      },
    },
    {
      id: "op:docs",
      group: "operator",
      label: "✦ draft docs for changed endpoints",
      run: () => {
        closePalette();
        const s = useStore.getState();
        void s.askOperator("draft docs for changed endpoints");
        s.pushToast({ kind: "operator", text: "Operator: drafting docs — review in rail" });
      },
    },
  );

  return commands;
}
