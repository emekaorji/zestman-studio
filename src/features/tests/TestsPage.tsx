import { useStore } from "@/state/store";
import { ChecksBoard } from "./ChecksBoard";
import { CheckRunView } from "./CheckRunView";
import { CiSetupView } from "./CiSetupView";
import { FlowEditor } from "./FlowEditor";
import { NewScheduleForm, ScheduleDetail, SchedulesList } from "./SchedulesViews";

/** Tests section router — one concern per view, switched off sections.tests. */
export function TestsPage() {
  const tests = useStore((s) => s.sections.tests);

  if (tests.ciSetup) return <CiSetupView />;

  if (tests.tab === "checks") {
    if (tests.checkRun && tests.checkId) return <CheckRunView routeId={tests.checkId} />;
    return <ChecksBoard />;
  }

  if (tests.tab === "flows") return <FlowEditor flowId={tests.flowId} run={tests.flowRun} />;

  if (tests.creating) return <NewScheduleForm />;
  if (tests.scheduleId) return <ScheduleDetail scheduleId={tests.scheduleId} />;
  return <SchedulesList />;
}
