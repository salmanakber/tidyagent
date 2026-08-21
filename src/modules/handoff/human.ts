import { prisma } from "@/lib/prisma";
import { absoluteAvatar } from "@/modules/widget/avatar";

export type HumanContact = {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  email: string | null;
  voiceId: null;
  specialty: "SUPPORT";
};

export async function loadHumanContact(organizationId: string): Promise<HumanContact | null> {
  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, deletedAt: null },
    select: {
      id: true,
      name: true,
      humanAgentName: true,
      humanAgentRole: true,
      humanAgentAvatarUrl: true,
      humanAgentEmail: true,
    },
  });
  if (!organization?.humanAgentName?.trim()) return null;
  return {
    id: `human:${organization.id}`,
    name: organization.humanAgentName.trim(),
    role: organization.humanAgentRole?.trim() || "Team",
    avatarUrl: absoluteAvatar(organization.humanAgentAvatarUrl),
    email: organization.humanAgentEmail?.trim() || null,
    voiceId: null,
    specialty: "SUPPORT",
  };
}

export function humanWaitingText(name: string) {
  return `${name} has your message. A person from the team will follow up from this chat.`;
}
