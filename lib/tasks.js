import { db } from "./firebase"
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  increment,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore"

// ─── TIME DEBT FORMULA ───────────────────────────────────────────────────────
export function calculateTimeCost(originalHours, deferCount) {
  if (!originalHours || !deferCount || deferCount === 0) return originalHours
  return parseFloat((originalHours * (1 + 0.3 * deferCount)).toFixed(1))
}

// ─── SAVE A NEW MANUAL TASK ──────────────────────────────────────────────────
export async function saveManualTask(taskData, userId) {
  const estimatedHours = parseFloat(taskData.estimatedHours) || 1
  const docRef = await addDoc(collection(db, "manual_tasks"), {
    userId,
    title: taskData.title,
    deadline: taskData.deadline || null,
    estimatedHours: estimatedHours,
    originalEstimate: estimatedHours,
    importance: parseInt(taskData.importance) || 3,
    description: taskData.description || "",
    consequence: taskData.consequence || "",
    deferCount: 0,
    createdAt: serverTimestamp(),
    source: "manual",
    classification: null,
    reason: null,
    urgencyScore: null,
    minimumViableVersion: null,
    scopeApplied: false,
  })
  return {
    id: docRef.id,
    userId,
    title: taskData.title,
    deadline: taskData.deadline || null,
    estimatedHours: estimatedHours,
    originalEstimate: estimatedHours,
    importance: parseInt(taskData.importance) || 3,
    description: taskData.description || "",
    consequence: taskData.consequence || "",
    deferCount: 0,
    source: "manual",
    classification: null,
    reason: null,
    urgencyScore: null,
    minimumViableVersion: null,
    scopeApplied: false,
  }
}

// ─── LOAD ALL MANUAL TASKS ───────────────────────────────────────────────────

export async function getManualTasks(userId) {
  if (!userId) return []
  const q = query(collection(db, "manual_tasks"), where("userId", "==", userId))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─── DEFER A TASK ────────────────────────────────────────────────────────────
export async function deferTask(taskId, isManual = true) {
  if (isManual) {
    const ref = doc(db, "manual_tasks", taskId)
    await updateDoc(ref, { deferCount: increment(1) })
  } else {
    const ref = doc(db, "task_states", taskId)
    const existing = await getDoc(ref)
    if (existing.exists()) {
      await updateDoc(ref, { deferCount: increment(1) })
    } else {
      await setDoc(ref, { deferCount: 1 })
    }
  }
}

// ─── SAVE AI CLASSIFICATION ──────────────────────────────────────────────────
export async function saveTaskClassification(taskId, classData) {
  const ref = doc(db, "manual_tasks", taskId)
  await updateDoc(ref, {
    classification: classData.classification || null,
    reason: classData.reason || null,
    urgencyScore: classData.urgencyScore || null,
    minimumViableVersion: classData.minimumViableVersion || null,
  })
}

// ─── APPLY SCOPE REDUCTION ───────────────────────────────────────────────────
export async function applyScope(taskId, mvd, newEstimate) {
  const ref = doc(db, "manual_tasks", taskId)
  await updateDoc(ref, {
    minimumViableVersion: mvd,
    estimatedHours: newEstimate,
    scopeApplied: true,
  })
}

// ─── SAVE SPRINT RESULT ──────────────────────────────────────────────────────
// Called when user finishes a sprint and clicks Yes / Partially / No
export async function saveSprintResult(taskId, result, actualMinutes, estimatedMinutes) {
  // Save sprint log entry
  await addDoc(collection(db, "sprint_results"), {
    taskId,
    result,          // "yes" | "partially" | "no"
    actualMinutes,
    estimatedMinutes,
    accuracy: estimatedMinutes > 0 ? actualMinutes / estimatedMinutes : null,
    timestamp: serverTimestamp(),
  })

  // If completed, mark task as done in Firestore
  if (result === "yes") {
    try {
      const ref = doc(db, "manual_tasks", taskId)
      await updateDoc(ref, { completed: true, completedAt: serverTimestamp() })
    } catch (e) {
      // Google task IDs won't be in manual_tasks — that's fine
    }
  }
}

// ─── SAVE STRESS SNAPSHOT ────────────────────────────────────────────────────
// Saves a rolling stress assessment result
export async function saveStressSnapshot(score, signals, recommendation) {
  await addDoc(collection(db, "stress_snapshots"), {
    score: score ?? 0,
    signals: signals ?? [],
    recommendation: recommendation ?? "",
    timestamp: serverTimestamp(),
  })
}

// ─── SAVE PLANNING MULTIPLIER ────────────────────────────────────────────────
// After each debrief, update the user's known planning accuracy
export async function savePlanningMultiplier(taskType, multiplier) {
  const ref = doc(db, "user_profile", "planning_accuracy")
  const existing = await getDoc(ref)
  const current = existing.exists() ? existing.data() : {}
  await setDoc(ref, {
    ...current,
    [taskType]: parseFloat(multiplier.toFixed(2)),
    updatedAt: serverTimestamp(),
  })
}

// ─── GET PLANNING MULTIPLIER ─────────────────────────────────────────────────
export async function getPlanningMultipliers() {
  const ref = doc(db, "user_profile", "planning_accuracy")
  const snap = await getDoc(ref)
  return snap.exists() ? snap.data() : {}
}