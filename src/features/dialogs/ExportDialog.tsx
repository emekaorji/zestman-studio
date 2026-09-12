import { Braces, Download, FileCode, Globe } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DialogFrame } from "@/components/dialogs/DialogFrame";
import { GhostButton } from "@/components/primitives";
import { useStore } from "@/state/store";
import { cn } from "@/lib/utils";

interface ExportRow {
  icon: LucideIcon;
  title: string;
  sub: string;
  file: string;
}

export function ExportDialog() {
  const popDialog = useStore((s) => s.popDialog);
  const pushToast = useStore((s) => s.pushToast);
  const routeCount = useStore((s) => s.routes.length);
  const envCount = useStore((s) => s.environments.length);

  const rows: ExportRow[] = [
    {
      icon: Braces,
      title: "Postman Collection",
      sub: `zestman-collection.postman.json · ${routeCount} requests`,
      file: "zestman-collection.postman.json",
    },
    {
      icon: Globe,
      title: "Environments",
      sub: `${envCount} environments · Postman format`,
      file: "zestman-environments.postman.json",
    },
    {
      icon: FileCode,
      title: "OpenAPI 3.0.3",
      sub: "openapi.json · 14 paths · merged",
      file: "openapi.json",
    },
  ];

  return (
    <DialogFrame title="Export" width={520} footer={<GhostButton onClick={popDialog}>Close</GhostButton>}>
      <div className="flex flex-col">
        {rows.map((r, i) => (
          <div
            key={r.title}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              "flex h-14 items-center gap-3 animate-in fade-in-0 fill-mode-both",
              "duration-[var(--dur-base)] ease-[var(--ease-out)]",
              i > 0 && "border-t border-line",
            )}
          >
            <r.icon size={16} strokeWidth={1.5} className="shrink-0 text-ink-2" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-medium text-ink">{r.title}</div>
              <div className="mt-0.5 truncate text-xs text-ink-3">{r.sub}</div>
            </div>
            <GhostButton
              onClick={() => pushToast({ kind: "info", text: `Exported ${r.file}` })}
              aria-label={`Download ${r.file}`}
            >
              <Download size={14} strokeWidth={1.5} />
              Download
            </GhostButton>
          </div>
        ))}
      </div>
    </DialogFrame>
  );
}
