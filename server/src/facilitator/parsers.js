/**
 * Extract user objects from a users_info string.
 * Expected to contain at least:
 * - Profile ID: ...
 * - User Name: ... (or Name:)
 *
 * We keep this tolerant because the payload is a free-form string.
 */
export function extractUsersFromUsersInfo(usersInfoRaw) {
  const raw = String(usersInfoRaw || "");

  const profileIds = [...raw.matchAll(/Profile\s*ID\s*:\s*([^\n\r]+)/gi)].map((m) => m[1].trim());
  const names = [
    ...raw.matchAll(/User\s*Name\s*:\s*([^\n\r]+)/gi),
    ...raw.matchAll(/Name\s*:\s*([^\n\r]+)/gi),
  ].map((m) => m[1].trim());

  const users = [];

  // Prefer pairing by order: first ID with first name, etc.
  const n = Math.max(profileIds.length, names.length, 2);
  for (let i = 0; i < n; i++) {
    if (i >= 2) break; // spec: two users
    users.push({
      profileId: profileIds[i] ?? `user_${i + 1}`,
      name: names[i] ?? `User ${i + 1}`,
    });
  }

  return users;
}

/**
 * Parse conversation string into messages.
 * Supported formats:
 * - "Alice: hello"
 * - "AI(to both): hello"
 * - "AI(to Alice): hello"
 *
 * Returns array: [{speaker, text}]
 */
export function parseConversation(conversationRaw) {
  const raw = String(conversationRaw || "");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const messages = [];
  for (const line of lines) {
    const idx = line.indexOf(":");
    if (idx === -1) {
      // Unknown format; attach to last speaker
      if (messages.length) {
        messages[messages.length - 1].text += `\n${line}`;
      } else {
        messages.push({ speaker: "", text: line });
      }
      continue;
    }

    const speaker = line.slice(0, idx).trim();
    const text = line.slice(idx + 1).trim();
    messages.push({ speaker, text });
  }

  return messages;
}
