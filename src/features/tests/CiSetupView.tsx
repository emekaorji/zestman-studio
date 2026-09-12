import { Copy } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ROW_SM } from "@/lib/metrics";
import { useStore } from "@/state/store";
import { BackLink, PageBody, PageHead, SectionLabel } from "./bits";

const CHECKS_YML = `# .github/workflows/checks.yml
- uses: zestman/check-action@v1
  with:
    project: .
    fail-on: breaking
    token: \${{ github.token }}`;

const EXIT_CODES: Array<[string, string]> = [
  ["0", "all checks passing"],
  ["1", "check failures"],
  ["2", "discovery errors"],
];

const OUTPUTS = ["JUnit XML", "GitHub annotations", "exit code"];

function Step({ n, title, children }: { n: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-ds-gray-200 font-mono text-2xs tabular-nums text-ink-2"
      >
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-base text-ink">{title}</div>
        {children}
      </div>
    </li>
  );
}

/** CI setup — commit the checks, add the action, read the exit code. */
export function CiSetupView() {
  const navigate = useStore((s) => s.navigate);
  const pushToast = useStore((s) => s.pushToast);
  const checks = useStore((s) => s.checks);

  const passing = useMemo(
    () =>
      checks.reduce(
        (n, row) => n + Object.values(row.cells).filter((c) => c === "pass").length,
        0,
      ),
    [checks],
  );

  const copyYaml = () => {
    void navigator.clipboard?.writeText(CHECKS_YML);
    pushToast({ kind: "info", text: "Workflow copied", sub: ".github/workflows/checks.yml" });
  };

  return (
    <PageBody>
      <BackLink label="Checks" onClick={() => navigate({ go: "tests", tab: "checks" })} />

      <PageHead className="mt-4" title="Run checks in CI" sub="your checks are files, so CI just runs them" />

      <div className="mt-6 flex flex-wrap gap-9">
        <ol className="flex min-w-0 max-w-[768px] flex-1 flex-col gap-6">
          <Step n={1} title="Commit .zestman/ — your checks are files" />

          <Step n={2} title="Add the action">
            <div className="relative mt-3 rounded-lg border border-line bg-ds-gray-100 p-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy workflow YAML"
                    onClick={copyYaml}
                    className="absolute top-2 right-2 text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink focus-visible:text-ink"
                  >
                    <Copy size={16} strokeWidth={1.5} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy workflow</TooltipContent>
              </Tooltip>
              <pre className="fade-scroll-x hide-scrollbar m-0 overflow-x-auto pr-8 font-mono text-sm leading-5 whitespace-pre">
                <code>
                  <span className="text-ink-3">{"# .github/workflows/checks.yml\n"}</span>
                  <span className="text-ink-2">{CHECKS_YML.split("\n").slice(1).join("\n")}</span>
                </code>
              </pre>
            </div>
          </Step>

          <Step n={3} title="Exit codes">
            <ul className="mt-2 max-w-[420px]">
              {EXIT_CODES.map(([code, label]) => (
                <li
                  key={code}
                  style={{ height: ROW_SM }}
                  className="flex items-center border-b border-line/70"
                >
                  <span className="w-10 font-mono text-sm tabular-nums text-ink">{code}</span>
                  <span className="text-base text-ink-2">{label}</span>
                </li>
              ))}
            </ul>
          </Step>
        </ol>

        <aside className="w-72 shrink-0">
          <SectionLabel>Badge</SectionLabel>
          <div className="flex h-5 w-fit items-stretch overflow-hidden rounded-sm font-medium">
            <span className="flex items-center bg-ds-gray-200 px-2 text-2xs text-ink-2">checks</span>
            <span className="flex items-center bg-ok px-2 text-2xs tabular-nums text-ds-green-100">
              {passing} passing
            </span>
          </div>

          <SectionLabel className="mt-6">Output</SectionLabel>
          <ul>
            {OUTPUTS.map((label) => (
              <li
                key={label}
                style={{ height: ROW_SM }}
                className="flex items-center border-b border-line/70 text-base text-ink-2"
              >
                {label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PageBody>
  );
}
