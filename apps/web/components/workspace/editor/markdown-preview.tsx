"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "h-full overflow-y-auto bg-background px-8 py-7 text-foreground",
        className,
      )}
      data-testid="markdown-preview"
    >
      <article className="mx-auto max-w-3xl">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            h1: ({ children }) => (
              <h1 className="mt-9 mb-4 border-hairline border-b pb-2 font-serif text-3xl tracking-[-0.02em] first:mt-0">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="mt-8 mb-3 font-serif text-2xl tracking-[-0.015em]">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="mt-6 mb-2 font-medium text-lg">{children}</h3>
            ),
            h4: ({ children }) => (
              <h4 className="mt-4 mb-2 font-medium text-base">{children}</h4>
            ),
            p: ({ children }) => (
              <p className="my-3 text-[13px] text-foreground/90 leading-7">
                {children}
              </p>
            ),
            ul: ({ children }) => (
              <ul className="my-3 list-disc space-y-1 pl-6 text-[13px] leading-6">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="my-3 list-decimal space-y-1 pl-6 text-[13px] leading-6">
                {children}
              </ol>
            ),
            li: ({ children }) => <li className="pl-1">{children}</li>,
            blockquote: ({ children }) => (
              <blockquote className="my-4 border-primary border-l-2 bg-primary/5 py-2 pr-3 pl-4 text-[13px] text-muted-foreground italic">
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-primary"
              >
                {children}
              </a>
            ),
            code: ({
              className: codeClassName,
              children,
              node: _node,
              ...props
            }) => {
              const isBlock = codeClassName?.startsWith("language-");
              if (isBlock) {
                return (
                  <code
                    className={cn(
                      "block overflow-x-auto bg-surface-dark p-4 font-mono text-on-dark text-xs leading-relaxed",
                      codeClassName,
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              }
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-primary"
                  {...props}
                >
                  {children}
                </code>
              );
            },
            pre: ({ children }) => (
              <pre className="my-4 overflow-hidden rounded-lg border border-hairline bg-surface-dark">
                {children}
              </pre>
            ),
            table: ({ children }) => (
              <div className="my-5 overflow-x-auto">
                <table className="w-full border-collapse text-[12px]">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children }) => (
              <thead className="border-hairline border-b bg-muted/60">
                {children}
              </thead>
            ),
            th: ({ children }) => (
              <th className="px-3 py-2 text-left font-medium">{children}</th>
            ),
            td: ({ children }) => (
              <td className="border-hairline/70 border-t px-3 py-2 align-top">
                {children}
              </td>
            ),
            hr: () => <hr className="my-6 border-hairline" />,
            strong: ({ children }) => (
              <strong className="font-semibold">{children}</strong>
            ),
            em: ({ children }) => <em className="italic">{children}</em>,
            img: ({ src, alt }) => (
              <img
                src={src}
                alt={alt ?? ""}
                className="my-4 max-w-full rounded border border-hairline"
              />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </article>
    </div>
  );
}
