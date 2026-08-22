import { getSetting } from "@/lib/security/settings";
import { getAppOrigin } from "@/lib/env";
import { getDisplayPricing, type DisplayPlanPrice } from "@/modules/billing/display-prices";
import { bulletsForPlanScope } from "@/modules/billing/plan-scopes";
import { getAllPlanScopes } from "@/modules/billing/plan-scope-store";

const PRODUCT = /tidy\s*agent|tidyflow(\s*app)?/i;
const FOLLOW_UP = /price|pricing|plan|cost|how much|founder|founded|found it|who (made|built|created)|why|good|benefit|feature|trial|what is it|tell me more/i;

export function isTidyAgentQuestion(current: string, priorCustomer: string[] = []) {
  const now = current.trim();
  if (PRODUCT.test(now)) return true;
  const recent = priorCustomer.slice(-3).join(" ");
  return PRODUCT.test(recent) && FOLLOW_UP.test(now);
}

export async function answerTidyAgentQuestion(question: string) {
  const [pricing, scopes, founder] = await Promise.all([
    getDisplayPricing(),
    getAllPlanScopes(),
    getSetting("product_founder"),
  ]);
  const origin = getAppOrigin();
  const plansUrl = `${origin.replace(/\/$/, "")}/pricing`;
  const who = founder.trim() || "the tidyFlow team";
  const q = question.toLowerCase();
  const wantFounder = /founder|founded|found it|who (made|built|created|started)/i.test(q);
  const wantPrice = /price|pricing|plan|cost|how much|fee|rate/i.test(q);
  const wantWhy = /why|good|benefit|feature|different/i.test(q);

  const intro = `tidyAgent is an AI employee for Wix websites. It learns from the live site, answers in the business’s own brand, and hands off to a person when it should not guess.`;
  const founderLine = `It was founded by ${who}.`;
  const why = [
    "Answers only from the connected Wix site, FAQ, and owner notes — it does not invent prices or pages.",
    "Wears the business’s colors in the chat widget, not tidyAgent branding.",
    "Can route to a real teammate with the full chat history when a human is needed.",
    "Plans are billed through Wix, so site owners stay in the App Market they already use.",
  ];

  const priceBlock = formatPlanList(pricing, scopes);
  const parts: string[] = [];

  if (wantFounder && !wantPrice && !wantWhy) {
    parts.push(`${founderLine} ${intro}`);
    parts.push("**Why it’s a good fit**", why.map((line) => `- ${line}`).join("\n"));
    parts.push("**Plans**", priceBlock);
  } else if (wantPrice && !wantFounder && !wantWhy) {
    parts.push(`Here are the current tidyAgent plans (${pricing.source === "wix" ? "from Wix App Plans" : "from platform price settings"}). Starter includes a ${pricing.trialDays}-day trial.`);
    parts.push(priceBlock);
    parts.push(`You can compare them on [this link](${plansUrl}).`);
  } else if (wantWhy && !wantFounder && !wantPrice) {
    parts.push(intro);
    parts.push("**Why it’s good**", why.map((line) => `- ${line}`).join("\n"));
    parts.push("**Plans**", priceBlock);
  } else {
    parts.push(`${intro} ${founderLine}`);
    parts.push("**Why it’s good**", why.map((line) => `- ${line}`).join("\n"));
    parts.push(`**Plans** (${pricing.trialDays}-day trial on Starter)`, priceBlock);
    parts.push(`See the full list on [this link](${plansUrl}).`);
  }

  return parts.filter(Boolean).join("\n\n");
}

function formatPlanList(
  pricing: Awaited<ReturnType<typeof getDisplayPricing>>,
  scopes: Awaited<ReturnType<typeof getAllPlanScopes>>,
) {
  return (["STARTER", "GROWTH", "PRO"] as const)
    .map((key) => {
      const plan = pricing.plans[key];
      const amount = formatAmount(plan, pricing.symbol);
      const highlights = bulletsForPlanScope(key, scopes[key])
        .filter((item) => !/7-day/i.test(item))
        .slice(0, 3)
        .join("; ");
      return `- **${plan.name}** — ${amount}${highlights ? `\n  ${highlights}` : ""}`;
    })
    .join("\n");
}

function formatAmount(plan: DisplayPlanPrice, symbol: string) {
  if (plan.monthly) {
    const monthly = looksLikeMoney(plan.monthly) ? `${symbol}${plan.monthly}` : plan.monthly;
    const yearly = plan.yearly ? (looksLikeMoney(plan.yearly) ? `${symbol}${plan.yearly}/year` : plan.yearly) : "";
    return yearly ? `${monthly}/month or ${yearly}` : `${monthly}/month`;
  }
  if (plan.yearly) {
    const yearly = looksLikeMoney(plan.yearly) ? `${symbol}${plan.yearly}` : plan.yearly;
    return `${yearly}/year`;
  }
  return "see current pricing";
}

function looksLikeMoney(value: string) {
  return /^\d+(\.\d+)?$/.test(value.trim());
}
