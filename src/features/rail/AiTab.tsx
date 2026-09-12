import { Check, CornerDownLeft, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/state/store";
import { GhostButton, Pill, SegmentedControl } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { OperatorCard } from "@/state/slices/misc";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Draft a request for POST /users",
  "Why did POST /orders/:id/cancel 500?",
  "Generate tests for the users module",
];

/** One audited operator action. Cards land one at a time, so they ease in. */
function FeedCard({ card, index }: { card: OperatorCard; index: number }) {
  const decide = useStore((s) => s.decideOperatorCard);
  /* The card's `body` IS the file header for a diff card, and the daemon
     repeats it as the diff's first context line. Rendering both prints the
     same path twice, once blue and once gray. */
  const diff = card.diff?.filter((d) => d.line !== card.body);

  return (
    <div
      style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
      className={cn(
        "rounded-lg border border-line bg-sunken px-2.5 py-2",
        "animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both",
        "duration-[var(--dur-slow)] ease-[var(--ease-out)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="caps-label truncate">{card.title}</span>
        {card.pill ? (
          <Pill tone="err" className="shrink-0 font-mono">
            {card.pill}
          </Pill>
        ) : null}
      </div>
      {card.body ? <div className="mt-1 truncate font-mono text-xs text-link-z">{card.body}</div> : null}
      {diff && diff.length > 0 ? (
        <>
          <div className="mt-1.5 flex flex-col">
            {diff.map((d, i) => (
              <span
                key={i}
                className={cn(
                  "font-mono text-xs whitespace-pre",
                  d.tone === "add" ? "text-ok" : d.tone === "del" ? "text-err" : "text-ink-3",
                )}
              >
                {d.line}
              </span>
            ))}
          </div>
          {/* h32 — Vercel's small button. The 24px `xs` size is an icon-button
              height; a text button that short reads as a toy. */}
          {card.decision ? (
            <div className="mt-2 flex h-8 items-center gap-1.5 animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]">
              {card.decision === "accepted" ? (
                <>
                  <Check size={16} strokeWidth={1.5} className="shrink-0 text-ok" />
                  <span className="text-base text-ok">Applied</span>
                </>
              ) : (
                <>
                  <X size={16} strokeWidth={1.5} className="shrink-0 text-ink-3" />
                  <span className="text-base text-ink-3">Rejected</span>
                </>
              )}
            </div>
          ) : (
            <div className="mt-2 flex gap-1.5">
              <GhostButton size="sm" onClick={() => decide(card.id, "rejected")}>
                Reject
              </GhostButton>
              <Button
                size="default"
                onClick={() => decide(card.id, "accepted")}
                className="h-8 px-2.5 text-base font-medium transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]"
              >
                Accept
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Rail · AI — Ask mode (suggestions + input) and Act mode (audited card feed). */
export function AiTab() {
  const railMode = useStore((s) => s.railMode);
  const setRailMode = useStore((s) => s.setRailMode);
  const operatorFeed = useStore((s) => s.operatorFeed);
  const operatorThinking = useStore((s) => s.operatorThinking);
  const askOperator = useStore((s) => s.askOperator);
  const [input, setInput] = useState("");

  const submit = () => {
    const q = input.trim();
    if (!q) return;
    setInput("");
    void askOperator(q);
  };

  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <div className="mb-3 shrink-0">
        <SegmentedControl
          size="sm"
          options={[
            { value: "ask", label: "Ask" },
            { value: "act", label: "Act" },
          ]}
          value={railMode}
          onChange={setRailMode}
          className="w-32"
        />
        <div className="mt-2 font-mono text-xs text-ink-3">reads src/ · writes .zestman/ only</div>
      </div>

      {railMode === "ask" ? (
        <div
          key="ask"
          className="fade-scroll min-h-0 flex-1 overflow-y-auto animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
        >
          <p className="text-base leading-5 text-ink-2">
            Ask about your API. Drafts requests, explains failures, writes tests — grounded in your code.
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {SUGGESTIONS.map((s, i) => (
              <Button
                key={s}
                variant="outline"
                onClick={() => void askOperator(s)}
                style={{ animationDelay: `${i * 40}ms` }}
                className={cn(
                  "h-auto justify-start border-ds-gray-400 bg-transparent px-2.5 py-2 text-left",
                  "text-base font-normal whitespace-normal text-ink-2 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)]",
                  "hover:bg-hoverbg hover:text-ink dark:bg-transparent dark:hover:bg-hoverbg",
                  "animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-both",
                  "duration-[var(--dur-base)] ease-[var(--ease-out)]",
                )}
              >
                {s}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div
          key="act"
          className="fade-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto animate-in fade-in-0 duration-[var(--dur-base)] ease-[var(--ease-out)]"
        >
          {operatorFeed.length === 0 && !operatorThinking ? (
            <p className="text-base leading-5 text-ink-3">
              Every action renders as a card; every write lands as a reviewable file diff.
            </p>
          ) : null}
          {operatorFeed.map((card, i) => (
            <FeedCard key={card.id} card={card} index={i} />
          ))}
          {operatorThinking ? (
            <div className="flex items-center gap-1.5 px-0.5 text-xs text-ink-3 animate-in fade-in-0 duration-[var(--dur-base)]">
              <Sparkles size={14} strokeWidth={1.5} className="animate-pulse" /> thinking…
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-3 shrink-0">
        <InputGroup className="h-9 border-ds-gray-400 bg-transparent dark:bg-transparent">
          <InputGroupInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            aria-label="Ask Zestman"
            placeholder="Ask Zestman…"
            className="text-base text-ink placeholder:text-ink-3"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              variant="ghost"
              onClick={submit}
              disabled={input.trim() === ""}
              aria-label="Send"
              className="text-ink-3 transition-colors duration-[var(--dur-base)] ease-[var(--ease-in-out)] hover:text-ink"
            >
              <CornerDownLeft size={14} strokeWidth={1.5} />
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
