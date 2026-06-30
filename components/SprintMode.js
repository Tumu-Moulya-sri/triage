"use client"
import { useState, useEffect, useRef } from "react"
import { saveSprintResult } from "../lib/tasks"

// Duration options the user can pick before starting
const DURATION_OPTIONS = [
  { label: "15 min", minutes: 15 },
  { label: "25 min", minutes: 25 },
  { label: "45 min", minutes: 45 },
  { label: "60 min", minutes: 60 },
  { label: "90 min", minutes: 90 },
]

// Format seconds into MM:SS display
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

export default function SprintMode({ task, onClose, onComplete }) {
  // Phase: "setup" → "running" → "paused" → "finished" → "debrief"
  const [phase, setPhase] = useState("setup")
  const [selectedMinutes, setSelectedMinutes] = useState(25)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [totalSeconds, setTotalSeconds] = useState(25 * 60)
  const [sprintNotes, setSprintNotes] = useState("")
  const [debriefResult, setDebriefResult] = useState(null) // "yes"|"partially"|"no"
  const [saving, setSaving] = useState(false)
  const [startTime, setStartTime] = useState(null)
  const intervalRef = useRef(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // Start the countdown
  const handleStart = () => {
    const secs = selectedMinutes * 60
    setSecondsLeft(secs)
    setTotalSeconds(secs)
    setStartTime(Date.now())
    setPhase("running")

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current)
          setPhase("finished")
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  // Pause/resume
  const handlePause = () => {
    if (phase === "running") {
      clearInterval(intervalRef.current)
      setPhase("paused")
    } else if (phase === "paused") {
      setPhase("running")
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            setPhase("finished")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
  }

  // End sprint early
  const handleStop = () => {
    clearInterval(intervalRef.current)
    setPhase("finished")
  }

  // Save debrief result to Firestore
  const handleDebrief = async (result) => {
    setDebriefResult(result)
    setSaving(true)
    const actualMinutes = startTime
      ? Math.round((Date.now() - startTime) / 60000)
      : selectedMinutes
    try {
      await saveSprintResult(task.id, result, actualMinutes, selectedMinutes)
    } catch (err) {
      console.error("Failed to save sprint result:", err)
    }
    setSaving(false)
    setPhase("debrief")
  }

  // Progress percentage for the ring
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0
  const circumference = 2 * Math.PI * 54 // radius = 54
  const strokeDashoffset = circumference - (progress / 100) * circumference

  // ── SETUP PHASE ──────────────────────────────────────────────────────────────
  if (phase === "setup") {
    return (
      <div className="fixed inset-0 bg-gray-950/98 z-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md flex flex-col gap-6">
          {/* Header */}
          <div className="text-center">
            <div className="text-red-400 text-xs font-bold tracking-widest mb-2">⚡ SPRINT MODE</div>
            <h2 className="text-white text-2xl font-black leading-tight">{task.title}</h2>
            {task.reason && (
              <p className="text-gray-400 text-sm mt-2 italic">{task.reason}</p>
            )}
          </div>

          {/* Duration picker */}
          <div>
            <div className="text-gray-400 text-xs font-medium mb-3 text-center">
              Select sprint duration
            </div>
            <div className="grid grid-cols-5 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.minutes}
                  onClick={() => setSelectedMinutes(opt.minutes)}
                  className={`py-3 rounded-xl text-sm font-bold transition ${
                    selectedMinutes === opt.minutes
                      ? "bg-red-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notes field */}
          <div>
            <div className="text-gray-400 text-xs font-medium mb-2">
              What will you accomplish in this sprint?
              <span className="text-gray-600 ml-1 font-normal">(optional)</span>
            </div>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-red-500 transition resize-none"
              rows={3}
              placeholder="e.g. Write the executive summary and first two sections..."
              value={sprintNotes}
              onChange={(e) => setSprintNotes(e.target.value)}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-700 text-gray-400 rounded-xl font-medium hover:border-gray-500 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              className="flex-2 flex-grow py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-lg transition"
            >
              Start Sprint →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── RUNNING / PAUSED PHASE ───────────────────────────────────────────────────
  if (phase === "running" || phase === "paused") {
    return (
      <div className="fixed inset-0 bg-gray-950/98 z-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-8">
          {/* Status label */}
          <div className={`text-xs font-bold tracking-widest ${
            phase === "paused" ? "text-amber-400" : "text-red-400 animate-pulse"
          }`}>
            {phase === "paused" ? "⏸ PAUSED" : "⚡ SPRINTING"}
          </div>

          {/* Task title */}
          <h2 className="text-white text-xl font-black text-center leading-tight">{task.title}</h2>

          {/* Circular timer */}
          <div className="relative flex items-center justify-center">
            <svg width="140" height="140" viewBox="0 0 140 140">
              {/* Background ring */}
              <circle
                cx="70" cy="70" r="54"
                fill="none"
                stroke="#1f2937"
                strokeWidth="8"
              />
              {/* Progress ring */}

              <defs>
  <filter id="timerGlow">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
<circle
  cx="70" cy="70" r="54"
  fill="none"
  stroke={phase === "paused" ? "#f59e0b" : "#ef4444"}
  strokeWidth="8"
  strokeLinecap="round"
  strokeDasharray={circumference}
  strokeDashoffset={strokeDashoffset}
  transform="rotate(-90 70 70)"
  filter={secondsLeft < 60 ? "url(#timerGlow)" : ""}
  style={{ transition: "stroke-dashoffset 1s linear" }}
/>
              <circle
                cx="70" cy="70" r="54"
                fill="none"
                stroke={phase === "paused" ? "#f59e0b" : "#ef4444"}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 70 70)"
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
            {/* Timer text */}
            <div className="absolute text-center">
              <div className="text-white text-3xl font-black tabular-nums">
                {formatTime(secondsLeft)}
              </div>
              <div className="text-gray-500 text-xs">remaining</div>
            </div>
          </div>

          {/* Notes during sprint */}
          <div className="w-full">
            <div className="text-gray-500 text-xs mb-2">Progress notes</div>
            <textarea
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gray-500 transition resize-none"
              rows={3}
              placeholder="Jot your progress here..."
              value={sprintNotes}
              onChange={(e) => setSprintNotes(e.target.value)}
            />
          </div>

          {/* Controls */}
          <div className="flex gap-3 w-full">
            <button
              onClick={handlePause}
              className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-semibold transition"
            >
              {phase === "paused" ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button
              onClick={handleStop}
              className="flex-1 py-3 border border-red-800/50 text-red-400 hover:bg-red-950/30 rounded-xl font-semibold transition"
            >
              ⏹ End Early
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── FINISHED PHASE — DID YOU COMPLETE IT? ────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="fixed inset-0 bg-gray-950/98 z-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="text-5xl">⏱</div>
          <div className="text-center">
            <h2 className="text-white text-2xl font-black">Sprint Complete</h2>
            <p className="text-gray-400 text-sm mt-1">
              {selectedMinutes} min sprint on:{" "}
              <span className="text-white">{task.title}</span>
            </p>
          </div>
          <div className="text-white text-base font-medium">Did you finish the task?</div>
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => handleDebrief("yes")}
              disabled={saving}
              className="w-full py-4 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition"
            >
              ✅ Yes — Task Complete
            </button>
            <button
              onClick={() => handleDebrief("partially")}
              disabled={saving}
              className="w-full py-4 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition"
            >
              🔄 Partially — Need More Time
            </button>
            <button
              onClick={() => handleDebrief("no")}
              disabled={saving}
              className="w-full py-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white rounded-xl font-bold text-lg transition"
            >
              ❌ No — Got Blocked
            </button>
          </div>
          {saving && (
            <div className="text-gray-400 text-xs animate-pulse">Saving to TRIAGE memory...</div>
          )}
        </div>
      </div>
    )
  }

  // ── DEBRIEF PHASE ────────────────────────────────────────────────────────────
  if (phase === "debrief") {
    const icon = debriefResult === "yes" ? "🏆" : debriefResult === "partially" ? "📈" : "🔧"
    const headline =
      debriefResult === "yes"
        ? "Excellent sprint!"
        : debriefResult === "partially"
        ? "Good progress made."
        : "Sprint data saved."
    const sub =
      debriefResult === "yes"
        ? "TRIAGE has updated your completion record."
        : debriefResult === "partially"
        ? "TRIAGE will adjust your future time estimates for this task type."
        : "Understanding what blocks you helps TRIAGE plan better next time."

    return (
      <div className="fixed inset-0 bg-gray-950/98 z-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-5">
          <div className="text-6xl">{icon}</div>
          <div className="text-center">
            <h2 className="text-white text-xl font-black">{headline}</h2>
            <p className="text-gray-400 text-sm mt-2 leading-relaxed">{sub}</p>
          </div>
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 w-full text-center">
            <div className="text-gray-400 text-xs mb-1">Sprint logged</div>
            <div className="text-white font-medium text-sm">{task.title}</div>
            <div className="text-gray-500 text-xs mt-1">{selectedMinutes} min sprint</div>
          </div>
          <button
            onClick={() => {
              onComplete && onComplete(debriefResult)
              onClose()
            }}
            className="w-full py-3 bg-white text-black rounded-xl font-bold transition hover:bg-gray-200"
          >
            Return to War Room →
          </button>
        </div>
      </div>
    )
  }

  return null
}