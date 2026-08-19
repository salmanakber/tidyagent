import { PrismaClient, type PlanKey } from "@prisma/client";

const prisma = new PrismaClient();

const PLANS: { key: PlanKey; name: string; conversationLimit: number; knowledgeLimit: number; voiceEnabled: boolean; advancedToolsEnabled: boolean; automationEnabled: boolean }[] = [
  { key: "FREE", name: "Free", conversationLimit: 100, knowledgeLimit: 50, voiceEnabled: false, advancedToolsEnabled: false, automationEnabled: false },
  { key: "STARTER", name: "Starter", conversationLimit: 1000, knowledgeLimit: 250, voiceEnabled: false, advancedToolsEnabled: false, automationEnabled: true },
  { key: "GROWTH", name: "Growth", conversationLimit: 5000, knowledgeLimit: 1000, voiceEnabled: true, advancedToolsEnabled: true, automationEnabled: true },
  { key: "PRO", name: "Pro", conversationLimit: 25000, knowledgeLimit: 5000, voiceEnabled: true, advancedToolsEnabled: true, automationEnabled: true },
];

async function upsertPlan(plan: (typeof PLANS)[number]) {
  return prisma.plan.upsert({
    where: { key: plan.key },
    update: plan,
    create: plan,
  });
}

async function seedTenant(input: {
  orgName: string;
  siteName: string;
  instanceId: string;
  wixSiteId: string;
  url: string;
  email: string;
  ownerName: string;
  industry: string;
  businessType: string;
  installedApps: string[];
  stores: boolean;
  planKey?: PlanKey;
  isFree?: boolean;
  status?: "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  cancelAtPeriodEnd?: boolean;
}) {
  const user = await prisma.user.upsert({
    where: { wixUserId: `demo:${input.instanceId}` },
    update: { email: input.email, name: input.ownerName },
    create: {
      wixUserId: `demo:${input.instanceId}`,
      email: input.email,
      name: input.ownerName,
    },
  });

  const existing = await prisma.wixSite.findUnique({ where: { wixInstanceId: input.instanceId } });
  if (existing) {
    return { organizationId: existing.organizationId, siteId: existing.id, userId: user.id };
  }

  const organization = await prisma.organization.create({
    data: {
      name: input.orgName,
      onboardingStatus: "PUBLISHED",
    },
  });

  const site = await prisma.wixSite.create({
    data: {
      organizationId: organization.id,
      wixInstanceId: input.instanceId,
      wixSiteId: input.wixSiteId,
      displayName: input.siteName,
      url: input.url,
      locale: "en",
      currency: "USD",
      ownerEmail: input.email,
      installedWixApps: input.installedApps,
      capabilities: {
        hasStores: input.stores,
        hasWebsiteContent: true,
        hasBookings: !input.stores,
      },
      connectionStatus: "connected",
      lastSyncedAt: new Date(),
      credential: {
        create: { organizationId: organization.id, instanceId: input.instanceId },
      },
    },
  });

  await prisma.organizationMember.create({
    data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
  });

  const planKey = input.planKey ?? "STARTER";
  const plan = await prisma.plan.findUniqueOrThrow({ where: { key: planKey } });
  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      planKey,
      status: input.status ?? (input.isFree ? "NONE" : "ACTIVE"),
      isFree: input.isFree ?? false,
      vendorProductId: input.isFree ? null : `${planKey.toLowerCase()}-monthly`,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
      autoRenewing: !(input.cancelAtPeriodEnd || input.isFree),
      currentPeriodEnd: input.cancelAtPeriodEnd ? new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) : null,
    },
  });

  await prisma.businessProfile.create({
    data: {
      organizationId: organization.id,
      siteId: site.id,
      name: input.orgName,
      businessType: input.businessType,
      industry: input.industry,
      businessModel: input.stores ? "ecommerce" : "services",
      summary: `${input.orgName} is a ${input.industry} business on Wix.`,
      capabilities: { hasStores: input.stores },
      analyzedAt: new Date(),
    },
  });

  const { seedDefaultAgent } = await import("../src/modules/agents/defaults");
  const agent = await seedDefaultAgent({
    organizationId: organization.id,
    siteId: site.id,
    name: input.stores ? "Noa" : "Maya",
    storesEnabled: input.stores,
  });

  await prisma.agent.update({
    where: { id: agent.id },
    data: { status: "ACTIVE", publishedAt: new Date() },
  });

  return { organizationId: organization.id, siteId: site.id, userId: user.id, agentId: agent.id };
}

