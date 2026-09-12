import { useId } from "react";
import type { RouteSettings } from "@/daemon/types";
import type { OpenTab } from "@/state/slices/workbench";
import { useStore } from "@/state/store";
import { CapsHeader } from "@/components/primitives";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SettingRow, SwitchRow, TextField } from "./fields";

const SWITCHES: Array<{ key: keyof RouteSettings; label: string }> = [
  { key: "sslVerify", label: "SSL certificate verification" },
  { key: "followRedirects", label: "Follow redirects" },
  { key: "followOriginalMethod", label: "Follow original HTTP method" },
  { key: "followAuthHeader", label: "Follow Authorization header" },
  { key: "removeRefererOnRedirect", label: "Remove referer on redirect" },
  { key: "cookieJar", label: "Cookie jar" },
];

const PROXY_FIELDS: Array<{ key: keyof RouteSettings; label: string; placeholder: string }> = [
  { key: "proxyUrl", label: "Proxy URL", placeholder: "http://proxy.internal:8080" },
  { key: "clientCertPath", label: "Client cert path", placeholder: "~/.certs/client.pem" },
  { key: "clientKeyPath", label: "Client key path", placeholder: "~/.certs/client-key.pem" },
  { key: "caCertPath", label: "CA cert path", placeholder: "~/.certs/ca.pem" },
];

const NUM_INPUT = cn(
  "h-8 w-24 rounded-md border-line bg-ds-gray-100 px-2.5 text-right font-mono text-sm tabular-nums",
  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] dark:bg-ds-gray-100",
);

function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const id = useId();
  return (
    <SettingRow
      label={label}
      htmlFor={id}
      control={
        <Input
          id={id}
          value={String(value)}
          inputMode="numeric"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className={NUM_INPUT}
        />
      }
    />
  );
}

export function SettingsPanel({ tab }: { tab: OpenTab }) {
  const patchDraft = useStore((s) => s.patchDraft);
  const settings = tab.draft.settings;
  const patch = (p: Partial<RouteSettings>) => patchDraft(tab.id, { settings: { ...settings, ...p } });

  return (
    <div className="grid max-w-260 grid-cols-1 gap-x-12 gap-y-6 lg:grid-cols-2">
      <section className="flex flex-col">
        <CapsHeader>Request</CapsHeader>
        {SWITCHES.map((s) => (
          <SwitchRow
            key={s.key}
            label={s.label}
            checked={settings[s.key] === true}
            onChange={(v) => patch({ [s.key]: v })}
          />
        ))}
        <NumberRow label="Timeout ms" value={settings.timeoutMs} onChange={(timeoutMs) => patch({ timeoutMs })} />
        <NumberRow
          label="Max redirects"
          value={settings.maxRedirects}
          onChange={(maxRedirects) => patch({ maxRedirects })}
        />
      </section>

      <section className="flex flex-col gap-4 self-start">
        <CapsHeader>Proxy &amp; TLS</CapsHeader>
        {PROXY_FIELDS.map((f) => (
          <TextField
            key={f.key}
            label={f.label}
            placeholder={f.placeholder}
            value={String(settings[f.key] ?? "")}
            onChange={(v) => patch({ [f.key]: v })}
          />
        ))}
      </section>
    </div>
  );
}
