const BARE_URL = /https?:\/\/[^\s)<>"']+|www\.[^\s)<>"']+/gi;
const MARKDOWN_LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi;

export function looksLikeUrl(value: string) {
  return /https?:\/\/|www\.|\.[a-z]{2,}(\/|$)/i.test(value.trim());
}

export function linkLabel(href: string, preferred?: string) {
  const label = preferred?.trim();
  if (label && !looksLikeUrl(label) && label.length <= 48) return label;
  try {
    const url = new URL(href.startsWith("http") ? href : `https://${href}`);
    const hay = `${url.hostname} ${url.pathname} ${url.search}`.toLowerCase();
    if (/book|reserv|appoint|schedule|subscriber/.test(hay)) return "book here";
    if (/pric|rate|package|offer/.test(hay)) return "see prices";
    if (/contact/.test(hay)) return "contact us";
    if (/about/.test(hay)) return "about page";
    if (/product|store|shop|catalog|menu/.test(hay)) return "view this";
    return "this link";
  } catch {
    return "this link";
  }
}

export function rewriteChatLinks(text: string) {
  const placeholders: string[] = [];
  let next = text.replace(MARKDOWN_LINK, (_, label: string, url: string) => {
    const token = `%%LINK${placeholders.length}%%`;
    placeholders.push(`[${linkLabel(url, label)}](${cleanHref(url)})`);
    return token;
  });

  next = next.replace(BARE_URL, (raw) => {
    const href = cleanHref(raw.startsWith("www.") ? `https://${raw}` : raw);
    const token = `%%LINK${placeholders.length}%%`;
    placeholders.push(`[${linkLabel(href)}](${href})`);
    return token;
  });

  next = next
    .replace(
      /\b(?:visit|see|open|go to|check(?: out)?)\s+(?:our\s+)?(?:booking page|website|site|page)?\s*(?:online\s*)?(?:at|:)?\s*(%%LINK\d+%%)/gi,
      "$1",
    )
    .replace(/\s+(?:at|here)\s*[:.]?\s*(%%LINK\d+%%)/gi, " $1")
    .replace(/\s{2,}/g, " ");

  return placeholders.reduce((value, link, index) => value.replace(`%%LINK${index}%%`, link), next);
}

export function visibleChatText(text: string) {
  return rewriteChatLinks(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
}

function cleanHref(value: string) {
  return value.replace(/[.,;:!?]+$/g, "");
}
