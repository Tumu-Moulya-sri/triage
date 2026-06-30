import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function POST(request) {
  try {
    const { task, reason, toEmail, relationshipType, proposedDeadline } = await request.json()

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

    const prompt = `
You are TRIAGE's Negotiation Agent. Draft a professional email for this situation.

TASK: "${task.title}"
ORIGINAL DEADLINE: ${task.deadline ? new Date(task.deadline).toLocaleString() : "Not specified"}
RELATIONSHIP TYPE: ${relationshipType} (this affects tone)
WHY THEY CANNOT DELIVER ON TIME: "${reason}"
WHAT THEY CAN DELIVER INSTEAD: "${task.minimumViableVersion || "A reduced version of the original deliverable"}"
PROPOSED NEW DEADLINE: ${proposedDeadline || "24 hours from now"}

TONE GUIDE BY RELATIONSHIP:
- client: Professional, confident, solution-focused. No excessive apologies.
- manager: Direct, accountable, propose solution immediately.
- teammate: Warm, collaborative, offer to sync up.
- professor: Respectful, formal, mention specific circumstances briefly.

RULES:
1. Maximum 3 paragraphs
2. Do NOT start with "I apologize" or "I'm sorry"  
3. DO acknowledge the situation briefly in one sentence
4. DO propose the specific alternative and new date immediately
5. End with a clear call to action: "Please let me know if this works."
6. Maintain credibility — be honest but professional
7. Subject line should be specific, not generic

Return ONLY valid JSON, no markdown:
{
  "subject": "specific subject line",
  "body": "the full email body with paragraphs separated by \\n\\n",
  "tone": "brief note on the tone used"
}
`

    const result = await model.generateContent(prompt)
    const raw = result.response.text()
      .replace(/```json\n?/g, "").replace(/```\n?/g, "").trim()

    try {
      return Response.json(JSON.parse(raw))
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) return Response.json(JSON.parse(match[0]))
      return Response.json({ error: "Parse failed", raw }, { status: 500 })
    }
  } catch (err) {
    console.error("Draft email error:", err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}