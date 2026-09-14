import { useStore } from "@/state/store";
import type { DialogInstance } from "@/state/types";
import { ScanOnboarding } from "@/features/onboarding/ScanOnboarding";
import { AppearanceDialog } from "./AppearanceDialog";
import { ConfirmDialog } from "./ConfirmDialog";
import { CookiesDialog } from "./CookiesDialog";
import { ExamplesDialog } from "./ExamplesDialog";
import { ExportDialog } from "./ExportDialog";
import { ImportDialog } from "./ImportDialog";
import { OAuthTokensDialog } from "./OAuthTokensDialog";
import { RunnerDialog } from "./RunnerDialog";
import { ShortcutsDialog } from "./ShortcutsDialog";

/** The DialogKind → component registry. Exhaustive over DialogInstance. */
function renderDialog(d: DialogInstance) {
  switch (d.kind) {
    case "runner":
      return <RunnerDialog scope={d.scope} />;
    case "import":
      return <ImportDialog initialTab={d.tab} />;
    case "export":
      return <ExportDialog />;
    case "cookies":
      return <CookiesDialog />;
    case "oauth-tokens":
      return <OAuthTokensDialog />;
    case "examples":
      return <ExamplesDialog routeId={d.routeId} />;
    case "shortcuts":
      return <ShortcutsDialog />;
    case "appearance":
      return <AppearanceDialog />;
    case "scan-onboarding":
      return <ScanOnboarding />;
    case "confirm":
      return <ConfirmDialog dialog={d} />;
  }
}

/** Renders only the TOP of nav.dialogStack; lower dialogs stay hidden. Esc pops globally. */
export function DialogHost() {
  const stack = useStore((s) => s.dialogStack);
  const top = stack.at(-1);
  if (!top) return null;
  return <div key={`${top.kind}:${stack.length}`}>{renderDialog(top)}</div>;
}
