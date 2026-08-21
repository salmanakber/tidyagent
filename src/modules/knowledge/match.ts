/** Generic phrase matching: "jetski" hits "Jet Ski", "e-commerce" hits "ecommerce". */

const STOP = new Set([
  "the",
  "and",
  "for",
  "you",
  "can",
  "tell",
  "list",
  "have",
  "what",
  "with",
  "this",
  "that",
  "from",
  "your",
  "our",
  "are",
  "was",
  "please",
  "need",
  "want",
  "check",
  "just",
  "how",
  "much",
]);

export function compactPhrase(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function questionTerms(text: string) {
  return unique(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s$-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !STOP.has(word)),
  );
}

export function expandTerms(terms: string[]) {
  const out: string[] = [];
  for (const term of terms) {
    out.push(term);
    const spaced = term.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
    if (spaced !== term) out.push(spaced);
    if (/ski$/.test(term) && term.length > 4) {
      out.push(term.replace(/ski$/, " ski").trim());
      out.push(`${term.replace(/ski$/, "")} ski`.trim());
    }
    if (/board$/.test(term) && term.length > 6) out.push(term.replace(/board$/, " board").trim());
    if (term.includes("-")) out.push(term.replaceAll("-", " "), term.replaceAll("-", ""));
  }
  return unique(out);
}

export function textMatchesTerms(haystack: string, terms: string[]) {
  if (!terms.length) return false;
  const hay = haystack.toLowerCase();
  const compactHay = compactPhrase(haystack);
  return terms.some((term) => {
    if (term.length < 3) return false;
    if (hay.includes(term)) return true;
    const compact = compactPhrase(term);
    return compact.length >= 4 && compactHay.includes(compact);
  });
}

export function isHandoffRequest(text: string) {
  return /(please connect|connect me|connecting me|connect with (a )?(human|person|someone)|talk to (a )?(human|person|someone)|speak (to|with) (a )?(human|person)|real person|live person|handoff|hand off|human representative|someone from the team)/i.test(
    text,
  );
}

export function isBookingRequest(text: string) {
  return /\b(book it|book this|book now|let'?s book|reserve it|i want to book|make a (booking|reservation)|schedule it)\b/i.test(
    text,
  );
}

export function isJunkBusinessName(name: string) {
  const value = name.trim();
  if (value.length < 2 || value.length > 60) return true;
  return /^(prices and offerings|verified prices|home|untitled|welcome|new site|page)$/i.test(value);
}

function unique(values: string[]) {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}
