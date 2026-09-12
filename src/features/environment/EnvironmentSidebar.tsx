import { Globe, Lock, Sparkles } from "lucide-react";
import { useStore } from "@/state/store";
import { IslandRow, SidebarLevel2 } from "@/components/shell/Sidebar";
import { Dot } from "@/components/primitives";

export function EnvironmentSidebar() {
  const navigate = useStore((s) => s.navigate);
  const view = useStore((s) => s.sections.environment.view);
  const envId = useStore((s) => s.sections.environment.envId);
  const environments = useStore((s) => s.environments);

  const activeEnvId = envId ?? environments.find((e) => e.isActive)?.id ?? environments[0]?.id;

  return (
    <SidebarLevel2 title="Environment">
      <div className="flex flex-col gap-0.5 pt-1">
        <IslandRow
          className="h-10"
          active={view === "globals"}
          onClick={() => navigate({ go: "environment", view: "globals" })}
        >
          <Globe size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate">Globals</span>
        </IslandRow>
        <IslandRow
          className="h-10"
          active={view === "vault"}
          onClick={() => navigate({ go: "environment", view: "vault" })}
        >
          <Lock size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate">Vault</span>
        </IslandRow>

        <div className="flex h-8 items-center px-5 pt-4">
          <span className="caps-label">Environments</span>
        </div>
        {environments.map((env, i) => (
          <div
            key={env.id}
            className="animate-in fade-in-0 fill-mode-backwards ease-[var(--ease-out)]"
            style={{ animationDelay: `${i * 20}ms`, animationDuration: "var(--dur-slow)" }}
          >
            <IslandRow
              className="h-10"
              active={view === "environment" && env.id === activeEnvId}
              onClick={() => navigate({ go: "environment", view: "environment", envId: env.id })}
            >
              <span className="min-w-0 flex-1 truncate">{env.name}</span>
              {env.isActive ? <Dot tone="ok" /> : null}
            </IslandRow>
          </div>
        ))}

        <div className="flex h-8 items-center px-5 pt-4">
          <span className="caps-label">Reference</span>
        </div>
        <IslandRow
          className="h-10"
          active={view === "dynamic"}
          onClick={() => navigate({ go: "environment", view: "dynamic" })}
        >
          <Sparkles size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
          <span className="min-w-0 flex-1 truncate">Dynamic variables</span>
        </IslandRow>
      </div>
    </SidebarLevel2>
  );
}
