import React from 'react';

const ChatNavbar = () => (
  <header className="h-14 flex items-center px-4 justify-between border-b border-white/5">
    <div className="ml-10 md:ml-0 font-medium text-gray-400 text-sm">AI Orbit v1.0</div>
    <div className="flex items-center gap-4">
      <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">RM</div>
    </div>
  </header>
);

export default ChatNavbar;