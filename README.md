# TRIAGE

## AI incident commander for deadline crises.

Every productivity app is built for the comfortable state. TRIAGE is built for the moment they all abandon you.


### The problem

- Notion AI, Motion, Reclaim AI, Sunsama, Todoist — every mainstream productivity tool optimizes a schedule for someone who already has time and structure. They plan a week ahead, protect focus time, and suggest changes to a calendar that has breathing room.

- None of them help at the moment a user actually needs it: when multiple deadlines collide, time has run out, and everything feels equally urgent. Google Calendar and Tasks, even with AI suggestions, only ever suggest — they never act.

### The solution

- TRIAGE treats a deadline crisis the way emergency medicine treats a mass casualty event: classify by severity, stabilize the critical, simplify the complex, negotiate the deferrable, and have the courage to recommend abandoning the hopeless.

- On activation, TRIAGE reads a user's real Google Calendar and Google Tasks data, runs every task through a deterministic JavaScript urgency engine (so identical input always produces identical output), and hands the pre-computed facts to four coordinated Gemini-powered agents for natural-language reasoning — never arithmetic. The result is the War Room: a real-time, color-coded dashboard where every task card explains its own reasoning in plain language.



### Architecture

- Google Calendar, Tasks, and Gmail data flows into a Coordinator, which gates every task through the deterministic JS engine before any data reaches the four agents. Agents call Gemini 2.5 Flash for reasoning only; results persist in Firestore on a Vercel-hosted app.

- AgentRoleTriageClassifies every task as DO_NOW, DEFER, SCHEDULE, DELEGATE, or ELIMINATE, using JS-computed time math validated and explained by GeminiScopeDefines a minimum-viable version of any at-risk task and a stakeholder-ready note explaining the cutNegotiationDrafts a tone-appropriate deadline-extension email and saves it as a Gmail draft — never sent automaticallyFocusLaunches fullscreen Sprint Mode for Critical tasks: one task, a countdown, a progress note

- A lightweight Coordinator runs on every page load, calculating a severity score from overdue and due-today tasks, and proactively surfaces a crisis banner when the score crosses a threshold.

### Why deterministic logic matters

Asking Gemini to compute remaining hours and buffer time directly produced inconsistent results — identical input occasionally returned different classifications on repeated runs. TRIAGE separates the two layers: a JavaScript module computes every numeric fact (remaining hours, buffer hours, urgency score, deadline proximity, buffer risk) before any data reaches Gemini. Gemini only validates the suggested classification and explains it in natural language — the task LLMs are reliably good at. Some classifications, like an already-past-due task, are locked and cannot be overridden by the AI under any circumstance.

### Key features

- War Room dashboard — real-time, color-coded triage view with plain-language reasoning on every card
- Stakeholder Negotiation Agent — drafts and saves a real Gmail draft for deadline extensions; user reviews and sends
- Time Debt Ledger — applies a 30% time-cost increase per deferral and displays the growing cost on the task card
- Stress Tone Detector — analyzes the user's own task-description language to detect rising cognitive load and recommends a smaller task first
- Sprint Mode — fullscreen, distraction-free countdown for Critical tasks
- Deterministic reasoning pipeline — all date/urgency arithmetic happens in JavaScript before Gemini ever sees the task


### Tech stack

- Next.js 16 (App Router)
- React
- Tailwind CSS
- AuthNextAuth.js
- Google OAuth 2.0
- Gemini 2.5 Flash via the Google Generative AI SD
- Firebase Firestore
- Google Calendar API
- Google Tasks API
- Gmail API
- Vercel (serverless functions)
