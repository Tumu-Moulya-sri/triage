/**lib/taskPreprocessor.js code
 * TRIAGE Task Preprocessor
 *
 * All arithmetic happens here, in JavaScript, deterministically.
 * Gemini receives only pre-computed facts and is asked only to reason.
 *
 * Architecture principle:
 *   Deterministic logic  → JavaScript
 *   Human reasoning      → Gemini
 *   Never cross the line.
 */

// ─────────────────────────────────────────────────────────────────────────────
// SAFETY MARGIN TABLE
// Based on task size — adds buffer to absorb interruptions and scope creep
// ─────────────────────────────────────────────────────────────────────────────
function getSafetyMarginHours(estimatedHours) {
  if (estimatedHours < 2)  return 1
  if (estimatedHours <= 5) return 3
  return 6
}

// ─────────────────────────────────────────────────────────────────────────────
// DEADLINE PROXIMITY LABEL
// Plain English category so Gemini understands the situation immediately
// ─────────────────────────────────────────────────────────────────────────────
function getDeadlineProximityLabel(remainingHours) {
  if (remainingHours === null)  return "NO_DEADLINE"
  if (remainingHours < 0)       return "PAST_DUE"
  if (remainingHours <= 6)      return "IMMINENT"        // < 6h
  if (remainingHours <= 24)     return "TODAY"           // 6–24h
  if (remainingHours <= 48)     return "TOMORROW"        // 24–48h
  if (remainingHours <= 72)     return "IN_3_DAYS"
  if (remainingHours <= 168)    return "THIS_WEEK"
  if (remainingHours <= 336)    return "NEXT_2_WEEKS"
  if (remainingHours <= 720)    return "THIS_MONTH"
  return "DISTANT_FUTURE"
}

