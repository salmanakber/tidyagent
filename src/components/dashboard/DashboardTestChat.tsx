"use client";

import { ChatWidget } from "@/components/widget/ChatWidget";
import type { WidgetTemplate } from "@prisma/client";

export function DashboardTestChat({
  name,
  greeting,
  primaryColor,
  position,
  avatarUrl,
  template,
  voiceEnabled,
  voiceId,
}: {
  name: string;
  greeting: string;
  primaryColor: string;
  position: "BOTTOM_RIGHT" | "BOTTOM_LEFT";
  avatarUrl?: string | null;
  template?: WidgetTemplate | null;
  voiceEnabled?: boolean;
  voiceId?: string | null;
}) {
  return (
    <section className="panel overflow-hidden p-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Testing mode</p>
        <h2 className="mt-2 font-display text-xl text-white">Test the AI employee</h2>
        <p className="mt-2 text-sm text-navy-300">
          Type a visitor question here. This is the same chat bubble customers see on the live site.
        </p>
      </div>
      <div className="relative min-h-[560px] overflow-hidden rounded-[32px] bg-slate-200">
        <ChatWidget
          name={name}
          greeting={greeting}
          primaryColor={primaryColor}
          position={position}
          avatarUrl={avatarUrl}
          preview
          startOpen
          template={template ?? "CLASSIC"}
          voiceEnabled={Boolean(voiceEnabled)}
          voiceId={voiceId}
        />
      </div>
    </section>
  );
}
