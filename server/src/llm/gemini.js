import axios from "axios"

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash"

export async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    const err = new Error(
      "GEMINI_API_KEY is missing. Please set it in server/.env"
    )
    err.status = 500
    throw err
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

  let res
  try {
    res = await axios.post(
      url,
      {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          // Ask Gemini to output JSON; still must validate/parse defensively.
          response_mime_type: "application/json",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        timeout: 20000,
      }
    )
  } catch (e) {
    const status = e.response?.status || 502
    const message =
      e.response?.data?.error?.message ||
      e.response?.statusText ||
      e.message ||
      "Gemini request failed"

    const err = new Error(`Gemini request failed: ${message}`)
    err.status = status
    err.details = e.response?.data || null
    throw err
  }

  const text =
    res?.data?.candidates?.[0]?.content?.parts?.map((p) => p?.text).join("") ||
    ""

  if (!text.trim()) {
    const err = new Error("Gemini returned empty response text")
    err.status = 502
    err.details = { raw: res?.data || null }
    throw err
  }

  // Gemini sometimes wraps JSON in ```json ... ``` fences; strip them safely.
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const err = new Error("Gemini returned invalid JSON (JSON.parse failed)")
    err.status = 502
    err.details = {
      preview: cleaned.slice(0, 1200),
      raw_preview: text.slice(0, 1200),
    }
    throw err
  }
}
