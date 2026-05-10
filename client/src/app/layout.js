import './globals.css'

export const metadata = {
  title: 'WordRank - Multiplayer Word Guessing',
  description: 'Guess the hidden words of other players based on semantic similarity.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
