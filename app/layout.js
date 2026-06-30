import "./globals.css"
import Provider from "../components/SessionProvider"

export const metadata = {
  title: "TRIAGE",
  description: "AI Crisis Commander",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Provider>
          {children}
        </Provider>
      </body>
    </html>
  )
}