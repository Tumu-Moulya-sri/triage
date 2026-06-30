//page.js code

"use client"
import { useState, useEffect } from "react"
import { useSession, signIn, signOut } from "next-auth/react"
import {
  getManualTasks, saveManualTask, deferTask,
  saveTaskClassification, applyScope,
  calculateTimeCost, saveStressSnapshot,
} from "../lib/tasks"
import SprintMode from "../components/SprintMode"
import NegotiationModal from "../components/NegotiationModal"

// ═══════════ CONSTANTS ═══════════════════════════════════════════════════════
const CLASS_STYLE = {
  Critical:    { border: "border-red-500/60",    bg: "bg-gradient-to-br from-red-950/50 to-red-900/20",    badge: "bg-gradient-to-r from-red-600 to-red-500 text-white shadow-lg shadow-red-900/50",   emoji: "🔴" },
  Shrinkable:  { border: "border-amber-400/60",  bg: "bg-gradient-to-br from-amber-950/40 to-amber-900/10",  badge: "bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-lg shadow-amber-900/40", emoji: "🟡" },
  Delegatable: { border: "border-blue-400/60",   bg: "bg-gradient-to-br from-blue-950/40 to-blue-900/10",   badge: "bg-gradient-to-r from-blue-500 to-blue-400 text-white shadow-lg shadow-blue-900/40",  emoji: "🔵" },
  Killable:    { border: "border-gray-500/60",   bg: "bg-gradient-to-br from-gray-900/50 to-gray-800/10",   badge: "bg-gradient-to-r from-gray-600 to-gray-500 text-white",  emoji: "⚫" },
}
const LOADING_MESSAGES = [
  "Analyzing deadline cascade...", "Calculating crisis severity...",
  "Classifying tasks by urgency...", "Assessing your rescue window...",
  "Running triage protocol...", "Detecting stress signals...",
  "Mapping dependency chain...", "Drafting negotiation strategy...",
]
const STRESS_CONFIG = {
  Calm:     { bar: "bg-green-500",  text: "text-green-400",  tip: "Your task language shows a calm, focused state." },
  Elevated: { bar: "bg-amber-500",  text: "text-amber-400",  tip: "Some urgency detected in your task descriptions." },
  High:     { bar: "bg-orange-500", text: "text-orange-400", tip: "High stress signals detected. Consider a lighter task first." },
  Critical: { bar: "bg-red-500",    text: "text-red-400",    tip: "Critical stress. TRIAGE recommends a recovery task first." },
}

// Maps new triage classifications to UI display labels
function mapTriageClass(classification) {
  const map = {
    DO_NOW:    "Critical",
    DEFER:     "Shrinkable",
    SCHEDULE:  "Shrinkable",
    DELEGATE:  "Delegatable",
    ELIMINATE: "Killable",
  }
  return map[classification] || "Shrinkable"
}

// ═══════════ HELPERS ══════════════════════════════════════════════════════════
const getHoursLeft = (d) => d ? Math.max(0, (new Date(d) - new Date()) / 3600000) : null
const formatHoursLeft = (h) => h < 1 ? `${Math.round(h*60)}min left` : h < 24 ? `${h.toFixed(1)}h left` : `${Math.floor(h/24)}d ${Math.round(h%24)}h left`
const calcSeverityScore = (tasks) => {
  const now = new Date()
  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < now).length
  const today = tasks.filter(t => { const h = getHoursLeft(t.deadline); return h !== null && h <= 24 }).length
  return overdue * 3 + today * 2
}

function ImportanceStars({ value = 3 }) {
  return <span className="text-xs">{[1,2,3,4,5].map(i=><span key={i} className={i<=value?"text-yellow-400":"text-gray-700"}>★</span>)}</span>
}

