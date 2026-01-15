import { extractUsersFromUsersInfo, parseConversation } from "./parsers.js";

/**
 * Endpoint 1 logic:
 * - Receives users_info string containing both user profiles
 * - Returns initial AI message for each user with "target" = profile_id
 */
export function initiateConversation(usersInfoRaw) {
  const users = extractUsersFromUsersInfo(usersInfoRaw);

  // Fallback if parsing fails
  const u1 = users[0] ?? { profileId: "user_1", name: "User 1" };
  const u2 = users[1] ?? { profileId: "user_2", name: "User 2" };

  const msg1 = buildKickoffMessage(u1, u2, /*toward=*/u1);
  const msg2 = buildKickoffMessage(u1, u2, /*toward=*/u2);

  return {
    ai_messages: [
      { ai_message: msg1, target: u1.profileId },
      { ai_message: msg2, target: u2.profileId },
    ],
  };
}

/**
 * Endpoint 2 logic:
 * - Receives users_info string + full conversation string
 * - Returns should_intervene + urgency + optional ai_message {ai_message, target}
 *
 * Notes:
 * - This ships with a rule-based decision engine (no external AI dependency).
 * - You can replace `decideIntervention()` with an LLM call later.
 */
export function facilitateConversation(usersInfoRaw, conversationRaw) {
  const users = extractUsersFromUsersInfo(usersInfoRaw);
  const u1 = users[0] ?? { profileId: "user_1", name: "User 1" };
  const u2 = users[1] ?? { profileId: "user_2", name: "User 2" };

  const convo = parseConversation(conversationRaw);

  const decision = decideIntervention({ u1, u2, convo, conversationRaw });

  if (!decision.shouldIntervene) {
    return {
      should_intervene: false,
      urgency: "none",
      ai_message: null,
    };
  }

  return {
    should_intervene: true,
    urgency: decision.urgency,
    ai_message: {
      ai_message: decision.message,
      target: decision.targetProfileId,
    },
  };
}

/* -------------------- Helpers -------------------- */

function buildKickoffMessage(u1, u2, toward) {
  const other = toward.profileId === u1.profileId ? u2 : u1;
  const towardName = toward.name || "there";
  const otherName = other.name || "the other participant";

  return [
    `Hi ${towardName}! I'm your AI Facilitator for this discussion with ${otherName}.`,
    `To get started:`,
    `1) What outcome do you want from this chat (e.g., decision, alignment, next steps)?`,
    `2) What's one key constraint (time, budget, scope) we should keep in mind?`,
    `Reply with short bullets and I'll help keep the conversation focused.`,
  ].join("\n");
}

/**
 * Very lightweight heuristics:
 * - High: "no topic", "stuck", conflict/negative words, or repeated one-word replies
 * - Low: participation imbalance (one user quiet for last few turns)
 * - None: active Q&A or steady back-and-forth
 */
function decideIntervention({ u1, u2, convo, conversationRaw }) {
  const text = (conversationRaw || "").toLowerCase();

  const highTriggers = [
    "no topic",
    "don't have any topic",
    "dont have any topic",
    "not sure what to discuss",
    "no idea",
    "stuck",
    "confused",
    "frustrated",
    "angry",
    "argument",
    "disagree",
    "waste of time",
  ];

  if (highTriggers.some((k) => text.includes(k))) {
    const target = pickQuietUser(u1, u2, convo);
    return {
      shouldIntervene: true,
      urgency: "high",
      targetProfileId: target.profileId,
      message: buildHighUrgencyPrompt(u1, u2, target),
    };
  }

  // If last non-AI message ends with a question mark, let them continue
  const lastHuman = [...convo].reverse().find((m) => !isAiSpeaker(m.speaker));
  if (lastHuman && /\?\s*$/.test(lastHuman.text.trim())) {
    return { shouldIntervene: false };
  }

  // Participation imbalance over last 6 human turns
  const lastHumanTurns = convo.filter((m) => !isAiSpeaker(m.speaker)).slice(-6);
  const counts = countBySpeaker(lastHumanTurns);
  const c1 = counts.get(u1.name) ?? 0;
  const c2 = counts.get(u2.name) ?? 0;

  // If we couldn't match by names, do a weaker heuristic by last speaker
  const imbalance = Math.abs(c1 - c2);

  if (imbalance >= 3) {
    const target = c1 < c2 ? u1 : u2;
    return {
      shouldIntervene: true,
      urgency: "low",
      targetProfileId: target.profileId,
      message: buildLowUrgencyNudge(target),
    };
  }

  // Short / low-content conversation => light prompt
  if (lastHumanTurns.length > 0) {
    const recentTexts = lastHumanTurns.map((m) => m.text.trim());
    const oneWordish = recentTexts.filter((t) => t.split(/\s+/).length <= 2).length;
    if (oneWordish >= 4) {
      const target = pickQuietUser(u1, u2, convo);
      return {
        shouldIntervene: true,
        urgency: "low",
        targetProfileId: target.profileId,
        message: [
          `Quick nudge: could you add a bit more context?`,
          `A helpful format: Goal → Constraints → Options → Next step.`,
          `What's the most important decision you want to make today?`,
        ].join("\n"),
      };
    }
  }

  return { shouldIntervene: false };
}

function buildHighUrgencyPrompt(u1, u2, target) {
  const other = target.profileId === u1.profileId ? u2 : u1;
  return [
    `It sounds like the conversation may be stuck. Let's reset quickly.`,
    `Could you share:`,
    `1) Your main goal for this discussion (1 sentence)`,
    `2) One thing you need from ${other.name || "the other person"} today`,
    `3) A proposal or option you want to explore`,
    `Then I'll suggest a clear next step and questions for both of you.`,
  ].join("\n");
}

function buildLowUrgencyNudge(target) {
  return [
    `I'd love to hear your perspective, ${target.name || ""}.`,
    `What matters most to you here, and what would a good outcome look like?`,
  ].join("\n");
}

function pickQuietUser(u1, u2, convo) {
  const human = convo.filter((m) => !isAiSpeaker(m.speaker));
  const counts = countBySpeaker(human);
  const c1 = counts.get(u1.name) ?? 0;
  const c2 = counts.get(u2.name) ?? 0;

  if (c1 === c2) {
    // pick the user who hasn't spoken most recently
    const last = [...human].reverse().find((m) => m.speaker);
    if (!last) return u1;
    return last.speaker === u1.name ? u2 : u1;
  }
  return c1 < c2 ? u1 : u2;
}

function countBySpeaker(items) {
  const map = new Map();
  for (const m of items) {
    const k = m.speaker;
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function isAiSpeaker(speaker) {
  if (!speaker) return false;
  const s = speaker.toLowerCase();
  return s === "ai" || s.startsWith("ai(") || s.includes("ai to");
}
