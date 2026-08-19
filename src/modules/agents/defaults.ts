import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BUSINESS_RULES,
  DEFAULT_TOOL_PERMISSIONS,
  ECOMMERCE_CAPABILITY_KEYS,
} from "@/modules/wix/capabilities";

export async function seedDefaultAgent(input: {
  organizationId: string;
  siteId: string;
  name?: string;
  storesEnabled?: boolean;
}) {
  const existing = await prisma.agent.findFirst({
    where: { organizationId: input.organizationId, siteId: input.siteId },
  });
  if (existing) return existing;

  const agent = await prisma.agent.create({
    data: {
      organizationId: input.organizationId,
      siteId: input.siteId,
      name: input.name ?? "Sarah",
      role: "Customer Assistant",
      personality: "friendly",
      status: "DRAFT",
      focus: ["customer_support", "sales"],
      widgetPrimaryColor: "#1F3A5F",
      widgetGreeting: "Hi! How can I help you today?",
      widgetPosition: "BOTTOM_RIGHT",
      widgetEmbedMode: "AUTO",
      capabilities: {
        create: ECOMMERCE_CAPABILITY_KEYS.map((key) => ({
          organizationId: input.organizationId,
          key,
          enabled: input.storesEnabled ? true : !["product_search", "cart_assistance", "order_tracking", "returns_support"].includes(key),
          source: "recommended",
        })),
      },
      rules: {
        create: DEFAULT_BUSINESS_RULES.map((rule) => ({
          organizationId: input.organizationId,
          key: rule.key,
          description: rule.description,
          enabled: true,
        })),
      },
      toolPermissions: {
        create: DEFAULT_TOOL_PERMISSIONS.map((permission) => ({
          organizationId: input.organizationId,
          toolKey: permission.toolKey,
          mode: input.storesEnabled ? permission.mode : permission.toolKey.includes("Product") || permission.toolKey.includes("Cart") || permission.toolKey.includes("Order") ? "DISABLED" : permission.mode,
        })),
      },
      workflows: {
        create: [
          { organizationId: input.organizationId, key: "support", enabled: true },
          { organizationId: input.organizationId, key: "sales", enabled: true },
          { organizationId: input.organizationId, key: "shopping", enabled: Boolean(input.storesEnabled) },
          { organizationId: input.organizationId, key: "complaints", enabled: true },
          { organizationId: input.organizationId, key: "handoff", enabled: true },
        ],
      },
    },
  });

  return agent;
}
