import React, { useState, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { useChat } from "../context/ChatContext";
import { Send, Paperclip, Loader2 } from "lucide-react";
import UploadModal from "./UploadModal";

const API = import.meta.env.VITE_API_URL;  // ✅

const PromptSection = () => {
  const {
    activeThreadId,
    setActiveThreadId,
    setMessages,
    refreshThreads,
    addPdfBubble,
    authHeaders,
    currentPdfName,
    setCurrentPdfName,
    skipNextFetch,
  } = useChat();

  const { user }   = useUser();
  const navigate   = useNavigate();

  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [modalStatus, setModalStatus] = useState(null);
  const [modalFile, setModalFile]     = useState("");
  const [modalChunks, setModalChunks] = useState(0);
  const fileInputRef                  = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are supported.");
      e.target.value = null;
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 20) {
      toast.error(`File too large (${sizeMB.toFixed(1)} MB). Max: 20 MB.`);
      e.target.value = null;
      return;
    }
    await autoUpload(file);
  };

  const autoUpload = async (file) => {
    setUploading(true);
    setModalFile(file.name);
    setModalStatus("uploading");

    try {
      // Step 1: Create thread
      const threadName = file.name.split(".")[0];
      const res = await axios.post(
        `${API}/thread/?name=${encodeURIComponent(threadName)}`,  // ✅
        {},
        authHeaders()
      );
      const newThreadId = res.data.thread_id;

      // Step 2: Upload PDF
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await axios.post(
        `${API}/documents/upload?thread_id=${newThreadId}`,       // ✅
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            ...authHeaders().headers,
          },
        }
      );

      // Step 3: Success modal
      setModalChunks(uploadRes.data.chunks_indexed);
      setModalStatus("success");
      setTimeout(() => setModalStatus(null), 2500);

      // Step 4: Update state + URL
      await refreshThreads();
      addPdfBubble(newThreadId, file.name);
      skipNextFetch.current = true;
      setActiveThreadId(newThreadId);
      setCurrentPdfName(file.name);
      navigate(`/chat/${newThreadId}`);

      // Step 5: AI acknowledgment
      await new Promise(r => setTimeout(r, 600));
      setMessages(prev => [...prev, {
        role:    "ai",
        content:
          `✅ **${file.name}** uploaded successfully!\n\n` +
          `💬 You can now ask me anything about **${file.name}**.\n` +
          `📌 I will answer strictly from the document content.`
      }]);

    } catch (error) {
      setModalStatus("error");
      setTimeout(() => setModalStatus(null), 3000);
      const errMsg =
        error.response?.data?.detail?.message ||
        error.response?.data?.detail ||
        "Failed to upload PDF.";
      toast.error(errMsg, { duration: 3000 });
      setCurrentPdfName(null);
      setActiveThreadId(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading || uploading) return;
    if (!activeThreadId) {
      toast.error("Please upload a PDF first!");
      return;
    }

    setLoading(true);
    const userMsg = input.trim();
    setInput("");

    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setMessages(prev => [...prev, { role: "ai", content: "" }]);

    try {
      const response = await fetch(`${API}/chat/stream`, {  // ✅
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id":    user?.id || "",
        },
        body: JSON.stringify({
          message:   userMsg,
          thread_id: activeThreadId,
        }),
      });

      if (!response.ok) throw new Error("Stream request failed");

      const reader  = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text  = decoder.decode(value, { stream: true });
        const lines = text.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done) break;
            if (json.chunk) {
              setMessages(prev => {
                const updated = [...prev];
                const last    = updated[updated.length - 1];
                if (last?.role === "ai") {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + json.chunk,
                  };
                }
                return updated;
              });
            }
          } catch (e) {
            // skip malformed chunk
          }
        }
      }

    } catch (error) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role:    "ai",
          content: "An error occurred. Please try again.",
        };
        return updated;
      });
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <UploadModal
        status={modalStatus}
        filename={modalFile}
        chunks={modalChunks}
      />

      <div className="w-full px-6 pb-6 pt-2">
        <div className="max-w-3xl mx-auto w-full">

          {uploading && (
            <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 w-fit mb-3 px-4 py-2 rounded-xl">
              <Loader2 size={14} className="text-blue-400 animate-spin shrink-0" />
              <span className="text-xs text-blue-300">Uploading & indexing PDF...</span>
            </div>
          )}

          <div className={`bg-[#2f2f2f] border rounded-2xl px-5 py-4 flex items-end gap-4 shadow-xl transition-all ${
            uploading
              ? "border-blue-500/40"
              : activeThreadId
              ? "border-green-500/30 focus-within:border-green-500/50"
              : "border-white/10 focus-within:border-blue-500/50"
          }`}>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="application/pdf"
              className="hidden"
            />

            <button
              type="button"
              onClick={() => !uploading && fileInputRef.current.click()}
              disabled={uploading}
              className={`p-2 rounded-lg transition-colors shrink-0 mb-0.5 ${
                uploading
                  ? "text-blue-400 cursor-not-allowed"
                  : activeThreadId
                  ? "text-green-400 hover:text-green-300"
                  : "text-gray-500 hover:text-white hover:bg-white/10"
              }`}
            >
              {uploading
                ? <Loader2 size={22} className="animate-spin" />
                : <Paperclip size={22} />
              }
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
              disabled={uploading}
              placeholder={
                uploading
                  ? "Please wait, uploading PDF..."
                  : activeThreadId
                  ? "Ask me anything about your PDF..."
                  : "Upload a PDF to start chatting..."
              }
              className={`flex-1 bg-transparent border-none outline-none text-base text-white resize-none max-h-44 py-1.5 leading-7 custom-scrollbar transition-all ${
                uploading
                  ? "placeholder-blue-400/50 cursor-not-allowed"
                  : "placeholder-gray-500"
              }`}
              onInput={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 176) + "px";
              }}
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() || loading || uploading}
              className={`p-2 rounded-lg transition-all shrink-0 mb-0.5 ${
                input.trim() && !loading && !uploading
                  ? "bg-white text-black hover:bg-gray-200"
                  : "text-gray-600 cursor-not-allowed"
              }`}
            >
              {loading
                ? <Loader2 size={20} className="animate-spin" />
                : <Send size={20} />
              }
            </button>
          </div>

          <p className="text-center text-xs mt-2">
            {uploading ? (
              <span className="text-blue-400/60">Indexing your PDF, please wait...</span>
            ) : activeThreadId ? (
              <span className="text-green-500/60">PDF ready — ask anything!</span>
            ) : (
              <span className="text-gray-600">AI Orbit answers strictly from uploaded PDFs only.</span>
            )}
          </p>
        </div>
      </div>
    </>
  );
};

export default PromptSection;