import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ChatProvider } from './context/ChatContext'
import { Toaster } from 'react-hot-toast'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from 'react-router-dom'  // ✅

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>                                 {/* ✅ */}
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <ChatProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#2f2f2f',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                fontSize: '13px',
              },
              success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
            }}
          />
        </ChatProvider>
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
)