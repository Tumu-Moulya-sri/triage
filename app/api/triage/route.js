//triage/route.js code

import { GoogleGenerativeAI } from "@google/generative-ai"
import { preprocessTasks } from "../../../lib/taskPreprocessor"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ─────────────────────────────────────────────────────────────────────────────
// BUILD GEMINI PAYLOAD
// This is what Gemini actually sees — enriched, pre-computed, no raw dates
// ─────────────────────────────────────────────────────────────────────────────
function buildGeminiPayload(preprocessedTasks) {
  return preprocessedTasks.map(task => ({
    id:           task.id,
    title:        task.title,
    description:  task.description,
    consequence:  task.consequence,
    importance:   `${task.importance}/5`,

    // All time math already done — Gemini reads, does not compute
    time_analysis: {
      remaining_hours:            task.computed.remainingHours,
      estimated_hours:            task.estimatedHours,
      buffer_hours:               task.computed.bufferHours,
      safety_margin_hours:        task.computed.safetyMarginHours,
      is_past_due:                task.computed.isPastDue,
      has_deadline:               task.computed.hasDeadline,
      deadline_proximity:         task.computed.deadlineProximity,
      buffer_risk:                task.computed.bufferRisk,
      deadline_formatted:         task.computed.deadlineFormatted,
      recommended_start:          task.computed.recommendedStartFormatted,
      latest_safe_start:          task.computed.latestSafeStartFormatted,
    },

    // Gemini's job: validate this, not re-derive it
    deterministic_decision: {
      suggested_classification:  task.computed.suggestedClassification,
      urgency_score:             task.computed.urgencyScore,
      classification_locked:     task.computed.classificationLocked,
      lock_reason:               task.computed.classificationLocked
        ? task.computed.classificationRule
        : null,
    },
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// THE PROMPT
// Gemini's role: human reasoning and domain judgment only
// All arithmetic has already been done
// ─────────────────────────────────────────────────────────────────────────────
function buildPrompt(geminiPayload) {
  return `
You are TRIAGE — a senior productivity intelligence system combining the judgment of:
- An emergency response coordinator (prioritizes survival, not comfort)
- An experienced project manager (understands real delivery constraints)
- A burnout-aware academic advisor (knows when to protect cognitive load)

═══════════════════════════════════════════════════════════════
YOUR ROLE IN THIS SYSTEM
═══════════════════════════════════════════════════════════════

A JavaScript engine has already completed ALL time arithmetic.
You have received pre-computed facts. Your responsibility is NOT to calculate.
Your responsibility is to REASON, JUDGE, and EXPLAIN like a human expert would.

You will:
1. Receive tasks with pre-computed time analysis
2. Validate or (rarely) override the suggested classification
3. Write clear human reasoning that explains the situation
4. Suggest the minimum viable deliverable

═══════════════════════════════════════════════════════════════
CLASSIFICATION DEFINITIONS
═══════════════════════════════════════════════════════════════

DO_NOW
→ Requires attention today, before other tasks
→ Missing this deadline causes real external harm
→ Time pressure is genuine and imminent

DEFER
→ Should be done soon but not right now
→ Has enough buffer to be postponed until later today or tomorrow
→ No immediate harm from a few hours delay

SCHEDULE
→ Has a future deadline with ample time
→ Needs a specific time slot assigned in the calendar
→ No action needed today

DELEGATE
→ Can be completed by another person, tool, or automated system
→ Does not require this person's specific expertise or authority
→ Delegating would save meaningful time

ELIMINATE
→ Provides negligible value relative to the effort required
→ The consequence of skipping is acceptable
→ Or the task is already done, invalid, or irrelevant

═══════════════════════════════════════════════════════════════
CLASSIFICATION RULES — READ CAREFULLY
═══════════════════════════════════════════════════════════════

LOCKED classifications (classification_locked: true)
→ You MUST return this classification unchanged
→ These are enforced by hard time rules: past due, physically impossible, or imminent
→ You may still write reasoning and MVD

UNLOCKED classifications (classification_locked: false)
→ You may override ONLY if the task description reveals a strong domain reason
→ Valid override reasons: task already completed, genuinely eliminatable, clearly delegatable
→ Invalid override reasons: your personal preference, vague feelings, uncertainty

Override policy: override maximum 1 step in either direction.
If suggested is DEFER, you may return DO_NOW or SCHEDULE — not ELIMINATE.
If suggested is DO_NOW and unlocked, you may return DEFER — nothing further.

═══════════════════════════════════════════════════════════════
DEADLINE PROXIMITY GUIDE (pre-computed, for your reference)
═══════════════════════════════════════════════════════════════

PAST_DUE      → Deadline has already passed
IMMINENT      → Less than 6 hours remaining
TODAY         → 6 to 24 hours remaining
TOMORROW      → 24 to 48 hours remaining
IN_3_DAYS     → 48 to 72 hours remaining
THIS_WEEK     → 3 to 7 days remaining
NEXT_2_WEEKS  → 1 to 2 weeks remaining
THIS_MONTH    → 2 to 4 weeks remaining
DISTANT_FUTURE→ More than 1 month remaining
NO_DEADLINE   → No deadline set

═══════════════════════════════════════════════════════════════
BUFFER RISK GUIDE (pre-computed, for your reference)
═══════════════════════════════════════════════════════════════

IMPOSSIBLE      → Buffer is negative — cannot finish even if starting now
CRITICAL_RISK   → Buffer < 2 hours — any interruption causes failure
HIGH_RISK       → Buffer 2–4 hours — very tight
MODERATE_RISK   → Buffer 4–8 hours — manageable with focus
COMFORTABLE     → Buffer 8–24 hours — good working room
SPACIOUS        → Buffer > 24 hours — no urgency from time pressure

═══════════════════════════════════════════════════════════════
REASONING GUIDELINES
═══════════════════════════════════════════════════════════════

Write 2–3 sentences maximum.
Reference the actual numbers provided to you (remaining hours, buffer hours).
Explain the RISK, not just the schedule.
Sound like a senior PM advising a colleague, not a robot reciting rules.

Bad reasoning: "Deadline is today."
Good reasoning: "With only 3.5 hours remaining and an estimated 2-hour task, there is a 1.5-hour buffer — enough for one interruption but no more. The consequence field indicates client delivery, making this genuinely time-sensitive. Starting now with a clear scope is recommended."

═══════════════════════════════════════════════════════════════
MINIMUM VIABLE DELIVERABLE (MVD)
═══════════════════════════════════════════════════════════════

For every task, define the smallest version that still satisfies the objective.
Be specific and actionable. Think about what "counts as done" to whoever is waiting.
This is especially important for DO_NOW and DEFER tasks.

═══════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════

Return ONLY a raw JSON array.
No markdown. No code fences. No explanations outside the JSON.
One object per task, in the same order as the input.

Required fields for every task:

{
  "id": "task id from input",
  "title": "task title",
  "classification": "DO_NOW | DEFER | SCHEDULE | DELEGATE | ELIMINATE",
  "urgencyScore": number (use the pre-computed value — do NOT change it),
  "classificationChanged": boolean (true only if you overrode the suggestion),
  "changeReason": "one sentence if changed, else null",
  "reason": "2–3 sentence human reasoning",
  "minimumViableVersion": "specific actionable MVD"
}

═══════════════════════════════════════════════════════════════
TASKS TO PROCESS
═══════════════════════════════════════════════════════════════

${JSON.stringify(geminiPayload, null, 2)}
`
}

// ─────────────────────────────────────────────────────────────────────────────
// MERGE — combine Gemini reasoning with JS-computed values into final output
// Gemini's urgencyScore is ignored — we keep the deterministic one
// ─────────────────────────────────────────────────────────────────────────────
function mergeResults(preprocessedTasks, geminiResults) {
  return preprocessedTasks.map((task, index) => {
    const gemini = geminiResults[index] || {}

    // Enforce locked classifications — Gemini cannot override these
    const finalClassification = task.computed.classificationLocked
      ? task.computed.suggestedClassification
      : (gemini.classification || task.computed.suggestedClassification)

    return {
      // Identity
      id:              task.id,
      title:           task.title,

      // Final decision
      classification:  finalClassification,
      urgencyScore:    task.computed.urgencyScore,  // Always JS-computed

      // Timestamps (pre-computed, formatted)
      recommendedStartTime:  task.computed.recommendedStartFormatted,
      latestSafeStartTime:   task.computed.latestSafeStartFormatted,

      // Time facts
      remainingHours:  task.computed.remainingHours,
      bufferHours:     task.computed.bufferHours,
      deadlineProximity: task.computed.deadlineProximity,
      bufferRisk:      task.computed.bufferRisk,
      isPastDue:       task.computed.isPastDue,

      // Gemini's contribution
      reason:                gemini.reason || "No reasoning provided.",
      minimumViableVersion:  gemini.minimumViableVersion || null,
      classificationChanged: task.computed.classificationLocked
        ? false
        : (gemini.classificationChanged || false),
      changeReason:          task.computed.classificationLocked
        ? null
        : (gemini.changeReason || null),

      // Debug/audit trail (remove in production if needed)
      _debug: {
        suggestedClassification: task.computed.suggestedClassification,
        classificationLocked:    task.computed.classificationLocked,
        classificationRule:      task.computed.classificationRule,
      },
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// API ROUTE HANDLER
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const { tasks: rawTasks } = await req.json()

    if (!rawTasks || rawTasks.length === 0) {
      return Response.json({ success: true, tasks: [] })
    }

    // ── Step 1: JavaScript computes everything deterministic ─────────────────
    const preprocessed = preprocessTasks(rawTasks)

    // ── Step 2: Build what Gemini actually sees ──────────────────────────────
    const geminiPayload = buildGeminiPayload(preprocessed)
    const prompt = buildPrompt(geminiPayload)

    // ── Step 3: Gemini reasons, never calculates ─────────────────────────────
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.2,       // Low temperature = consistent, not creative
        topP: 0.8,
        topK: 20,
        responseMimeType: "application/json",  // Forces valid JSON output
      },
    })

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()

    // ── Step 4: Parse Gemini response ────────────────────────────────────────
    let geminiResults
    try {
      geminiResults = JSON.parse(raw)
    } catch {
      // Try to extract JSON array if Gemini added any surrounding text
      const match = raw.match(/\[[\s\S]*\]/)
      if (!match) {
        throw new Error(`Gemini returned unparseable response: ${raw.slice(0, 200)}`)
      }
      geminiResults = JSON.parse(match[0])
    }

    // Ensure it is an array
    if (!Array.isArray(geminiResults)) {
      geminiResults = geminiResults.tasks || geminiResults.result || []
    }

    // ── Step 5: Merge — JS values override Gemini values for math fields ─────
    const finalTasks = mergeResults(preprocessed, geminiResults)

    return Response.json({ success: true, tasks: finalTasks })

  } catch (err) {
    console.error("[TRIAGE API Error]", err)
    return Response.json({
      success: false,
      error: err.message,
    }, { status: 500 })
  }
}