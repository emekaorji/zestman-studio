import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Renders trusted-ish markdown (doc pages live in the user's own repo) as
 * sanitized HTML, styled with the studio's type scale rather than a generic
 * prose theme so it sits next to the rest of the page.
 */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(source, { async: false }) as string;
    return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
  }, [source]);
  return (
    <div
      className={cn(
        "md-body text-base leading-6 text-ink-2",
        "[&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-ink [&_h1:first-child]:mt-0",
        "[&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-md [&_h2]:font-semibold [&_h2]:text-ink",
        "[&_h3]:mt-4 [&_h3]:mb-1.5 [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-ink",
        "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
        "[&_a]:text-link-z [&_a:hover]:underline",
        "[&_code]:rounded [&_code]:bg-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-ink",
        "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-line [&_pre]:bg-sunken [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-5 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm",
        "[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink",
        "[&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top [&_td]:font-mono [&_td]:text-[13px]",
        "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-3",
        "[&_hr]:my-4 [&_hr]:border-line",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
