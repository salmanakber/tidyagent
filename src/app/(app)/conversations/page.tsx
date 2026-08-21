import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/security/session";
import { getWorkspace } from "@/modules/organizations/workspace";
import { scopedConversations } from "@/modules/organizations/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { relativeTime } from "@/lib/utils";
import { HumanHandoffForm } from "@/components/conversations/HumanHandoffForm";

export default async function ConversationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const [conversations, workspace] = await Promise.all([scopedConversations(session), getWorkspace(session)]);
  const humanName = workspace.organization.humanAgentName;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title="Conversations"
        description={
          humanName
            ? `When the AI cannot verify an answer, visitors are connected to ${humanName}. Open a thread to read the full chat.`
            : "Every visitor chat lands here. Escalated threads need a person from your team."
        }
      />
      <HumanHandoffForm
        name={workspace.organization.humanAgentName}
        role={workspace.organization.humanAgentRole}
        email={workspace.organization.humanAgentEmail}
      />
      <div className="panel overflow-hidden">
        {conversations.length === 0 ? (
          <p className="p-8 text-sm text-navy-300">No conversations yet. Publish the widget and they’ll appear here.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {conversations.map((conversation) => {
              const waiting = conversation.status === "ESCALATED";
              return (
                <li key={conversation.id}>
                  <Link
                    href={`/conversations/${conversation.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {conversation.customer?.name || conversation.customer?.email || "Anonymous visitor"}
                      </p>
                      <p className="truncate text-sm text-navy-300">
                        {conversation.messages[0]?.content ?? "No messages yet"}
                      </p>
                      {waiting && humanName ? (
                        <p className="mt-1 text-xs text-amber-200">Waiting for {humanName}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <StatusPill status={conversation.status} />
                      <span className="text-xs text-navy-400">{relativeTime(conversation.lastMessageAt)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