// ═══════════ STRESS BAR ═══════════════════════════════════════════════════════
function StressBar({ stressData }) {
  const [show, setShow] = useState(false)
  if (!stressData) return null
  const label = stressData.stressLabel || "Calm"
  const cfg = STRESS_CONFIG[label] || STRESS_CONFIG.Calm
  const pct = ((stressData.stressScore || 1) / 10) * 100
  return (
    <div className="relative cursor-pointer" onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}>
      <div className="h-1 w-full bg-gray-800"><div className={`h-full transition-all duration-700 ${cfg.bar}`} style={{width:`${pct}%`}}/></div>
      <div className="flex items-center gap-2 px-6 py-1.5 bg-gray-900/80 border-b border-gray-800">
        <span className={`text-xs font-bold ${cfg.text}`}>◉ Stress: {label} ({stressData.stressScore}/10)</span>
        {stressData.recommendation && <span className="text-xs text-gray-500 hidden md:inline">— {stressData.recommendation}</span>}
        <span className="text-gray-600 text-xs ml-auto">hover for signals</span>
      </div>
      {show && stressData.signals?.length > 0 && (
        <div className="absolute top-full left-6 z-40 bg-gray-800 border border-gray-600 rounded-xl p-3 w-72 shadow-xl">
          <div className="text-xs font-semibold text-gray-300 mb-2">Stress signals detected:</div>
          {stressData.signals.map((s,i)=><div key={i} className="text-xs text-gray-400 flex gap-2 mb-1"><span className="text-orange-400">•</span><span>{s}</span></div>)}
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">{cfg.tip}</div>
        </div>
      )}
    </div>
  )
}

