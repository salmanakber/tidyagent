/** Visitor-facing handoff copy (safe for client + server). */
export function humanUnavailableText(humanName?: string | null) {
  const name = humanName?.trim();
  return name
    ? `${name} couldn’t join right now. You can leave a message for the team, or keep chatting with me here.`
    : "No one from the team could join right now. You can leave a message, or keep chatting with me here.";
}
