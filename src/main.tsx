import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/app.css'
import './board/board.css'

const container = document.getElementById('root')
if (container === null) throw new Error('index.html is missing the #root element')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
