import { Router } from "express"
import { z } from "zod"
import { callGemini } from "../llm/gemini.js"

export const apiRouter = Router()

// ----------------------
// Validation Schemas
// ----------------------
const initiateSchema = z.object({
  users_info: z.string().min(1, "users_info is required (string)")
})

const facilitateSchema = z.object({
  users_info: z.string().min(1, "users_info is required (string)"),
  conversation: z.string().min(1, "conversation is required (string)")
})

// ----------------------
// Helpers
// ----------------------
function buildInitiatePrompt(users_info) {
  return `
You are an AI facilitator helping two users start a meaningful business discussion.

INPUT (users_info as raw text):
${users_info}

TASK:
Generate two short kickoff messages: one targeted to User 1 and one targeted to User 2.
- Keep it friendly, professional, and relevant to their bios/interests.
- Each message should be 1–2 sentences.
- Ask ONE concrete question to move the conversation forward.
- The "target" MUST be the profile id of that user (as seen in users_info).

OUTPUT:
Return ONLY valid JSON in this exact format:

{
  "ai_messages": [
    { "ai_message": "...", "target": "PROFILE_ID_1" },
    { "ai_message": "...", "target": "PROFILE_ID_2" }
  ]
}
`.trim()
}

function buildFacilitatePrompt(users_info, conversation) {
  return `
You are an AI conversation facilitator for a business discussion between two users.

INPUT (users_info as raw text):
${users_info}

INPUT (conversation as raw text, chronological):
${conversation}

TASK:
Decide whether the AI should intervene to help the conversation.

Intervene ONLY when helpful, for example when:
- the conversation stalls or both say they have no topic / no idea
- one user is confused or disengaged
- the discussion lacks direction or structure
- the conversation becomes unproductive or off-track

TARGETING RULE (IMPORTANT):
- First, determine which user is currently asking for help or is most clearly stuck based on the MOST RECENT messages
  (e.g. "help", "please help", "i don't know what to say", "no topic", "no idea").
- If ONLY ONE user shows these "needs help" signals, you MUST target that user (do NOT target the other user).
- Only generate messages for BOTH users when BOTH users show clear "needs help" signals in the conversation.

DECIDE WHO NEEDS HELP:
- If NEITHER user needs help → no intervention.
- If ONLY ONE user needs help → generate ONE message targeted to that user.
- If BOTH users need help → generate TWO messages, one for each user.

OUTPUT RULES:
- should_intervene: boolean
- urgency: "high" | "low" | "none"
  - "high": must show message(s) in the chat now
  - "low": optional / supportive suggestion
  - "none": no AI message should be shown
- If should_intervene is false:
  - urgency MUST be "none"
  - ai_messages MUST be an empty array []
- If should_intervene is true:
  - urgency MUST be "high" or "low"
  - ai_messages MUST contain 1 or 2 items
  - Each item MUST have:
    - ai_message: 1–2 sentences, professional and friendly, with ONE probing question
    - target: a profile ID taken from users_info
    - target MUST be the user who needs help (based on the TARGETING RULE above)

Return ONLY valid JSON in this exact format (no extra text, no markdown):

{
  "should_intervene": true|false,
  "urgency": "high"|"low"|"none",
  "ai_messages": [
    { "ai_message": "...", "target": "PROFILE_ID" }
  ]
}
`.trim()
}

// ----------------------
// POST /api/initiate-conversation
// ----------------------
apiRouter.post("/initiate-conversation", async (req, res, next) => {
  try {
    const parsed = initiateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: "Invalid request body",
          details: parsed.error.flatten()
        }
      })
    }

    const prompt = buildInitiatePrompt(parsed.data.users_info)
    const result = await callGemini(prompt)

    // Optional: minimal shape enforcement (avoid frontend crash if Gemini returns wrong keys)
    if (!result || !Array.isArray(result.ai_messages)) {
      return res.status(502).json({
        error: {
          message: "Gemini returned unexpected response shape",
          details: result
        }
      })
    }

    return res.json({ data: result })
  } catch (err) {
    return next(err)
  }
})

// ----------------------
// POST /api/facilitate-conversation
// ----------------------
apiRouter.post("/facilitate-conversation", async (req, res, next) => {
  try {
    const parsed = facilitateSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          message: "Invalid request body",
          details: parsed.error.flatten()
        }
      })
    }

    const prompt = buildFacilitatePrompt(
      parsed.data.users_info,
      parsed.data.conversation
    )

    const result = await callGemini(prompt)

    // Optional: minimal shape enforcement
    const validUrgency =
      result?.urgency === "high" ||
      result?.urgency === "low" ||
      result?.urgency === "none"

    if (typeof result?.should_intervene !== "boolean" || !validUrgency) {
      return res.status(502).json({
        error: {
          message: "Gemini returned unexpected response shape",
          details: result
        }
      })
    }

    return res.json({ data: result })
  } catch (err) {
    return next(err)
  }
})