// ═══════════ COORDINATOR BANNER ════════════════════════════════════════════════
function CoordinatorBanner({ tasks, onActivate }) {
  const score = calcSeverityScore(tasks)
  if (score < 6 || tasks.length === 0) return null
  const level = score >= 12 ? "🔴 CRITICAL CRISIS" : score >= 8 ? "🟠 HIGH SEVERITY" : "🟡 ELEVATED RISK"
  const color = score >= 12 ? "bg-red-950/80 border-red-800 text-red-300" : score >= 8 ? "bg-orange-950/80 border-orange-800 text-orange-300" : "bg-amber-950/80 border-amber-800 text-amber-300"
  return (
    <div className={`border rounded-xl p-4 flex items-center justify-between gap-4 ${color}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">🚨</span>
        <div>
          <div className="font-bold text-sm">{level} DETECTED</div>
          <div className="text-xs opacity-75">Severity score: {score}/20 — TRIAGE recommends activating now.</div>
        </div>
      </div>
      <button onClick={onActivate} className="shrink-0 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold transition">Activate Now →</button>
    </div>
  )
}

// ═══════════ ADD TASK MODAL ════════════════════════════════════════════════════
function AddTaskModal({ onClose, onSave, userId }) {
  const [form, setForm] = useState({ title:"", deadline:"", estimatedHours:"", importance:3, description:"", consequence:"" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const upd = (f,v) => setForm(p=>({...p,[f]:v}))
  const handleSave = async () => {
    if (!form.title.trim()) { setError("Please enter a task title."); return }
    setSaving(true)
    try { const s = await saveManualTask(form, userId); onSave(s); onClose() }
    catch(err) { setError("Save failed."); console.error(err) }
    setSaving(false)
  }
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-5"><h2 className="text-white font-bold text-lg">Add Task to War Room</h2><button onClick={onClose} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center text-xl">✕</button></div>
        <div className="flex flex-col gap-4">
          <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">Task Title <span className="text-red-400">*</span></label>
            <input autoFocus className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" placeholder="e.g. Q3 investor report" value={form.title} onChange={e=>upd("title",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSave()}/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">Deadline</label><input type="datetime-local" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" value={form.deadline} onChange={e=>upd("deadline",e.target.value)}/></div>
            <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">Estimated Hours</label><input type="number" step="0.5" min="0.5" max="40" className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" placeholder="e.g. 2" value={form.estimatedHours} onChange={e=>upd("estimatedHours",e.target.value)}/></div>
          </div>
          <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">Importance: <span className="text-white">{form.importance}/5</span></label>
            <input type="range" min="1" max="5" step="1" className="w-full accent-yellow-400 cursor-pointer" value={form.importance} onChange={e=>upd("importance",parseInt(e.target.value))}/>
            <div className="flex justify-between text-xs text-gray-600 mt-1"><span>Nice to have</span><span>Mission critical</span></div>
          </div>
          <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">What happens if you miss this? <span className="text-gray-500 font-normal">(key for AI)</span></label>
            <input className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition" placeholder="e.g. Client presentation fails" value={form.consequence} onChange={e=>upd("consequence",e.target.value)}/>
          </div>
          <div><label className="text-xs text-gray-400 mb-1.5 block font-medium">Notes <span className="text-gray-500 font-normal">(optional)</span></label>
            <textarea className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition resize-none" rows={2} placeholder="Any additional context..." value={form.description} onChange={e=>upd("description",e.target.value)}/>
          </div>
          {error && <div className="text-red-400 text-xs">{error}</div>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-600 text-gray-400 rounded-lg text-sm hover:border-gray-400 transition">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 text-white rounded-lg text-sm font-semibold transition">{saving?"Saving...":"Add to War Room →"}</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════ SCOPE MODAL ══════════════════════════════════════════════════════
function ScopeModal({ scopeData, onAccept, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-amber-700/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
        <div className="flex items-center gap-3 mb-4"><span className="text-2xl">🔧</span><h2 className="text-white font-bold text-lg">Scope Reduction Plan</h2></div>
        <div className="flex flex-col gap-3">
          <div className="bg-amber-950/30 border border-amber-700/40 rounded-xl p-4"><div className="text-xs text-amber-400 font-semibold mb-1">MINIMUM VIABLE DELIVERABLE</div><div className="text-amber-100 text-sm leading-relaxed">{scopeData.mvd}</div></div>
          <div className="bg-gray-800/50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex justify-between text-sm"><span className="text-gray-400">New estimate</span><span className="text-white font-medium">{scopeData.newEstimate}h</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-400">What was cut</span><span className="text-gray-300 text-right max-w-[60%]">{scopeData.whatWasRemoved}</span></div>
          </div>
          <div className="bg-blue-950/30 border border-blue-700/40 rounded-xl p-3"><div className="text-xs text-blue-400 font-semibold mb-1">WHAT TO TELL YOUR STAKEHOLDER</div><div className="text-blue-200 text-sm italic">"{scopeData.deliveryNote}"</div></div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-600 text-gray-400 rounded-lg text-sm hover:border-gray-400 transition">Keep original</button>
          <button onClick={onAccept} className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-semibold transition">✓ Apply Reduction</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════ TASK CARD ════════════════════════════════════════════════════════
function TaskCard({ task, onDefer, onScopeResult, onSprintStart, onNegotiate }) {
  const [scopeLoading, setScopeLoading] = useState(false)
  const [pendingScope, setPendingScope] = useState(null)
  const style = CLASS_STYLE[task.classification] || { border:"border-gray-700", bg:"bg-gray-900/50", badge:"bg-gray-700 text-gray-300", emoji:"⬜" }
  const hoursLeft = getHoursLeft(task.deadline)
  const timeCost = (task.deferCount||0) > 0 ? calculateTimeCost(task.originalEstimate||task.estimatedHours||1, task.deferCount) : null
  const debtPulse = (task.deferCount||0) > 3 ? "animate-pulse" : ""

  const handleReduceScope = async () => {
    setScopeLoading(true)
    try {
      const res = await fetch("/api/scope", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({title:task.title, description:task.description, estimatedHours:task.estimatedHours}) })
      const data = await res.json()
      if (data.mvd) setPendingScope(data)
      else alert("Scope analysis failed.")
    } catch(e) { console.error(e) }
    setScopeLoading(false)
  }

  const handleAcceptScope = async () => {
    if (!pendingScope) return
    await applyScope(task.id, pendingScope.mvd, pendingScope.newEstimate)
    onScopeResult(task.id, pendingScope.mvd, pendingScope.newEstimate)
    setPendingScope(null)
  }

  return (
    <>
      <div className={`relative border rounded-2xl p-5 flex flex-col gap-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl backdrop-blur-sm ${style.border} ${style.bg} ${task.classification === "Critical" ? "animate-glow-border" : ""}`}>
  {task.classification === "Critical" && (
    <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping" />
  )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {task.classification
              ? <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${style.badge}`}>{style.emoji} {task.classification}</span>
              : <span className="text-xs text-gray-500 italic">Not yet classified</span>}
            {task.urgencyScore && <span className="text-xs text-gray-500">Urgency {task.urgencyScore}/10</span>}
          </div>
          {task.importance && <ImportanceStars value={task.importance}/>}
        </div>
        <div className="text-white font-semibold leading-snug text-sm">{task.title}</div>
        {task.reason && <div className="text-xs text-gray-400 leading-relaxed border-l-2 border-gray-600 pl-2.5 italic">{task.reason}</div>}
        {task.scopeApplied && task.minimumViableVersion && (
          <div className="text-xs bg-amber-900/30 border border-amber-700/40 rounded-lg p-2.5">
            <div className="text-amber-400 font-semibold mb-0.5">✓ Scope Reduced</div>
            <div className="text-amber-200">{task.minimumViableVersion}</div>
            {task.estimatedHours && <div className="text-amber-500 mt-0.5">New estimate: {task.estimatedHours}h</div>}
          </div>
        )}
        {(task.deferCount||0) > 0 && timeCost && (
          <div className={`flex items-start gap-2 text-xs bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 ${debtPulse}`}>
            <span className="text-red-400 text-base mt-0.5">⏳</span>
            <div>
              <span className="text-red-300 font-bold">{task.deferCount}× deferred</span>
              <span className="text-gray-400"> — cost grew from </span>
              <span className="text-gray-300 font-medium">{task.originalEstimate||task.estimatedHours||1}h</span>
              <span className="text-red-400"> → </span>
              <span className="text-red-300 font-bold">{timeCost}h</span>
              <span className="text-gray-500 ml-1">(+{((timeCost/(task.originalEstimate||1)-1)*100).toFixed(0)}%)</span>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
          {task.deadline && <span>📅 {new Date(task.deadline).toLocaleString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
          {hoursLeft !== null && <span className={`font-medium ${hoursLeft<3?"text-red-400":hoursLeft<12?"text-amber-400":"text-gray-400"}`}>⏱ {formatHoursLeft(hoursLeft)}</span>}
          {task.estimatedHours && <span>~{task.estimatedHours}h</span>}
          {task.source==="google-tasks" && <span className="text-blue-500">Google Tasks</span>}
          {task.source==="google-calendar" && <span className="text-blue-500">Calendar</span>}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {task.classification==="Critical" && (
            <button onClick={()=>onSprintStart(task)} className="text-xs px-3 py-1.5 bg-red-700/50 border border-red-500/50 text-red-300 rounded-lg hover:bg-red-700/70 transition font-semibold">⚡ Sprint Mode</button>
          )}
          {task.classification==="Shrinkable" && !task.scopeApplied && (
            <button onClick={handleReduceScope} disabled={scopeLoading} className="text-xs px-3 py-1.5 bg-amber-800/40 border border-amber-600/50 text-amber-300 rounded-lg hover:bg-amber-800/60 transition disabled:opacity-50 font-medium">
              {scopeLoading?"⏳ Analyzing...":"🔧 Reduce Scope"}
            </button>
          )}
          {/* NEGOTIATION BUTTON — Day 4 live */}
          {(task.classification==="Delegatable"||task.classification==="Killable"||task.classification==="Shrinkable") && (
            <button onClick={()=>onNegotiate(task)} className="text-xs px-3 py-1.5 bg-purple-900/40 border border-purple-600/40 text-purple-300 rounded-lg hover:bg-purple-900/60 transition font-medium">
              ✉️ Request Extension
            </button>
          )}
          <button onClick={()=>onDefer(task)} className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition">📅 Not Today</button>
        </div>
      </div>
      {pendingScope && <ScopeModal scopeData={pendingScope} onAccept={handleAcceptScope} onClose={()=>setPendingScope(null)}/>}
    </>
  )
}

// ═══════════ MAIN PAGE ════════════════════════════════════════════════════════
export default function WarRoom() {
  const { data: session, status } = useSession()
  const [manualTasks, setManualTasks] = useState([])
  const [googleTasks, setGoogleTasks] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0])
  const [triageRan, setTriageRan] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [stressData, setStressData] = useState(null)
  const [sprintTask, setSprintTask] = useState(null)
  const [negotiateTask, setNegotiateTask] = useState(null)

  useEffect(() => {
  if (session?.user?.email) {
    getManualTasks(session.user.email).then(t=>{setManualTasks(t);setInitialLoading(false)}).catch(()=>setInitialLoading(false))
  } else { setInitialLoading(false) }
}, [session])

  const activateTriage = async () => {
    setLoading(true)
    let idx = 0
    const iv = setInterval(()=>{ idx=(idx+1)%LOADING_MESSAGES.length; setLoadingMsg(LOADING_MESSAGES[idx]) }, 1200)
    try {
      const gRes = await fetch("/api/tasks")
      const gData = await gRes.json()
      const gTasks = [
        ...(gData.tasks||[]).map((t,i)=>({id:`gtask-${t.id||i}`,title:t.title||"Untitled",deadline:t.due||null,estimatedHours:1,originalEstimate:1,importance:3,description:"",consequence:"",deferCount:0,source:"google-tasks"})),
        ...(gData.events||[]).slice(0,5).map((e,i)=>({id:`gcal-${e.id||i}`,title:e.summary||"Calendar Event",deadline:e.start?.dateTime||e.start?.date||null,estimatedHours:1,originalEstimate:1,importance:3,description:e.description||"",consequence:"",deferCount:0,source:"google-calendar"})),
      ]
      const freshManual = await getManualTasks(session.user.email)
      setManualTasks(freshManual)

      // Stress detection
      const texts = freshManual.map(t=>[t.title,t.description,t.consequence].filter(Boolean)).flat().filter(s=>s.trim())
      if (texts.length > 0) {
        setLoadingMsg("Detecting stress signals...")
        try {
          const sRes = await fetch("/api/stress-detect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({descriptions:texts})})
          const sData = await sRes.json()
          setStressData(sData)
          saveStressSnapshot(sData.stressScore,sData.signals,sData.recommendation).catch(console.error)
        } catch(e) { console.warn("Stress detection failed:",e.message) }

        // Pause before the next Gemini call to stay under the 10 req/min free tier limit
        setLoadingMsg("Preparing triage protocol...")
        await new Promise(resolve => setTimeout(resolve, 2500))
      }

      const allTasks = [...freshManual,...gTasks]
      if (allTasks.length===0) { alert("Add tasks first."); clearInterval(iv); setLoading(false); return }

      setLoadingMsg("Running triage protocol...")
      const cRes = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: allTasks }),
      })
      const cData = await cRes.json()
      if (!cData.success || !Array.isArray(cData.tasks)) {
        alert("AI classification failed. Check browser console for details.")
        clearInterval(iv)
        setLoading(false)
        return
      }

      // Map new triage response fields to what the UI expects
      const classified = cData.tasks.map(t => ({
        ...allTasks.find(raw => raw.id === t.id) || {},
        ...t,
        // Map new field names to existing UI field names
        classification: mapTriageClass(t.classification),
        reason: t.reason,
        urgencyScore: Math.round((t.urgencyScore / 100) * 10), // convert 0-100 to 0-10
        minimumViableVersion: t.minimumViableVersion,
      }))

      classified.filter(t=>t.source==="manual"&&t.classification&&t.id).forEach(t=>saveTaskClassification(t.id,{classification:t.classification,reason:t.reason,urgencyScore:t.urgencyScore,minimumViableVersion:t.minimumViableVersion}).catch(console.error))
      const sorted = [...classified].sort((a,b)=>(b.urgencyScore||0)-(a.urgencyScore||0))
      setManualTasks(sorted.filter(t=>t.source==="manual"))
      setGoogleTasks(sorted.filter(t=>t.source!=="manual"))
      setTriageRan(true)
    } catch(err) { console.error(err); alert(`Error: ${err.message}`) }
    finally { clearInterval(iv); setLoading(false) }
  }

  const handleDefer = async (task) => {
    const isM = task.source==="manual"
    try {
      await deferTask(task.id,isM)
      const upd = p=>p.map(t=>t.id===task.id?{...t,deferCount:(t.deferCount||0)+1}:t)
      if(isM) setManualTasks(upd); else setGoogleTasks(upd)
    } catch(e){console.error(e)}
  }

  const handleScopeResult = (id,mvd,est) => {
    const upd = p=>p.map(t=>t.id===id?{...t,minimumViableVersion:mvd,estimatedHours:est,scopeApplied:true}:t)
    setManualTasks(upd); setGoogleTasks(upd)
  }

  const handleSprintComplete = (result) => {
    if (result==="yes") {
      setManualTasks(p=>p.filter(t=>t.id!==sprintTask?.id))
      setGoogleTasks(p=>p.filter(t=>t.id!==sprintTask?.id))
    }
    setSprintTask(null)
  }

  if (status==="loading"||initialLoading) return <div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="text-gray-400 text-sm animate-pulse">Loading TRIAGE...</div></div>

  if (!session) return (
  <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 p-6 relative overflow-hidden">
    {/* Animated background glow */}
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] animate-pulse-slow" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/15 rounded-full blur-[120px] animate-pulse-slow" style={{animationDelay: '1.5s'}} />
    </div>

    {/* Grid texture overlay */}
    <div className="absolute inset-0 opacity-[0.03]" style={{
      backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
      backgroundSize: '40px 40px'
    }} />

    {/* Live status pill */}
    <div className="relative flex items-center gap-2 px-4 py-1.5 bg-red-950/40 border border-red-800/50 rounded-full animate-fade-in">
      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
      <span className="text-red-300 text-xs font-medium tracking-wide">CRISIS MANAGEMENT SYSTEM ONLINE</span>
    </div>

    {/* Logo with glow */}
    <div className="relative flex flex-col items-center gap-3 animate-fade-in-up">
      <div className="text-7xl filter drop-shadow-[0_0_25px_rgba(239,68,68,0.5)]">⚕</div>
      <h1 className="text-6xl font-black text-white tracking-tighter bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
        TRIAGE
      </h1>
      <div className="text-red-400 text-xs font-bold tracking-[0.3em] uppercase">
        AI Incident Commander
      </div>
    </div>

    {/* Tagline */}
    <p className="relative text-gray-400 text-center max-w-md leading-relaxed text-base animate-fade-in-up" style={{animationDelay: '0.1s'}}>
      Every productivity app is built for the comfortable state.
      <br/>
      <span className="text-white font-medium">TRIAGE is built for the moment they all abandon you.</span>
    </p>

    {/* Feature pills */}
    <div className="relative flex flex-wrap justify-center gap-2 max-w-md animate-fade-in-up" style={{animationDelay: '0.2s'}}>
      {["⚡ Real-time triage", "✉️ AI negotiation", "🧠 Stress detection"].map((f, i) => (
        <span key={i} className="text-xs px-3 py-1.5 bg-gray-900/80 border border-gray-700 rounded-full text-gray-300">
          {f}
        </span>
      ))}
    </div>

    {/* CTA button */}
    <button
      onClick={()=>signIn("google")}
      className="relative group px-8 py-4 bg-white text-black rounded-2xl font-bold hover:bg-gray-100 transition-all text-sm shadow-[0_0_40px_rgba(255,255,255,0.15)] hover:shadow-[0_0_60px_rgba(255,255,255,0.25)] hover:scale-105 animate-fade-in-up"
      style={{animationDelay: '0.3s'}}
    >
      <span className="flex items-center gap-2">
        Connect Google Account
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </span>
    </button>

    <div className="relative text-gray-600 text-xs animate-fade-in-up" style={{animationDelay: '0.4s'}}>
      Built with Gemini · Google Calendar · Gmail · Firebase
    </div>
  </div>
)

  const allTasks = [...manualTasks,...googleTasks]
  const criticalCount = allTasks.filter(t=>t.classification==="Critical").length
  const totalTimeCost = manualTasks.reduce((s,t)=>s+calculateTimeCost(t.originalEstimate||t.estimatedHours||1,t.deferCount||0),0)

  return (
    <div className="min-h-screen bg-gray-950 text-white relative">
        <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '50px 50px'
      }} />
    <div className="relative z-10"></div>
      {sprintTask && <SprintMode task={sprintTask} onClose={()=>setSprintTask(null)} onComplete={handleSprintComplete}/>}
      {negotiateTask && <NegotiationModal task={negotiateTask} onClose={()=>setNegotiateTask(null)}/>}

      {triageRan && criticalCount>0 && (
  <div className="relative bg-gradient-to-r from-red-950 via-red-900/80 to-red-950 border-b border-red-800/50 px-6 py-2.5 flex items-center gap-3 overflow-hidden">
    <div className="absolute inset-0 bg-red-600/10 animate-pulse" />
    <span className="relative w-2 h-2 bg-red-500 rounded-full animate-pulse-red" />
    <span className="relative text-red-300 font-bold text-xs tracking-wide">CRISIS ACTIVE</span>
    <span className="relative text-red-200/80 text-xs">{criticalCount} critical task{criticalCount!==1?"s":""} require immediate attention</span>
  </div>
)}

      {stressData && <StressBar stressData={stressData}/>}

      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gradient-to-r from-gray-950 via-gray-900/50 to-gray-950 backdrop-blur-sm sticky top-0 z-30">
  <div className="flex items-center gap-4">
    <div className="flex items-center gap-2.5">
      <span className="text-2xl filter drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]">⚕</span>
      <div>
        <div className="text-xl font-black tracking-tight text-white">TRIAGE</div>
        <div className="text-gray-500 text-xs">{allTasks.length} task{allTasks.length!==1?"s":""} in War Room</div>
      </div>
    </div>
          {manualTasks.some(t=>(t.deferCount||0)>0) && (
            <div className="hidden md:flex items-center gap-1.5 bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-1.5">
              <span className="text-xs text-red-400">⏳</span>
              <span className="text-xs text-red-300 font-medium">{totalTimeCost.toFixed(1)}h total time debt</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setShowAddModal(true)} className="px-3 py-2 border border-gray-700 text-gray-300 rounded-lg text-xs font-medium hover:border-gray-500 hover:text-white transition">+ Add Task</button>
          <button
            onClick={activateTriage}
            disabled={loading}
            className="relative px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 disabled:from-red-900 disabled:to-red-900 text-white rounded-xl text-xs font-bold transition-all min-w-[170px] text-center shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] hover:scale-105 disabled:scale-100 disabled:shadow-none overflow-hidden"
          >
            {loading && (
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent shimmer-text" style={{animation: 'shimmer 1.5s linear infinite'}} />
            )}
            <span className="relative">
              {loading ? loadingMsg : "⚡ Activate TRIAGE"}
          </span>
        </button>
          <button onClick={()=>signOut()} className="text-gray-600 text-xs hover:text-gray-400 px-2">Sign out</button>
        </div>
      </div>

      <div className="p-6 flex flex-col gap-5">
        {!triageRan && allTasks.length>0 && <CoordinatorBanner tasks={allTasks} onActivate={activateTriage}/>}

        {allTasks.length===0 && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="text-6xl">🏥</div>
            <div className="text-lg font-bold">War Room Empty</div>
            <div className="text-gray-400 text-sm text-center max-w-xs">Add your tasks then click Activate TRIAGE.</div>
            <button onClick={()=>setShowAddModal(true)} className="px-5 py-2.5 bg-blue-700 hover:bg-blue-600 rounded-xl font-semibold text-sm transition">+ Add Your First Task</button>
          </div>
        )}

        {stressData?.suggestLightTask && allTasks.length>0 && (() => {
          const lightest = [...allTasks].filter(t=>t.classification!=="Critical").sort((a,b)=>(a.estimatedHours||1)-(b.estimatedHours||1))[0]
          return lightest ? (
            <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl">🧠</span>
              <div>
                <div className="text-orange-300 font-semibold text-sm">TRIAGE recommends starting here</div>
                <div className="text-orange-200 text-xs mt-1">High stress detected. Start with: <strong>{lightest.title}</strong>{lightest.estimatedHours&&` (~${lightest.estimatedHours}h)`} to build momentum.</div>
                {stressData.recommendation && <div className="text-orange-400/70 text-xs mt-1 italic">{stressData.recommendation}</div>}
              </div>
            </div>
          ) : null
        })()}

        {allTasks.length>0 && (
          <div>
            {triageRan && (
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-medium text-white">{allTasks.length} tasks classified</div>
                <div className="flex gap-2 flex-wrap text-xs">
                  {["Critical","Shrinkable","Delegatable","Killable"].map(c=>{
                    const count=allTasks.filter(t=>t.classification===c).length
                    if(!count) return null
                    return <span key={c} className={`px-2 py-0.5 rounded-full font-medium ${CLASS_STYLE[c].badge}`}>{count} {c}</span>
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTasks.map(task=>(
                <TaskCard key={task.id} task={task} onDefer={handleDefer} onScopeResult={handleScopeResult} onSprintStart={setSprintTask} onNegotiate={setNegotiateTask}/>
              ))}
            </div>
          </div>
        )}
      </div>

      {showAddModal && <AddTaskModal onClose={()=>setShowAddModal(false)} onSave={t=>setManualTasks(p=>[...p,t])} userId={session.user.email}/>}
    </div>
  )
}