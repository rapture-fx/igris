import { ThemeProvider, useTheme } from './useTheme.tmp'

function App({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme()
  return (
    <html lang="en" className={theme}>
      <body>
        {children}
      </body>
    </html>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <App>{children}</App>
    </ThemeProvider>
  )
}
