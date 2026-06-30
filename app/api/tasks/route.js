import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { google } from "googleapis"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      // Return empty arrays so the app still works with manual tasks only
      return Response.json({ events: [], tasks: [] })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.accessToken })

    const now = new Date()
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Fetch Calendar events
    let events = []
    try {
      const calendar = google.calendar({ version: "v3", auth })
      const calRes = await calendar.events.list({
        calendarId: "primary",
        timeMin: now.toISOString(),
        timeMax: weekFromNow.toISOString(),
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 10,
      })
      events = calRes.data.items || []
    } catch (e) {
      console.warn("Calendar fetch failed:", e.message)
    }

    // Fetch Tasks
    let tasks = []
    try {
      const tasksApi = google.tasks({ version: "v1", auth })
      const taskListsRes = await tasksApi.tasklists.list()
      const firstList = taskListsRes.data.items?.[0]
      if (firstList) {
        const tasksRes = await tasksApi.tasks.list({
          tasklist: firstList.id,
          showCompleted: false,
          maxResults: 20,
        })
        tasks = tasksRes.data.items || []
      }
    } catch (e) {
      console.warn("Tasks fetch failed:", e.message)
    }

    return Response.json({ events, tasks })
  } catch (err) {
    console.error("Tasks route error:", err)
    return Response.json({ events: [], tasks: [], error: err.message })
  }
}