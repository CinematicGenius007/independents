import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Crash } from './ui/Crash'
// Self-hosted, latin subsets only: no third-party requests, and only the
// weights the design uses.
import '@fontsource/saira-condensed/latin-200.css'
import '@fontsource/saira-condensed/latin-300.css'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
)
