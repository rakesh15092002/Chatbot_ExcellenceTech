import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import ChatContainer from './components/ChatContainer';
import { Menu } from 'lucide-react';

export default function App() {
  const [isOpen, setIsOpen] = useState(true);
  const [activeThreadId, setActiveThreadId] = useState(null);
  // Signal to tell Sidebar to refresh its list
  const [refreshSignal, setRefreshSignal] = useState(0);

  const triggerRefresh = () => setRefreshSignal(prev => prev + 1);

  return (
    <div className="flex h-screen w-full bg-[#212121] text-white overflow-hidden font-sans">
      <Sidebar 
        isOpen={isOpen} 
        toggleSidebar={() => setIsOpen(false)} 
        onSelectThread={setActiveThreadId}
        activeThreadId={activeThreadId}
        refreshSignal={refreshSignal} 
      />

      <div className="flex-1 flex flex-col relative overflow-hidden bg-[#212121]">
        {!isOpen && (
          <button 
            onClick={() => setIsOpen(true)}
            className="absolute top-3 left-4 z-50 p-2.5 bg-[#2f2f2f] text-gray-300 rounded-xl hover:bg-[#383838] border border-white/10 shadow-lg"
          >
            <Menu size={20} />
          </button>
        )}

        <ChatContainer 
          threadId={activeThreadId} 
          setActiveThreadId={setActiveThreadId} 
          triggerRefresh={triggerRefresh}
        />
      </div>
    </div>
  );
}