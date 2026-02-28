import { SignedIn, SignedOut } from '@clerk/clerk-react'
import Sidebar from './components/Sidebar'
import ChatContainer from './components/ChatContainer'
import AuthPage from './pages/AuthPage'
import { useState } from 'react'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)  // ✅

  return (
    <>
      <SignedOut>
        <AuthPage />
      </SignedOut>

      <SignedIn>
        <div className="flex h-screen bg-[#212121] overflow-hidden">
          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
          />
          {/* ✅ pass toggleSidebar to ChatContainer */}
          <ChatContainer toggleSidebar={toggleSidebar} />
        </div>
      </SignedIn>
    </>
  )
}

export default App