import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { UserMapPage } from './pages/UserMapPage.tsx'
import { LegalPage } from './pages/LegalPage.tsx'
import { LocaleProvider } from './i18n/LocaleContext'
import { ToastProvider } from './components/ToastProvider'
import { AlertProvider } from './components/AlertProvider'
import { bootstrapAuthFromUrl } from './lib/bootstrapAuth'
import { createAppQueryClient } from './lib/queryClient'

const queryClient = createAppQueryClient()

async function main() {
  await bootstrapAuthFromUrl()

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ToastProvider>
          <AlertProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/terms" element={<LegalPage kind="terms" />} />
              <Route path="/:username" element={<UserMapPage />} />
            </Routes>
          </BrowserRouter>
          </AlertProvider>
          </ToastProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

void main()
