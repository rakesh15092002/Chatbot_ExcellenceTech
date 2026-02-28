import React from 'react';
import { useUser } from '@clerk/clerk-react';
import { PanelLeftOpen } from 'lucide-react';  // ✅

// ✅ Accept toggleSidebar
const ChatNavbar = ({ toggleSidebar }) => {
  const { user } = useUser();

  const getInitials = (name) => {
    if (!name) return "?";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <header className="h-14 flex items-center px-4 justify-between border-b border-white/5">
      <div className="flex items-center gap-3">
        {/* ✅ Toggle button — opens sidebar when closed */}
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-[#2f2f2f] rounded-md text-gray-500 hover:text-white transition-colors"
        >
          <PanelLeftOpen size={18} />
        </button>

        <div className="font-medium text-gray-400 text-sm">AI Orbit v1.0</div>
      </div>

      {/* ✅ User profile */}
      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-white text-xs font-medium">{user.fullName}</span>
            <span className="text-gray-500 text-[10px]">
              {user.primaryEmailAddress?.emailAddress}
            </span>
          </div>

          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold text-white">
              {getInitials(user.fullName)}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default ChatNavbar;