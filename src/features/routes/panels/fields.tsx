import { useId, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/*
 * The three form controls the request panels need, each a thin composition over
 * shadcn so label association, focus ring and keyboard handling are Radix's.
 *
 * Vercel's form metrics: label 14/20 in gray-900, control 36 tall on a
 * gray-100 well with a 6px radius and 12px gutter.
 */

const CONTROL = cn(
  "h-9 rounded-lg border-line bg-ds-gray-100 px-3 text-base",
  "transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
  "dark:bg-ds-gray-100",
);

/** Labelled single-line field. Mono by default — these carry tokens and URLs. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  mono = true,
  type,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  type?: "text" | "password";
  inputMode?: "numeric" | "text";
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-base font-normal text-ink-2">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        className={cn(CONTROL, mono && "font-mono text-sm")}
      />
    </div>
  );
}

/** Labelled select. */
export function SelectField({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-base font-normal text-ink-2">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className={cn(CONTROL, "w-full justify-between")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start" className="min-w-(--radix-select-trigger-width)">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-base">
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A 36px row: label on the left, control on the right. */
export function SettingRow({
  label,
  control,
  htmlFor,
}: {
  label: string;
  control: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex h-9 items-center justify-between gap-6">
      <Label htmlFor={htmlFor} className="min-w-0 truncate text-base font-normal text-ink-2">
        {label}
      </Label>
      {control}
    </div>
  );
}

/** A labelled switch row — the Label is wired to the Switch, so the text toggles it. */
export function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingRow
      label={label}
      htmlFor={id}
      control={
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onChange}
          className="shrink-0 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
        />
      }
    />
  );
}
