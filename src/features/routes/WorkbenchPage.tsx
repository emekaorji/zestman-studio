import { useStore } from "@/state/store";
import { EmptyState } from "@/components/primitives";
import { EditorTabs } from "./EditorTabs";
import { RouteEditor } from "./RouteEditor";
import { WsConsole } from "./WsConsole";
import { ReconcilePage } from "./ReconcilePage";

/** Routes section main viewport: reconcile view, empty state, or the editor. */
export function WorkbenchPage() {
  const view = useStore((s) => s.sections.routes.view);
  const openTabs = useStore((s) => s.openTabs);
  const activeTabId = useStore((s) => s.activeTabId);
  const routes = useStore((s) => s.routes);

  if (view === "reconcile") return <ReconcilePage />;

  if (openTabs.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EditorTabs />
        <EmptyState title="Select a route" sub="or press ⌘K" />
      </div>
    );
  }

  const active = openTabs.find((t) => t.id === activeTabId) ?? openTabs[0];
  const route = routes.find((r) => r.id === active.routeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EditorTabs />
      {route == null ? (
        <EmptyState title="Route not found" />
      ) : route.protocol === "websocket" ? (
        <WsConsole key={active.id} tab={active} route={route} />
      ) : (
        <RouteEditor key={active.id} tab={active} route={route} />
      )}
    </div>
  );
}
