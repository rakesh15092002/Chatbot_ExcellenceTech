import React, { useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useChat } from "../context/ChatContext";
import { Send, Paperclip, Loader2, X, FileText } from "lucide-react";

const PromptSection = () => {
  const {
    activeThreadId,
    setActiveThreadId,
    setMessages,
    refreshThreads,
    addPdfBubble,
    authHeaders,
  } = useChat();

  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef                    = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("❌ Only PDF files are supported.");
      e.target.value = null;
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 20) {
      toast.error(`❌ File too large (${sizeMB.toFixed(1)} MB). Max: 20 MB.`);
      e.target.value = null;
      return;
    }
    setSelectedFile(file);
    toast.success(`📎 "${file.name}" selected.`, { duration: 3000 });
  };

  const createThread = async (name) => {
    const res = await axios.post(
      `http://localhost:8000/thread/?name=${encodeURIComponent(name)}`,
      {},
      authHeaders()
    );
    return res.data.thread_id;
  };

  const uploadFile = async (file, threadId) => {
    setUploading(true);
    const toastId = toast.loading(`⏳ Uploading "${file.name}"...`);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await axios.post(
        `http://localhost:8000/documents/upload?thread_id=${threadId}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders().headers,
          },
        }
      );
      toast.success(
        `✅ "${file.name}" uploaded! (${res.data.chunks_indexed} chunks)`,
        { id: toastId, duration: 4000 }
      );
      return true;
    } catch (error) {
      const errMsg =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        "❌ Failed to upload PDF.";
      toast.error(errMsg, { id: toastId, duration: 5000 });
      return false;
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (message, threadId) => {
    const res = await axios.post(
      `http://localhost:8000/chat/send`,
      { message, thread_id: threadId },
      authHeaders()
    );
    return res.data.reply;
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading || uploading) return;
    setLoading(true);
    let currentThreadId = activeThreadId;

    try {
      // ── Step A: Create thread if not exists ──
      if (!currentThreadId) {
        const threadName = selectedFile
          ? selectedFile.name.split(".")[0]
          : input.split(" ").slice(0, 3).join(" ");
        currentThreadId = await createThread(threadName);
        await refreshThreads();
      }

      // ── Step B: Upload PDF ──
      if (selectedFile) {
        const fileName = selectedFile.name;
        addPdfBubble(currentThreadId, fileName);
        setActiveThreadId(currentThreadId);

        const uploaded = await uploadFile(selectedFile, currentThreadId);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = null;

        if (!uploaded) {
          setMessages(prev => [...prev, {
            role:    "ai",
            content: `❌ Failed to upload **${fileName}**. Please try again.`
          }]);
          return;
        }

        await new Promise(r => setTimeout(r, 600));
        setMessages(prev => [...prev, {
          role:    "ai",
          content:
            `✅ **${fileName}** uploaded successfully!\n\n` +
            `💬 You can now ask me anything about **${fileName}**.\n` +
            `📌 I will answer strictly from the document content.`
        }]);

        if (input.trim()) {
          const userMsg = input.trim();
          setInput("");
          setMessages(prev => [...prev, { role: "user", content: userMsg }]);
          await new Promise(r => setTimeout(r, 2000));
          const reply = await sendMessage(userMsg, currentThreadId);
          setMessages(prev => [...prev, { role: "ai", content: reply }]);
        }
        return;
      }

      // ── Step C: Send chat message ──
      if (!input.trim()) return;
      if (!activeThreadId) setActiveThreadId(currentThreadId);

      const userMsg = input.trim();
      setInput("");
      setMessages(prev => [...prev, { role: "user", content: userMsg }]);
      const reply = await sendMessage(userMsg, currentThreadId);
      setMessages(prev => [...prev, { role: "ai", content: reply }]);

    } catch (error) {
      const errMsg =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        "An error occurred. Please try again.";
      setMessages(prev => [...prev, {
        role:    "ai",
        content: `System Error: ${errMsg}`
      }]);
      toast.error(`❌ ${errMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ Neutral wrapper — works both centered and at bottom
    <div className="w-full px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto w-full">

        {/* File Preview Chip */}
        {selectedFile && (
          <div className="flex items-center gap-2 bg-[#2f2f2f] w-fit mb-2 px-3 py-2 rounded-xl border border-white/10">
            <FileText size={14} className="text-blue-400 shrink-0" />
            <span className="text-[11px] text-gray-300 truncate max-w-[180px]">
              {selectedFile.name}
            </span>
            {uploading ? (
              <Loader2 size={14} className="animate-spin text-blue-400" />
            ) : (
              <button
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = null;
                }}
                className="text-gray-500 hover:text-red-400 transition-colors ml-1"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Input box */}
        <div className="bg-[#2f2f2f] border border-white/10 rounded-2xl px-4 py-3 flex items-end gap-3 shadow-xl transition-all focus-within:border-blue-500/50">

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
          />

          {/* Paperclip */}
          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className={`p-1.5 rounded-lg transition-colors shrink-0 mb-0.5 ${
              selectedFile
                ? "text-blue-400"
                : "text-gray-500 hover:text-white hover:bg-white/10"
            } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Paperclip size={18} />
          </button>

          {/* Textarea */}
          <textarea
            rows="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" &&
              !e.shiftKey &&
              (e.preventDefault(), handleSend())
            }
            placeholder="Ask Excellence AI..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 resize-none max-h-36 py-1 leading-6 custom-scrollbar"
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 144) + "px";
            }}
          />

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedFile) || loading || uploading}
            className={`p-1.5 rounded-lg transition-all shrink-0 mb-0.5 ${
              (input.trim() || selectedFile) && !uploading
                ? "bg-white text-black hover:bg-gray-200"
                : "text-gray-600 cursor-not-allowed"
            }`}
          >
            {loading || uploading
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>

        {/* Bottom hint */}
        <p className="text-center text-[10px] text-gray-600 mt-2">
          AI Orbit answers strictly from uploaded PDFs only.
        </p>

      </div>
    </div>
  );
};

export default PromptSection;