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
    authHeaders,    // ✅ added
  } = useChat();

  const [input, setInput]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef                    = useRef(null);

  // ─────────────────────────────────────────────
  // Step 1: File Selection & Validation
  // ─────────────────────────────────────────────
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
    toast.success(`📎 "${file.name}" selected. Click send to upload.`, {
      duration: 3000,
    });
  };

  // ─────────────────────────────────────────────
  // Step 2: Create Thread (async) ✅ with authHeaders
  // ─────────────────────────────────────────────
  const createThread = async (name) => {
    const res = await axios.post(
      `http://localhost:8000/thread/?name=${encodeURIComponent(name)}`,
      {},             // ✅ empty body
      authHeaders()   // ✅ sends x-user-id header
    );
    return res.data.thread_id;
  };

  // ─────────────────────────────────────────────
  // Step 3: Upload PDF (async) ✅ with authHeaders
  // ─────────────────────────────────────────────
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
            ...authHeaders().headers,   // ✅ merge x-user-id with multipart header
          },
        }
      );

      toast.success(
        `✅ "${file.name}" uploaded! (${res.data.chunks_indexed} chunks indexed)`,
        { id: toastId, duration: 4000 }
      );

      return true;

    } catch (error) {
      const errMsg =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        "❌ Failed to upload PDF. Please try again.";

      toast.error(errMsg, { id: toastId, duration: 5000 });
      return false;

    } finally {
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────
  // Step 4: Send Chat Message (async) ✅ with authHeaders
  // ─────────────────────────────────────────────
  const sendMessage = async (message, threadId) => {
    const res = await axios.post(
      `http://localhost:8000/chat/send`,
      { message, thread_id: threadId },
      authHeaders()   // ✅
    );
    return res.data.reply;
  };

  // ─────────────────────────────────────────────
  // Main Handler — fully async, step by step
  // ─────────────────────────────────────────────
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

        currentThreadId = await createThread(threadName);  // ✅ sends user_id
        await refreshThreads();
      }

      // ── Step B: Upload PDF if selected ──
      if (selectedFile) {
        const fileName = selectedFile.name;

        // ✅ 1. Register bubble FIRST
        addPdfBubble(currentThreadId, fileName);

        // ✅ 2. Set active thread
        setActiveThreadId(currentThreadId);

        // ✅ 3. Upload to backend
        const uploaded = await uploadFile(selectedFile, currentThreadId);

        // ✅ 4. Clear file state
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = null;

        if (!uploaded) {
          setMessages((prev) => [
            ...prev,
            {
              role:    "ai",
              content: `❌ Failed to upload **${fileName}**. Please try again.`,
            },
          ]);
          return;
        }

        // ✅ 5. Wait for fetchMessages to finish
        await new Promise((resolve) => setTimeout(resolve, 600));

        // ✅ 6. AI acknowledgment
        setMessages((prev) => [
          ...prev,
          {
            role:    "ai",
            content:
              `✅ **${fileName}** uploaded successfully!\n\n` +
              `💬 You can now ask me anything about **${fileName}**.\n` +
              `📌 I will answer strictly from the document content.`,
          },
        ]);

        // ✅ 7. If user also typed a message
        if (input.trim()) {
          const userMsg = input.trim();
          setInput("");

          setMessages((prev) => [
            ...prev,
            { role: "user", content: userMsg }
          ]);

          await new Promise((resolve) => setTimeout(resolve, 2000));

          const reply = await sendMessage(userMsg, currentThreadId);
          setMessages((prev) => [
            ...prev,
            { role: "ai", content: reply }
          ]);
        }

        return;
      }

      // ── Step C: No file — just send chat message ──
      if (!input.trim()) return;

      if (!activeThreadId) {
        setActiveThreadId(currentThreadId);
      }

      const userMsg = input.trim();
      setInput("");

      setMessages((prev) => [...prev, { role: "user", content: userMsg }]);

      const reply = await sendMessage(userMsg, currentThreadId);  // ✅ sends user_id

      setMessages((prev) => [...prev, { role: "ai", content: reply }]);

    } catch (error) {
      console.error("❌ Operation Error:", error);

      const errMsg =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        "An error occurred. Please try again.";

      setMessages((prev) => [
        ...prev,
        { role: "ai", content: `System Error: ${errMsg}` },
      ]);

      toast.error(`❌ ${errMsg}`);

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#212121] via-[#212121] to-transparent">
      <div className="max-w-3xl mx-auto bg-[#2f2f2f] border border-white/10 rounded-2xl p-2 flex flex-col shadow-2xl transition-all focus-within:border-blue-500/50">

        {/* File Preview Chip */}
        {selectedFile && (
          <div className="flex items-center gap-2 bg-[#1a1a1a] w-fit m-2 p-2 px-3 rounded-lg border border-white/10">
            <FileText size={14} className="text-blue-400" />
            <span className="text-[11px] text-gray-300 truncate max-w-[150px]">
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
                className="text-gray-500 hover:text-red-400 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}

        <div className="flex items-end gap-2 px-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="application/pdf"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className={`p-2 mb-1 rounded-lg transition-colors ${
              selectedFile ? "text-blue-400" : "text-gray-400 hover:text-white"
            } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Paperclip size={20} />
          </button>

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
            className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-white resize-none max-h-40 custom-scrollbar"
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = e.target.scrollHeight + "px";
            }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !selectedFile) || loading || uploading}
            className={`p-2 mb-1 rounded-lg transition-all ${
              (input.trim() || selectedFile) && !uploading
                ? "bg-white text-black hover:bg-gray-200"
                : "text-gray-600"
            }`}
          >
            {loading || uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptSection;