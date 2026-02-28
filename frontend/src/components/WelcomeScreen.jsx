import React from 'react';
import { ShieldCheck } from 'lucide-react';

const WelcomeScreen = () => {
  return (
    <div className="flex flex-col items-center justify-center text-center px-4 pb-8">

      {/* Logo */}
      <div className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-6">
        <ShieldCheck size={36} className="text-blue-400" />
      </div>

      {/* Title */}
      <h1 className="text-2xl font-bold text-white mb-3">
        Welcome to ExcellenceTech
      </h1>

      {/* Subtitle */}
      <p className="text-gray-400 text-sm max-w-sm leading-relaxed mb-2">
        Your intelligent PDF assistant powered by Excellence Technology.
      </p>
    </div>
  );
};

export default WelcomeScreen;