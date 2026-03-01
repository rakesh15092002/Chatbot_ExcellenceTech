import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { useClerk } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';  // ✅
import {
  PanelLeftClose, Plus, MessageSquare,
  Settings, ShieldCheck, Trash2, LogOut
} from 'lucide-react';
import toast from 'react-hot-toast';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const {
    threads,
    activeThreadId,
    setActiveThreadId,
    loadingThreads,
    deleteThread,
  } = useChat();

  const { signOut }  = useClerk();
  const navigate     = useNavigate();  // ✅

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteClick = (e, threadId) => {
    e.stopPropagation();
    setConfirmDeleteId(threadId);
  };

  const handleConfirmDelete = async (e, threadId) => {
    e.stopPropagation();
    await deleteThread(threadId);
    setConfirmDeleteId(null);
    toast.success("🗑️ Thread deleted successfully!");
    // ✅ If deleted thread was active, go to /chat
    if (activeThreadId === threadId) {
      navigate('/chat');
    }
  };

  const handleCancelDelete = (e) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success("👋 Signed out successfully!");
  };

  return (
    <div className={`bg-[#171717] h-screen transition-all duration-300 border-r border-white/10 flex flex-col ${isOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>

      {/* 1. TOP */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/5 bg-[#1a1a1a] shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 bg-blue-600 rounded-lg shrink-0">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <span className="text-sm font-bold text-gray-100 truncate">
            Excellence Technology
          </span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-[#2f2f2f] rounded-md text-gray-500 hover:text-white transition-colors"
        >
          <PanelLeftClose size={18} />
        </button>
      </div>

      {/* 2. MIDDLE */}
      <div className="flex-1 flex flex-col min-h-0 p-4">

        {/* ✅ New Chat — navigate to /chat */}
        <button
          onClick={() => {
            setActiveThreadId(null);
            navigate('/chat');  // ✅
          }}
          className="flex items-center gap-2 p-3 mb-6 rounded-xl text-white shrink-0 transition-all active:scale-95
                     bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} />
          <span className="text-sm font-semibold">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
          <p className="text-[10px] text-gray-500 font-bold px-2 py-2 uppercase tracking-widest">
            Recent Activity
          </p>

          {loadingThreads ? (
            <div className="px-2 py-4 text-xs text-gray-600 animate-pulse">
              Loading chats...
            </div>
          ) : threads.length === 0 ? (
            <div className="px-2 py-4 text-xs text-gray-600 italic">
              No threads found
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.thread_id}
                onClick={() => {
                  if (confirmDeleteId !== thread.thread_id) {
                    setActiveThreadId(thread.thread_id);
                    navigate(`/chat/${thread.thread_id}`);  // ✅ URL updates
                  }
                }}
                className={`flex items-center gap-3 p-2.5 text-sm rounded-lg cursor-pointer transition-all group ${
                  activeThreadId === thread.thread_id
                    ? 'bg-[#2f2f2f] text-white'
                    : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-100'
                }`}
              >
                <MessageSquare
                  size={14}
                  className={`shrink-0 ${
                    activeThreadId === thread.thread_id
                      ? 'text-blue-400'
                      : 'group-hover:text-blue-400'
                  }`}
                />

                {confirmDeleteId === thread.thread_id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-red-400 truncate">Delete?</span>
                    <button
                      onClick={(e) => handleConfirmDelete(e, thread.thread_id)}
                      className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded-md transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={handleCancelDelete}
                      className="text-[10px] bg-[#444] hover:bg-[#555] text-white px-2 py-0.5 rounded-md transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="truncate flex-1">{thread.name}</span>
                    <button
                      onClick={(e) => handleDeleteClick(e, thread.thread_id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded-md text-gray-500 hover:text-red-400 transition-all shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3. BOTTOM */}
      <div className="p-4 border-t border-white/5 bg-[#171717] shrink-0 space-y-1">
        <div className="p-3 text-sm hover:bg-[#2f2f2f] rounded-lg cursor-pointer flex items-center gap-3 text-gray-400 hover:text-white transition-colors group">
          <Settings size={18} className="group-hover:rotate-45 transition-transform duration-500" />
          <span className="font-medium">Settings</span>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full p-3 text-sm hover:bg-red-500/10 rounded-lg flex items-center gap-3 text-gray-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={18} />
          <span className="font-medium">Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;