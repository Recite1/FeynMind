// app/layout.js
import '@/styles/globals.css'

export const metadata = {
  title: 'SnapChef',
  description: 'Your kitchen companion',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}