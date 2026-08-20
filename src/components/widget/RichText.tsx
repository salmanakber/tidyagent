"use client";

import { Fragment } from "react";

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function safeHref(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return (
    <>
      {parts.map((part, index) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) {
          return (
            <strong key={index} className="font-semibold">
              {bold[1]}
            </strong>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (link) {
          const href = safeHref(link[2] ?? "");
          if (!href) return <Fragment key={index}>{link[1]}</Fragment>;
          return (
            <a key={index} href={href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {link[1]}
            </a>
          );
        }
        return <Fragment key={index}>{part}</Fragment>;
      })}
    </>
  );
}

export function AgentRichText({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").trim() ? text.replace(/\r/g, "").split(/\n{2,}/) : [text];
  return (
    <div className="space-y-2 text-left">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        const listStart = lines.findIndex((line) => /^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line));
        if (listStart >= 0) {
          const intro = lines.slice(0, listStart).join("\n").trim();
          const items = lines
            .slice(listStart)
            .map((line) => line.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim())
            .filter(Boolean);
          return (
            <div key={index} className="space-y-2">
              {intro ? (
                <p>
                  <Inline text={intro} />
                </p>
              ) : null}
              <ul className="list-disc space-y-1.5 pl-4">
                {items.map((line, item) => (
                  <li key={item}>
                    <Inline text={line} />
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            <Inline text={block} />
          </p>
        );
      })}
    </div>
  );
}

export function stripForVoice(text: string) {
  return text
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .trim();
}

export function escapePreview(text: string) {
  return escapeText(text);
}
