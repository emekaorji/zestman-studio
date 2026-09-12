import { Dot } from "@/components/primitives";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { useStore } from "@/state/store";

/** Level-2 sidebar for the Tests section: checks board, flows, schedules. */
export function TestsSidebar() {
  const navigate = useStore((s) => s.navigate);
  const tests = useStore((s) => s.sections.tests);
  const routes = useStore((s) => s.routes);
  const flows = useStore((s) => s.flows);
  const schedules = useStore((s) => s.schedules);

  const httpRouteCount = routes.filter((r) => r.protocol === "http").length;
  const activeFlowId = tests.flowId ?? flows[0]?.id ?? null;

  return (
    <SidebarLevel2 title="Tests">
      <div className="caps-label flex h-8 items-center px-5 pt-1">Checks</div>
      <IslandRow
        active={tests.tab === "checks"}
        onClick={() => navigate({ go: "tests", tab: "checks" })}
      >
        <span className="truncate">All routes</span>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-ds-gray-600">
          {httpRouteCount}
        </span>
      </IslandRow>

      <div className="caps-label flex h-8 items-center px-5 pt-3">Flows</div>
      {flows.map((f) => (
        <IslandRow
          key={f.id}
          active={tests.tab === "flows" && activeFlowId === f.id}
          onClick={() => navigate({ go: "tests", tab: "flows", id: f.id })}
        >
          <span className="truncate">{f.name}</span>
          <span className="ml-auto shrink-0 text-xs tabular-nums text-ds-gray-600">
            {f.steps.length}
          </span>
        </IslandRow>
      ))}

      <div className="caps-label flex h-8 items-center px-5 pt-3">Schedules</div>
      {schedules.map((sch) => (
        <IslandRow
          key={sch.id}
          active={tests.tab === "schedules" && tests.scheduleId === sch.id}
          onClick={() => navigate({ go: "tests", tab: "schedules", id: sch.id })}
        >
          <span className="truncate">{sch.name}</span>
          <span className="ml-auto flex shrink-0 items-center">
            <Dot tone={sch.enabled ? "ok" : "muted"} />
            <span className="sr-only">{sch.enabled ? "enabled" : "disabled"}</span>
          </span>
        </IslandRow>
      ))}
    </SidebarLevel2>
  );
}
