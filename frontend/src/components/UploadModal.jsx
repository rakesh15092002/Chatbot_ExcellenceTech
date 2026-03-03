import React from "react";
import { Loader2, CheckCircle, XCircle, FileText } from "lucide-react";

const UploadModal = ({ status, filename, chunks }) => {
  if (!status) return null;

  const config = {
    uploading: {
      icon:     <Loader2 size={52} className="text-blue-400 animate-spin" />,
      title:    "Uploading PDF...",
      message:  "Your file is being uploaded and indexed into the AI.",
      sub:      "Please wait, do not close this tab.",
      border:   "border-blue-500/40",
      pill:     "bg-blue-500/10 text-blue-300 border border-blue-500/30",
      pillText: "Processing",
      showBar:  true,
    },
    success: {
      icon:     <CheckCircle size={52} className="text-green-400" />,
      title:    "Upload Successful!",
      message:  "Your PDF is ready. You can now ask questions.",
      sub:      chunks ? `${chunks} chunks indexed into the AI.` : "",
      border:   "border-green-500/40",
      pill:     "bg-green-500/10 text-green-300 border border-green-500/30",
      pillText: "Ready",
      showBar:  false,
    },
    error: {
      icon:     <XCircle size={52} className="text-red-400" />,
      title:    "Upload Failed",
      message:  "Something went wrong. Please try again.",
      sub:      "Make sure the file is a valid PDF under 20MB.",
      border:   "border-red-500/40",
      pill:     "bg-red-500/10 text-red-300 border border-red-500/30",
      pillText: "Failed",
      showBar:  false,
    },
  };

  const c = config[status];

  return (
    // ✅ Full screen backdrop
    <div className="fixed inset-0 z-50 flex items-center justify-center">

      {/* Dark blurred overlay */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div className={`relative z-10 bg-[#1c1c1c] border ${c.border}
                       rounded-2xl shadow-2xl p-8 w-[380px] mx-4
                       flex flex-col items-center gap-5`}>

        {/* Filename bar */}
        <div className="flex items-center gap-2 bg-[#2a2a2a] border border-white/10
                        px-4 py-2.5 rounded-xl w-full">
          <FileText size={16} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-300 truncate">{filename}</span>
        </div>

        {/* Icon */}
        <div className="my-1">{c.icon}</div>

        {/* Title */}
        <h2 className="text-white text-xl font-bold text-center leading-tight">
          {c.title}
        </h2>

        {/* Message */}
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          {c.message}
        </p>

        {/* Sub message */}
        {c.sub && (
          <p className="text-gray-600 text-xs text-center">{c.sub}</p>
        )}

        {/* Status pill */}
        <span className={`text-xs font-semibold px-4 py-1.5 rounded-full ${c.pill}`}>
          {c.pillText}
        </span>

        {/* Progress bar — only during upload */}
        {c.showBar && (
          <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"
                 style={{ width: "70%" }} />
          </div>
        )}

      </div>
    </div>
  );
};

export default UploadModal;