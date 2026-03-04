import React from 'react';
import { X, User, Moon, Bell, Shield } from 'lucide-react';

const SettingsModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-[#1f1f1f] w-full max-w-2xl h-[500px] rounded-2xl border border-white/10 shadow-2xl flex overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Left Sidebar inside Modal */}
        <div className="w-48 bg-[#1a1a1a] border-r border-white/5 p-4 flex flex-col gap-2">
          <h2 className="text-white font-bold mb-4 px-2">Settings</h2>
          <button className="flex items-center gap-3 px-3 py-2 bg-blue-600/10 text-blue-400 rounded-lg text-sm font-medium text-left">
            <User size={16} /> General
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 rounded-lg text-sm font-medium text-left transition-colors">
            <Bell size={16} /> Notifications
          </button>
          <button className="flex items-center gap-3 px-3 py-2 text-gray-400 hover:bg-white/5 rounded-lg text-sm font-medium text-left transition-colors">
            <Shield size={16} /> Security
          </button>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col bg-[#1f1f1f]">
          <div className="flex justify-between items-center p-4 border-b border-white/5">
            <span className="text-gray-400 text-sm font-medium">General Settings</span>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Theme Toggle Example */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-100 font-medium">Dark Mode</p>
                <p className="text-xs text-gray-500">Adjust the appearance of the interface</p>
              </div>
              <div className="w-10 h-5 bg-blue-600 rounded-full flex items-center px-1">
                <div className="w-3 h-3 bg-white rounded-full ml-auto" />
              </div>
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <p className="text-gray-100 font-medium">System Language</p>
              <select className="w-full bg-[#2a2a2a] border border-white/10 text-gray-300 rounded-lg p-2 text-sm outline-none focus:border-blue-500">
                <option>English</option>
                <option>Spanish</option>
                <option>French</option>
              </select>
            </div>

            <div className="pt-4 border-t border-white/5">
              <button className="text-sm text-red-400 hover:text-red-300 font-medium">
                Clear all chat history
              </button>
            </div>
          </div>

          <div className="mt-auto p-4 border-t border-white/5 bg-[#1a1a1a] flex justify-end">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-white text-black text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;