async function main() {
  for (const plan of PLANS) {
    await upsertPlan(plan);
  }

  const atelier = await seedTenant({
    orgName: "Atelier Noir",
    siteName: "Atelier Noir",
    instanceId: "demo-instance-atelier-noir",
    wixSiteId: "demo-site-atelier",
    url: "https://atelier-noir.example",
    email: "owner@atelier-noir.example",
    ownerName: "Camille Laurent",
    industry: "Fashion",
    businessType: "Online fashion store",
    installedApps: ["Stores", "Blog"],
    stores: true,
  });

  const harbor = await seedTenant({
    orgName: "Harbor Dental",
    siteName: "Harbor Dental",
    instanceId: "demo-instance-harbor-dental",
    wixSiteId: "demo-site-harbor",
    url: "https://harbor-dental.example",
    email: "hello@harbor-dental.example",
    ownerName: "Dr. Elena Park",
    industry: "Healthcare",
    businessType: "Dental clinic",
    installedApps: ["Bookings"],
    stores: false,
    planKey: "STARTER",
  });

  await seedTenant({
    orgName: "Lumen Studio",
    siteName: "Lumen Studio",
    instanceId: "demo-instance-lumen-studio",
    wixSiteId: "demo-site-lumen",
    url: "https://lumen-studio.example",
    email: "hi@lumen-studio.example",
    ownerName: "Asha Patel",
    industry: "Design",
    businessType: "Studio",
    installedApps: ["Blog"],
    stores: false,
    planKey: "FREE",
    isFree: true,
    status: "NONE",
  });

  await seedTenant({
    orgName: "Northwind Outfitters",
    siteName: "Northwind Outfitters",
    instanceId: "demo-instance-northwind",
    wixSiteId: "demo-site-northwind",
    url: "https://northwind.example",
    email: "ops@northwind.example",
    ownerName: "Sam Wright",
    industry: "Outdoor",
    businessType: "Online store",
    installedApps: ["Stores"],
    stores: true,
    planKey: "GROWTH",
    cancelAtPeriodEnd: true,
    status: "CANCELED",
  });

  await prisma.platformAdmin.upsert({
    where: { email: "owner@tidyagent.local" },
    update: { role: "SUPER" },
    create: { email: "owner@tidyagent.local", name: "Platform owner", role: "SUPER" },
  });

  await prisma.knowledgeDocument.createMany({
    data: [
      {
        organizationId: atelier.organizationId,
        siteId: atelier.siteId,
        title: "Shipping policy",
        contentType: "POLICY",
        sourceUrl: "https://atelier-noir.example/shipping",
        cleanedContent: "Free shipping on orders over $75 within the US. International shipping starts at $18.",
      },
      {
        organizationId: atelier.organizationId,
        siteId: atelier.siteId,
        title: "Silk shirt",
        contentType: "PRODUCT",
        sourceUrl: "https://atelier-noir.example/products/silk-shirt",
        cleanedContent: "The Noir silk shirt is $128. Available in black, ivory, and moss.",
      },
      {
        organizationId: harbor.organizationId,
        siteId: harbor.siteId,
        title: "Cleaning prices",
        contentType: "POLICY",
        sourceUrl: "https://harbor-dental.example/pricing",
        cleanedContent: "Harbor Dental does not publish cleaning prices online. Staff confirm fees during booking.",
      },
    ],
  });

  const atelierDocs = await prisma.knowledgeDocument.findMany({
    where: { organizationId: atelier.organizationId },
  });
  const harborDocs = await prisma.knowledgeDocument.findMany({
    where: { organizationId: harbor.organizationId },
  });

  await prisma.knowledgeChunk.createMany({
    data: atelierDocs.map((doc) => ({
      organizationId: atelier.organizationId,
      siteId: atelier.siteId,
      documentId: doc.id,
      content: doc.cleanedContent ?? doc.title,
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      contentType: doc.contentType,
    })),
  });

  await prisma.knowledgeChunk.createMany({
    data: harborDocs.map((doc) => ({
      organizationId: harbor.organizationId,
      siteId: harbor.siteId,
      documentId: doc.id,
      content: doc.cleanedContent ?? doc.title,
      title: doc.title,
      sourceUrl: doc.sourceUrl,
      contentType: doc.contentType,
    })),
  });

  await prisma.customer.create({
    data: {
      organizationId: atelier.organizationId,
      siteId: atelier.siteId,
      name: "Jordan Miles",
      email: "jordan@example.com",
    },
  });

  const jordan = await prisma.customer.findFirstOrThrow({
    where: { organizationId: atelier.organizationId, email: "jordan@example.com" },
  });

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: atelier.organizationId,
      siteId: atelier.siteId,
      customerId: jordan.id,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });

  await prisma.message.createMany({
    data: [
      {
        organizationId: atelier.organizationId,
        conversationId: conversation.id,
        role: "CUSTOMER",
        content: "Do you have a black silk shirt under $150?",
      },
      {
        organizationId: atelier.organizationId,
        conversationId: conversation.id,
        role: "AGENT",
        content: "Yes — the Noir silk shirt is $128 in black, ivory, and moss.",
        confidence: 0.92,
      },
    ],
  });

  await prisma.improvementSuggestion.create({
    data: {
      organizationId: atelier.organizationId,
      topic: "Delivery areas",
      question: "Do you deliver to my area?",
      occurrences: 8,
    },
  });

  await prisma.analyticsEvent.create({
    data: {
      organizationId: atelier.organizationId,
      siteId: atelier.siteId,
      type: "lead_created",
      payload: { source: "widget" },
    },
  });

  console.log("Seeded tenants:");
  console.log("  A", atelier);
  console.log("  B", harbor);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
