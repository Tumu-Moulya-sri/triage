"use client"
import { useState } from "react"

const RELATIONSHIP_OPTIONS = [
  { value: "client",    label: "🤝 Client",      desc: "Professional & solution-focused" },
  { value: "manager",  label: "👔 Manager/Boss",  desc: "Direct & accountable" },
  { value: "teammate", label: "👥 Teammate",      desc: "Warm & collaborative" },
  { value: "professor",label: "🎓 Professor",     desc: "Respectful & formal" },
]

// Step 1: Input form
function StepInput({ task, form, setForm, onNext, onClose, loading }) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const defaultDate = tomorrow.toISOString().slice(0, 16)
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl mt-1">✉️</span>
        <div>
          <h2 className="text-white font-bold text-lg leading-tight">Request Extension</h2>
          <p className="text-gray-400 text-sm mt-0.5">
            TRIAGE will draft a professional email for: <strong className="text-white">{task.title}</strong>
          </p>
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1.5 block font-medium">
          Who is this for? <span className="text-red-400">*</span>
        </label>
        <input
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition"
          placeholder="their@email.com"
          type="email"
          value={form.toEmail}
          onChange={e => update("toEmail", e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-2 block font-medium">Relationship type</label>
        <div className="grid grid-cols-2 gap-2">
          {RELATIONSHIP_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => update("relationshipType", opt.value)}
              className={`p-3 rounded-xl border text-left transition ${
                form.relationshipType === opt.value
                  ? "border-purple-500 bg-purple-950/40"
                  : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
              }`}
            >
              <div className="text-sm font-medium text-white">{opt.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1.5 block font-medium">
          Why can't you deliver on time? <span className="text-red-400">*</span>
        </label>
        <textarea
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition resize-none"
          rows={2}
          placeholder="e.g. Waiting on data from the analytics team, blocked by external dependency..."
          value={form.reason}
          onChange={e => update("reason", e.target.value)}
        />
      </div>

      <div>
        <label className="text-xs text-gray-400 mb-1.5 block font-medium">
          Proposed new deadline
        </label>
        <input
          type="datetime-local"
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500 transition"
          value={form.proposedDeadline || defaultDate}
          onChange={e => update("proposedDeadline", e.target.value)}
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 border border-gray-600 text-gray-400 rounded-xl text-sm hover:border-gray-400 transition">
          Cancel
        </button>
        <button
          onClick={onNext}
          disabled={loading || !form.toEmail || !form.reason}
          className="flex-grow py-2.5 bg-purple-700 hover:bg-purple-600 disabled:bg-purple-950 disabled:opacity-50 text-white rounded-xl text-sm font-bold transition"
        >
          {loading ? "Drafting negotiation..." : "Generate Email →"}
        </button>
      </div>
    </div>
  )
}

// Step 2: Review the generated email
function StepReview({ emailData, form, setForm, task, onCreateDraft, onBack, drafting, draftDone, draftError }) {
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">📝</span>
        <h2 className="text-white font-bold text-lg">Review Your Email</h2>
      </div>

      {/* Email composer — Gmail-inspired */}
      <div className="bg-gray-800 border border-gray-600 rounded-xl overflow-hidden">
        {/* To field */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700">
          <span className="text-xs text-gray-500 w-12 shrink-0">To</span>
          <span className="text-sm text-gray-300">{form.toEmail}</span>
        </div>
        {/* Subject field — editable */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700">
          <span className="text-xs text-gray-500 w-12 shrink-0">Subject</span>
          <input
            className="flex-1 bg-transparent text-sm text-white focus:outline-none"
            value={form.draftSubject || emailData.subject}
            onChange={e => update("draftSubject", e.target.value)}
          />
        </div>
        {/* Body — editable */}
        <textarea
          className="w-full bg-transparent px-4 py-3 text-sm text-gray-200 focus:outline-none resize-none leading-relaxed"
          rows={10}
          value={form.draftBody !== undefined ? form.draftBody : emailData.body}
          onChange={e => update("draftBody", e.target.value)}
        />
      </div>

      {/* Tone note from AI */}
      {emailData.tone && (
        <div className="text-xs text-gray-500 italic px-1">
          ✦ Tone: {emailData.tone}
        </div>
      )}

      {/* Safety notice — prominent */}
      <div className="bg-green-950/40 border border-green-800/40 rounded-xl p-3 flex items-start gap-2">
        <span className="text-green-400 text-lg">🔒</span>
        <div className="text-xs text-green-300 leading-relaxed">
          <strong>This will NOT be sent automatically.</strong> Clicking the button below saves it as a Gmail draft only. You review and send it from Gmail yourself.
        </div>
      </div>

      {/* Error */}
      {draftError && (
        <div className="text-red-400 text-xs bg-red-950/30 border border-red-800/30 rounded-lg p-3">
          {draftError}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 py-2.5 border border-gray-600 text-gray-400 rounded-xl text-sm hover:border-gray-400 transition">
          ← Edit Details
        </button>
        <button
          onClick={onCreateDraft}
          disabled={drafting || draftDone}
          className="flex-grow py-2.5 bg-green-700 hover:bg-green-600 disabled:bg-green-950 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition"
        >
          {drafting ? "Saving to Gmail..." : draftDone ? "✓ Draft Saved!" : "📥 Save to Gmail Drafts"}
        </button>
      </div>

     {draftDone && (
        <a
          href="https://mail.google.com/mail/u/0/#drafts"
          target="_blank"
          rel="noopener noreferrer"
          className="text-center text-blue-400 hover:text-blue-300 text-sm underline"
        >
          Open Gmail Drafts →
        </a>
      )}
    </div>
  )
}

// Main NegotiationModal
export default function NegotiationModal({ task, onClose }) {
  const [step, setStep] = useState("input")  // "input" | "review"
  const [form, setForm] = useState({
    toEmail: "",
    relationshipType: "manager",
    reason: "",
    proposedDeadline: "",
    draftSubject: undefined,
    draftBody: undefined,
  })
  const [emailData, setEmailData] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftDone, setDraftDone] = useState(false)
  const [draftError, setDraftError] = useState("")
  const [inputError, setInputError] = useState("")

  const handleGenerate = async () => {
    if (!form.toEmail) { setInputError("Please enter an email address."); return }
    if (!form.reason) { setInputError("Please explain why you need more time."); return }
    setInputError("")
    setGenerating(true)
    try {
      const res = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task,
          reason: form.reason,
          toEmail: form.toEmail,
          relationshipType: form.relationshipType,
          proposedDeadline: form.proposedDeadline,
        }),
      })
      const data = await res.json()
      if (data.error) { setInputError(data.error); setGenerating(false); return }
      setEmailData(data)
      // Initialize editable copies
      setForm(p => ({ ...p, draftSubject: data.subject, draftBody: data.body }))
      setStep("review")
    } catch (err) {
      setInputError("Network error. Check your connection.")
      console.error(err)
    }
    setGenerating(false)
  }

  const handleCreateDraft = async () => {
    setDrafting(true)
    setDraftError("")
    try {
      const res = await fetch("/api/create-gmail-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toEmail: form.toEmail,
          subject: form.draftSubject || emailData.subject,
          body: form.draftBody !== undefined ? form.draftBody : emailData.body,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setDraftDone(true)
      } else {
        setDraftError(data.error || "Failed to create draft. Try signing out and back in.")
      }
    } catch (err) {
      setDraftError("Network error creating draft.")
      console.error(err)
    }
    setDrafting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-purple-800/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {inputError && step === "input" && (
          <div className="text-red-400 text-xs mb-4 bg-red-950/30 border border-red-800/30 rounded-lg p-2.5">{inputError}</div>
        )}

        {step === "input" ? (
          <StepInput
            task={task}
            form={form}
            setForm={setForm}
            onNext={handleGenerate}
            onClose={onClose}
            loading={generating}
          />
        ) : (
          <StepReview
            emailData={emailData}
            form={form}
            setForm={setForm}
            task={task}
            onCreateDraft={handleCreateDraft}
            onBack={() => setStep("input")}
            drafting={drafting}
            draftDone={draftDone}
            draftError={draftError}
          />
        )}
      </div>
    </div>
  )
}