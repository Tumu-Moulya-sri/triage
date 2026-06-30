import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { title, description, estimatedHours } = await request.json()

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
You are TRIAGE's Scope Agent. A person is overwhelmed and running out of time. 
Your job is to define the Minimum Viable Deliverable (MVD) — the smallest version of their task that:
1. Still counts as "done" to whoever is waiting for it
2. Can realistically be completed in 40-60% of the original time estimate
3. Is honest about what has been simplified — not deceptive

TASK: "${title}"
DESCRIPTION: "${description || "None provided"}"
ORIGINAL ESTIMATE: ${estimatedHours || 1} hours

Return ONLY valid JSON, no markdown, no extra text:
{
  "mvd": "One sentence: what the reduced deliverable looks like",
  "newEstimate": a number in hours that is 40-60% of the original estimate,
  "whatWasRemoved": "Brief note on what you are cutting from scope",
  "deliveryNote": "One sentence the person can say to their stakeholder explaining the reduced scope honestly"
}
`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    try {
      return Response.json(JSON.parse(raw))
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return Response.json(JSON.parse(match[0]))
      return Response.json({ error: "Parse failed", raw }, { status: 500 })
    }
  } catch (err) {
    console.error("Scope route error:", err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}