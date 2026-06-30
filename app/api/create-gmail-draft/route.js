import { getServerSession } from "next-auth"
import { authOptions } from "../../../lib/auth"
import { google } from "googleapis"

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return Response.json({ error: "Not authenticated — please sign in again." }, { status: 401 })
    }

    const { toEmail, subject, body } = await request.json()

    if (!toEmail || !subject || !body) {
      return Response.json({ error: "Missing required fields: toEmail, subject, body" }, { status: 400 })
    }

    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: session.accessToken })
    const gmail = google.gmail({ version: "v1", auth })

    // Build the raw email string in RFC 2822 format
    const emailLines = [
      `To: ${toEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `MIME-Version: 1.0`,
      ``,
      body,
    ]
    const rawEmail = emailLines.join("\r\n")

    // Encode to base64url (Node.js Buffer method — works server-side)
    const encoded = Buffer.from(rawEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "")

    const draft = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: { raw: encoded },
      },
    })

    return Response.json({
      success: true,
      draftId: draft.data.id,
      message: "Draft saved to Gmail successfully",
    })
  } catch (err) {
    console.error("Gmail draft error:", err)

    // Give the user a helpful error message
    if (err.code === 401 || err.message?.includes("invalid_grant")) {
      return Response.json({
        error: "Gmail access expired. Please sign out and sign in again.",
      }, { status: 401 })
    }

    return Response.json({ error: err.message }, { status: 500 })
  }
}