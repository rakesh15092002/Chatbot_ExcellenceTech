import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Routes, Route, Navigate } from 'react-router-dom'  // ✅
import Sidebar from './components/Sidebar'
import ChatContainer from './components/ChatContainer'
import AuthPage from './pages/AuthPage'
import { useState } from 'react'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)

  return (
    <>
      <SignedOut>
        <AuthPage />
      </SignedOut>

      <SignedIn>
        <div className="flex h-screen bg-[#212121] overflow-hidden">
          <Sidebar isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
          <Routes>
            {/* ✅ / → /chat */}
            <Route path="/" element={<Navigate to="/chat" replace />} />
            {/* ✅ /chat → empty welcome */}
            <Route path="/chat" element={<ChatContainer toggleSidebar={toggleSidebar} />} />
            {/* ✅ /chat/:threadId → load thread */}
            <Route path="/chat/:threadId" element={<ChatContainer toggleSidebar={toggleSidebar} />} />
          </Routes>
        </div>
      </SignedIn>
    </>
  )
}

export default App
