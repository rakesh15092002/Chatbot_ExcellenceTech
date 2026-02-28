import React from 'react';
import { useChat } from '../context/ChatContext'; // Import your custom hook
import { PanelLeftClose, Plus, MessageSquare, Settings, ShieldCheck } from 'lucide-react';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  // Pulling global state and functions from Context
  const { 
    threads, 
    activeThreadId, 
    setActiveThreadId, 
    loadingThreads 
  } = useChat();

  return (
    <div className={`bg-[#171717] h-screen transition-all duration-300 border-r border-white/10 flex flex-col ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
      
      {/* 1. TOP SECTION: Brand & Toggle */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-100 truncate">Excellence Technology</span>
        </div>
        <button onClick={toggleSidebar} className="p-1.5 hover:bg-[#2f2f2f] rounded-md text-gray-500 hover:text-white transition-colors">
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* 2. MIDDLE SECTION: New Chat & Scrollable History */}
      <div className="flex-1 flex flex-col min-h-0 p-4">
        <button 
          onClick={() => setActiveThreadId(null)} // Reset active thread for a fresh screen
          className="flex items-center gap-2 p-3 mb-6 hover:bg-[#2f2f2f] rounded-xl border border-white/10 bg-[#212121] text-gray-200 shrink-0 transition-all active:scale-95"
        >
          <Plus size={18} /> 
          <span className="text-sm font-medium">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
          <p className="text-[10px] text-gray-500 font-bold px-2 py-2 uppercase tracking-widest">Recent Activity</p>
          
          {loadingThreads ? (
            <div className="px-2 py-4 text-xs text-gray-600 animate-pulse">Loading chats...</div>
          ) : threads.length === 0 ? (
            <div className="px-2 py-4 text-xs text-gray-600 italic">No threads found</div>
          ) : (
            threads.map((thread) => (
              <div 
                key={thread.thread_id} 
                onClick={() => setActiveThreadId(thread.thread_id)}
                className={`flex items-center gap-3 p-2.5 text-sm rounded-lg cursor-pointer transition-all truncate group ${
                  activeThreadId === thread.thread_id 
                    ? 'bg-[#2f2f2f] text-white' 
                    : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-100'
                }`}
              >
                <MessageSquare size={14} className={`shrink-0 ${activeThreadId === thread.thread_id ? 'text-blue-400' : 'group-hover:text-blue-400'}`} />
                <span className="truncate">{thread.name}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. BOTTOM SECTION: Settings */}
      <div className="p-4 border-t border-white/5 bg-[#171717] shrink-0">
        <div className="p-3 text-sm hover:bg-[#2f2f2f] rounded-lg cursor-pointer flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
          <Settings size={18} className="group-hover:rotate-45 transition-transform duration-500" />
          <span className="font-medium">Settings</span>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;