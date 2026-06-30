import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { descriptions, taskTitles } = await request.json()

    // Need at least one description to analyze
    const texts = [
      ...(descriptions || []),
      ...(taskTitles || []),
    ].filter(Boolean)

    if (texts.length === 0) {
      return Response.json({
        stressScore: 3,
        signals: [],
        recommendation: "Not enough data to analyze stress levels yet.",
        suggestLightTask: false,
      })
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
You are TRIAGE's Stress Tone Detector — an empathetic AI that reads the emotional subtext in how a person describes their work.

Analyze these task titles and descriptions written by a person managing their workload:

${texts.map((t, i) => `[${i + 1}] "${t}"`).join("\n")}

Evaluate the emotional and cognitive load signals:
- Urgency language ("ASAP", "urgent", "critical", "must", "immediately")
- Overwhelm language ("too much", "can't", "impossible", "drowning", "behind")
- Self-doubt language ("I don't know how", "not sure", "struggling")
- Resignation language ("skip", "give up", "whatever", "forget it")
- Negative emotions ("stressed", "anxious", "worried", "panic")
- Fragmented or incomplete descriptions (sign of cognitive overload)
- Excessive capitalization or exclamation marks

Return ONLY valid JSON, no markdown, no extra text:
{
  "stressScore": integer from 1 to 10 (1 = very calm, 10 = extreme distress),
  "signals": ["array of specific phrases or patterns you detected, 3 maximum"],
  "recommendation": "One empathetic, actionable sentence about what the person should do right now",
  "suggestLightTask": true if stressScore >= 7 else false,
  "stressLabel": "Calm" | "Elevated" | "High" | "Critical"
}

Score guide: 1-3 = Calm, 4-6 = Elevated, 7-8 = High, 9-10 = Critical
`

    const result = await model.generateContent(prompt)
    const raw = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    try {
      return Response.json(JSON.parse(raw))
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return Response.json(JSON.parse(match[0]))
      return Response.json({
        stressScore: 3,
        signals: [],
        recommendation: "Keep going — you're making progress.",
        suggestLightTask: false,
        stressLabel: "Calm",
      })
    }
  } catch (err) {
    console.error("Stress detect error:", err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}