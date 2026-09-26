import * as si from "simple-icons";
import { cn } from "@/lib/utils";

/**
 * The framework's own mark, drawn in the current text colour, instead of the
 * word "express" beside the project name. A mark reads faster than a word and
 * it scales to the dozen adapters we will ship; anything we have no mark for
 * falls back to the framework's initial rather than a wrong logo.
 */
const MARKS: Record<string, { path: string; title: string }> = {
  express: si.siExpress,
  nest: si.siNestjs,
  nestjs: si.siNestjs,
  fastify: si.siFastify,
  hono: si.siHono,
  koa: si.siKoa,
  node: si.siNodedotjs,
  django: si.siDjango,
  fastapi: si.siFastapi,
  flask: si.siFlask,
  rails: si.siRubyonrails,
  laravel: si.siLaravel,
  spring: si.siSpring,
  go: si.siGo,
  graphql: si.siGraphql,
};

export function FrameworkMark({
  framework,
  className,
  size = 14,
}: {
  framework: string | undefined;
  className?: string;
  size?: number;
}) {
  const key = (framework ?? "").toLowerCase();
  const mark = MARKS[key];

  if (!mark) {
    return (
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center font-mono text-[10px] text-ink-3", className)}
        style={{ width: size, height: size }}
        title={framework || undefined}
      >
        {(framework?.[0] ?? "?").toUpperCase()}
      </span>
    );
  }

  return (
    <svg
      role="img"
      aria-label={mark.title}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn("shrink-0", className)}
    >
      <title>{mark.title}</title>
      <path d={mark.path} />
    </svg>
  );
}
