import { Router } from "express"
import { z } from "zod"
import { callGemini } from "../llm/gemini.js"

export const apiRouter = Router()

// ----------------------
// Validation Schemas
// ----------------------
const initiateSchema = z.object({
  users_info: z.string().min(1, "users_info is required (string)"),
})

const facilitateSchema = z.object({
  users_info: z.string().min(1, "users_info is required (string)"),
  conversation: z.string().min(1, "conversation is required (string)"),
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
Decide if the AI should intervene to help the conversation.
Intervene ONLY when helpful, e.g.:
- conversation stalls / no topic / awkward silence
- one user dominates / the other disengages
- they are stuck, confused, or need structure
- the talk becomes unproductive or off-track

OUTPUT RULES:
- should_intervene: boolean
- urgency: "high" | "low" | "none"
  - "high": should show message in chat now
  - "low": optional (nice-to-have)
  - "none": no message should be shown
- If should_intervene is false, set urgency = "none" and ai_message = null.
- If should_intervene is true, include ai_message with:
  - ai_message: 1–2 sentences max, plus ONE probing question
  - target: a profile id from users_info (pick who should receive it)

Return ONLY valid JSON in this exact format:

{
  "should_intervene": true|false,
  "urgency": "high"|"low"|"none",
  "ai_message": { "ai_message": "...", "target": "PROFILE_ID" } | null
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
          details: parsed.error.flatten(),
        },
      })
    }

    const prompt = buildInitiatePrompt(parsed.data.users_info)
    const result = await callGemini(prompt)

    // Optional: minimal shape enforcement (avoid frontend crash if Gemini returns wrong keys)
    if (!result || !Array.isArray(result.ai_messages)) {
      return res.status(502).json({
        error: {
          message: "Gemini returned unexpected response shape",
          details: result,
        },
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
          details: parsed.error.flatten(),
        },
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
          details: result,
        },
      })
    }

    return res.json({ data: result })
  } catch (err) {
    return next(err)
  }
})
