import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { UserMapPage } from './pages/UserMapPage.tsx'
import { LocaleProvider } from './i18n/LocaleContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/@:username" element={<UserMapPage />} />
        </Routes>
      </HashRouter>
    </LocaleProvider>
  </StrictMode>,
)
