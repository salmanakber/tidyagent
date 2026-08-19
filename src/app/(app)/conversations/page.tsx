import { redirect } from "next/navigation";
import { getSession } from "@/lib/security/session";
import { scopedConversations } from "@/modules/organizations/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { relativeTime } from "@/lib/utils";

export default async function ConversationsPage() {
  const session = await getSession();
  if (!session) redirect("/");
  const conversations = await scopedConversations(session);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inbox"
        title="Conversations"
        description="Every visitor gets a session immediately. Identified shoppers attach to a customer record."
      />
      <div className="panel overflow-hidden">
        {conversations.length === 0 ? (
          <p className="p-8 text-sm text-navy-300">No conversations yet. Publish the widget and they’ll appear here.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {conversations.map((conversation) => (
              <li key={conversation.id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {conversation.customer?.name || "Anonymous visitor"}
                  </p>
                  <p className="truncate text-sm text-navy-300">
                    {conversation.messages[0]?.content ?? "No messages yet"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusPill status={conversation.status} />
                  <span className="text-xs text-navy-400">{relativeTime(conversation.lastMessageAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