// ─────────────────────────────────────────────────────────────────────────────
// BUFFER RISK LABEL
// Buffer = time remaining AFTER the task is complete
// Negative buffer = physically impossible to finish on time
// ─────────────────────────────────────────────────────────────────────────────
function getBufferRiskLabel(bufferHours) {
  if (bufferHours === null) return "UNKNOWN"
  if (bufferHours < 0)      return "IMPOSSIBLE"       // Cannot finish in time
  if (bufferHours < 2)      return "CRITICAL_RISK"    // Any interruption = failure
  if (bufferHours < 4)      return "HIGH_RISK"
  if (bufferHours < 8)      return "MODERATE_RISK"
  if (bufferHours < 24)     return "COMFORTABLE"
  return "SPACIOUS"
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC URGENCY SCORE (0–100)
// This value is computed by JavaScript. Gemini does NOT change it.
// It is derived from time math + importance weighting.
// ─────────────────────────────────────────────────────────────────────────────
function computeUrgencyScore(remainingHours, bufferHours, importance) {
  let base

  if (remainingHours === null) {
    // No deadline: score purely by importance
    const noDeadlineBase = { 1: 5, 2: 15, 3: 25, 4: 40, 5: 55 }
    return noDeadlineBase[importance] ?? 25
  }

  // Base score from remaining time
  if (remainingHours < 0)       base = 98
  else if (remainingHours <= 1)  base = 95
  else if (remainingHours <= 3)  base = 91
  else if (remainingHours <= 6)  base = 86
  else if (remainingHours <= 12) base = 79
  else if (remainingHours <= 24) base = 72
  else if (remainingHours <= 36) base = 64
  else if (remainingHours <= 48) base = 58
  else if (remainingHours <= 72) base = 50
  else if (remainingHours <= 120) base = 42
  else if (remainingHours <= 168) base = 35
  else if (remainingHours <= 336) base = 25
  else if (remainingHours <= 720) base = 15
  else base = 7

  // Importance adjustment: center at 3, ±8 per point
  const importanceAdj = (importance - 3) * 8

  // Buffer adjustment: negative buffer is an emergency
  let bufferAdj = 0
  if (bufferHours !== null) {
    if (bufferHours < 0)       bufferAdj = +7   // Physically impossible
    else if (bufferHours < 2)  bufferAdj = +4   // Near-impossible
    else if (bufferHours < 4)  bufferAdj = +2
    else if (bufferHours > 48) bufferAdj = -5
    else if (bufferHours > 24) bufferAdj = -3
  }

  return Math.min(100, Math.max(0, Math.round(base + importanceAdj + bufferAdj)))
}

// ─────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC CLASSIFICATION
// Hard rules that JavaScript enforces before Gemini sees anything.
// Gemini may ONLY shift classification by one level, and only if it has
// a domain-specific reason from the task description.
// ─────────────────────────────────────────────────────────────────────────────
function computeDeterministicClassification(remainingHours, bufferHours, importance) {
  // Rule 1: Past due → always DO_NOW (cannot be changed)
  if (remainingHours !== null && remainingHours < 0) {
    return { classification: "DO_NOW", locked: true, rule: "PAST_DUE" }
  }

  // Rule 2: Physically impossible to finish in time → DO_NOW, locked
  if (bufferHours !== null && bufferHours < 0) {
    return { classification: "DO_NOW", locked: true, rule: "BUFFER_NEGATIVE" }
  }

  // Rule 3: Imminent deadline with critical risk → DO_NOW, locked
  if (remainingHours !== null && remainingHours <= 6) {
    return { classification: "DO_NOW", locked: true, rule: "IMMINENT_DEADLINE" }
  }

  // Rule 4: Very high risk buffer + high importance → DO_NOW
  if (bufferHours !== null && bufferHours < 2 && importance >= 3) {
    return { classification: "DO_NOW", locked: false, rule: "LOW_BUFFER_HIGH_IMPORTANCE" }
  }

  // Rule 5: Today deadline with any buffer → DO_NOW suggested
  if (remainingHours !== null && remainingHours <= 24 && importance >= 4) {
    return { classification: "DO_NOW", locked: false, rule: "TODAY_HIGH_IMPORTANCE" }
  }

  // Rule 6: Today deadline, lower importance, comfortable buffer → DEFER
  if (remainingHours !== null && remainingHours <= 24 && bufferHours !== null && bufferHours > 4) {
    return { classification: "DEFER", locked: false, rule: "TODAY_COMFORTABLE_BUFFER" }
  }

  // Rule 7: No deadline, low importance → potential ELIMINATE
  if (remainingHours === null && importance <= 2) {
    return { classification: "ELIMINATE", locked: false, rule: "NO_DEADLINE_LOW_IMPORTANCE" }
  }

  // Rule 8: No deadline, moderate-high importance → SCHEDULE
  if (remainingHours === null) {
    return { classification: "SCHEDULE", locked: false, rule: "NO_DEADLINE" }
  }

  // Rule 9: 1–3 days with good buffer → DEFER
  if (remainingHours <= 72 && bufferHours !== null && bufferHours > 8) {
    return { classification: "DEFER", locked: false, rule: "SHORT_RANGE_GOOD_BUFFER" }
  }

  // Rule 10: More than 3 days → SCHEDULE
  if (remainingHours > 72) {
    return { classification: "SCHEDULE", locked: false, rule: "DISTANT_DEADLINE" }
  }

  // Default
  return { classification: "DEFER", locked: false, rule: "DEFAULT" }
}

// ─────────────────────────────────────────────────────────────────────────────
// ROUND to 1 decimal place for clean display
// ─────────────────────────────────────────────────────────────────────────────
function r(n) {
  return n !== null && n !== undefined ? Math.round(n * 10) / 10 : null
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PREPROCESSOR — call this on every task before sending to Gemini
// ─────────────────────────────────────────────────────────────────────────────
export function preprocessTask(rawTask, now = new Date()) {
  const estimatedHours = parseFloat(rawTask.estimatedHours) || 1
  const importance = parseInt(rawTask.importance) || 3
  const deadline = rawTask.deadline ? new Date(rawTask.deadline) : null

  // ── Time calculations ─────────────────────────────────────────────────────
  const remainingMs    = deadline ? deadline - now : null
  const remainingHours = remainingMs !== null ? remainingMs / 3_600_000 : null
  const bufferHours    = remainingHours !== null ? remainingHours - estimatedHours : null
  const safetyMargin   = getSafetyMarginHours(estimatedHours)

  // ── Key timestamps ────────────────────────────────────────────────────────
  const latestSafeStart = deadline
    ? new Date(deadline.getTime() - estimatedHours * 3_600_000)
    : null
  const recommendedStart = latestSafeStart
    ? new Date(latestSafeStart.getTime() - safetyMargin * 3_600_000)
    : null

  // ── Labels (for Gemini to understand situation without arithmetic) ─────────
  const deadlineProximity = getDeadlineProximityLabel(remainingHours)
  const bufferRisk        = getBufferRiskLabel(bufferHours)
  const urgencyScore      = computeUrgencyScore(remainingHours, bufferHours, importance)
  const { classification, locked, rule } = computeDeterministicClassification(
    remainingHours,
    bufferHours,
    importance
  )

  // ── Format helpers ────────────────────────────────────────────────────────
  const fmt = (d) => d ? d.toLocaleString("en-IN", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) : null

  return {
    // Original fields (passed through unchanged)
    id:              rawTask.id,
    title:           rawTask.title,
    description:     rawTask.description || "",
    consequence:     rawTask.consequence || "",
    importance,
    estimatedHours,

    // Pre-computed facts — Gemini reads these, never recomputes them
    computed: {
      remainingHours:           r(remainingHours),
      bufferHours:              r(bufferHours),
      urgencyScore,
      deadlineProximity,        // e.g. "TODAY", "IMMINENT", "THIS_WEEK"
      bufferRisk,               // e.g. "CRITICAL_RISK", "COMFORTABLE"
      isPastDue:                remainingHours !== null && remainingHours < 0,
      hasDeadline:              !!deadline,
      safetyMarginHours:        safetyMargin,

      // Human-readable timestamps for Gemini to reference in its reasoning
      deadlineFormatted:        fmt(deadline),
      latestSafeStartFormatted: fmt(latestSafeStart),
      recommendedStartFormatted:fmt(recommendedStart),

      // Deterministic decision — Gemini validates, does not re-derive
      suggestedClassification:  classification,
      classificationLocked:     locked,   // true = Gemini CANNOT change this
      classificationRule:       rule,     // why JS chose this classification
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH PREPROCESSOR — for the API route
// ─────────────────────────────────────────────────────────────────────────────
export function preprocessTasks(rawTasks) {
  const now = new Date()  // Single reference time for the entire batch
  return rawTasks.map(task => preprocessTask(task, now))
}