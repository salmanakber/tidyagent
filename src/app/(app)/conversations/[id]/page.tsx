import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/security/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { ResolveChatButton } from "@/components/conversations/ResolveChatButton";
import { HumanReplyBox } from "@/components/conversations/HumanReplyBox";
import { cn, relativeTime } from "@/lib/utils";

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/");
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.organizationId, siteId: session.siteId },
    include: {
      customer: true,
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      escalations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!conversation) notFound();

  const organization = await prisma.organization.findFirst({
    where: { id: session.organizationId },
    select: { humanAgentName: true, humanAgentRole: true },
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title={conversation.customer?.name || conversation.customer?.email || "Anonymous visitor"}
        description={
          conversation.status === "ESCALATED"
            ? `${organization?.humanAgentName || "Your team"} should pick this up. The visitor already saw the handoff bubble.`
            : "Full transcript from the live widget."
        }
        actions={
          <>
            <StatusPill status={conversation.status} />
            <ResolveChatButton conversationId={conversation.id} open={conversation.status !== "RESOLVED"} />
            <Link href="/conversations" className="btn-secondary">
              All chats
            </Link>
          </>
        }
      />

      <div className="panel overflow-hidden">
        <div className="border-b border-white/5 px-5 py-3 text-xs text-navy-400">
          Started {relativeTime(conversation.startedAt)} · last message {relativeTime(conversation.lastMessageAt)}
          {conversation.escalations[0]?.summary ? ` · ${conversation.escalations[0].summary}` : ""}
        </div>
        <ol className="space-y-4 p-5">
          {conversation.messages.map((message) => {
            const meta = message.metadata && typeof message.metadata === "object" && !Array.isArray(message.metadata)
              ? (message.metadata as Record<string, unknown>)
              : {};
            const human = message.role === "HUMAN" || Boolean(meta.human);
            const handoff = meta.kind === "handoff";
            if (handoff) {
              return (
                <li key={message.id} className="text-center text-[11px] uppercase tracking-[0.14em] text-navy-400">
                  {message.content}
                </li>
              );
            }
            const visitor = message.role === "CUSTOMER";
            return (
              <li key={message.id} className={cn("flex", visitor ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[min(100%,36rem)] rounded-2xl px-4 py-3 text-sm leading-6",
                    visitor ? "bg-amber-500/15 text-white" : human ? "bg-emerald-500/10 text-emerald-50" : "bg-navy-950/50 text-navy-100",
                  )}
                >
                  <p className="text-[10px] uppercase tracking-[0.14em] text-navy-400">
                    {visitor ? "Visitor" : human ? organization?.humanAgentName || "Team" : String(meta.agentName || "AI")}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                  <p className="mt-2 text-[10px] text-navy-500">{relativeTime(message.createdAt)}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <HumanReplyBox conversationId={conversation.id} waiting={conversation.status === "ESCALATED"} />
      </div>
    </div>
  );
}
