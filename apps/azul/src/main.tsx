import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { Crash } from './ui/Crash'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Crash>
      <App />
    </Crash>
  </StrictMode>,
)
