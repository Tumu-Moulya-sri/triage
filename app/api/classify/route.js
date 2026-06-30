import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { tasks } = await request.json()

    if (!tasks || tasks.length === 0) {
      return Response.json({ classifications: [] })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })
    const now = new Date()

    // Enrich each task with hours-until-deadline so Gemini can reason about urgency
    const enriched = tasks.map((t) => {
      const hoursLeft =
        t.deadline
          ? Math.max(0, (new Date(t.deadline) - now) / (1000 * 60 * 60))
          : null
      return {
        ...t,
        hoursUntilDeadline: hoursLeft !== null ? parseFloat(hoursLeft.toFixed(1)) : null,
      }
    })

    const prompt = `
You are TRIAGE, an AI crisis incident commander making emergency triage decisions for a person overwhelmed with tasks.

Current time: ${now.toISOString()}

TRIAGE CLASSIFICATION RUBRIC — apply this strictly:

CRITICAL → deadline in < 6 hours, OR importance >= 4 with deadline < 24h, OR consequence involves a client/boss/public failure
SHRINKABLE → deadline in 6-72 hours but task is complex enough to deliver a reduced version; OR looks like a perfectionism trap
DELEGATABLE → task could be done by someone else OR involves waiting on others OR low importance (1-2) OR consequence only affects the user
KILLABLE → deadline already passed, OR self-imposed deadline with zero stated consequence, OR deferred 4+ times, OR importance = 1 and no external stakeholder

TASKS:
${JSON.stringify(
  enriched.map((t) => ({
    title: t.title,
    deadline: t.deadline || "no deadline",
    hoursUntilDeadline: t.hoursUntilDeadline !== null
      ? `${t.hoursUntilDeadline} hours`
      : "no deadline",
    estimatedHours: t.estimatedHours || 1,
    importance: t.importance || 3,
    consequence: t.consequence || "not stated",
    deferCount: t.deferCount || 0,
    description: t.description || "",
  })),
  null,
  2
)}

Return ONLY a valid JSON array — no markdown, no backticks, no explanation outside the JSON.
Each item must have exactly these fields:
{
  "title": "exact task title",
  "classification": "Critical" | "Shrinkable" | "Delegatable" | "Killable",
  "reason": "ONE specific sentence referencing the exact hours remaining, consequence, importance score, or deferCount that drove this decision",
  "urgencyScore": integer from 1 to 10,
  "minimumViableVersion": "For Shrinkable only: one sentence describing the smallest version that still counts as done. Set to null for all other classifications."
}
`

    const result = await model.generateContent(prompt)
    const raw = result.response.text()

    // Strip any markdown code fences Gemini sometimes adds
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    try {
      const parsed = JSON.parse(cleaned)
      return Response.json({ classifications: parsed })
    } catch {
      // Fallback: try to extract just the array from the response
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        return Response.json({ classifications: JSON.parse(arrayMatch[0]) })
      }
      console.error("Could not parse Gemini response:", raw)
      return Response.json({ error: "Parse failed", raw }, { status: 500 })
    }
  } catch (err) {
    console.error("Classify route error:", err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}