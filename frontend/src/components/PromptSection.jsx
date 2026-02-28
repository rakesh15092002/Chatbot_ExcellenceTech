import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useChat } from '../context/ChatContext'; 
import { Send, Paperclip, Loader2, X, FileText } from 'lucide-react';

const PromptSection = () => {
  const { 
    activeThreadId, 
    setActiveThreadId, 
    setMessages, 
    refreshThreads 
  } = useChat();

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    // Check for PDF type as enforced by backend
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
    } else if (file) {
      alert("Only PDF files are supported.");
      e.target.value = null;
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading) return;
    setLoading(true);

    let currentThreadId = activeThreadId;

    try {
      // 1. Create thread if it doesn't exist (First Message/File)
      if (!currentThreadId) {
        const threadName = input.trim() 
          ? input.split(" ").slice(0, 3).join(" ") 
          : (selectedFile ? selectedFile.name.split('.')[0] : "New Chat");
        
        const res = await axios.post(`http://localhost:8000/thread/?name=${encodeURIComponent(threadName)}`);
        currentThreadId = res.data.thread_id;
        
        // Sync Context so other components know the active thread
        setActiveThreadId(currentThreadId);
        refreshThreads(); 
      }

      // 2. Handle File Upload if a file exists
      if (selectedFile) {
        const fileData = new FormData();
        fileData.append("file", selectedFile);
        
        // Post to /documents/upload with thread_id as Query parameter
        await axios.post(
          `http://localhost:8000/documents/upload?thread_id=${currentThreadId}`, 
          fileData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
      }

      // 3. Update UI Optimistically
      const userMsg = { 
        role: 'user', 
        content: input + (selectedFile ? `\n\n[Attached File: ${selectedFile.name}]` : "") 
      };
      setMessages(prev => [...prev, userMsg]);
      
      const messageToSend = input || "Please analyze the uploaded document.";
      setInput("");
      setSelectedFile(null);

      // 4. Hit the Backend Chat Endpoint
      const chatRes = await axios.post(`http://localhost:8000/chat/send`, {
        message: messageToSend,
        thread_id: currentThreadId
      });

      // 5. Update UI with AI Reply
      setMessages(prev => [...prev, { role: 'ai', content: chatRes.data.reply }]);

    } catch (error) {
      console.error("Operation Error:", error);
      const errorMsg = error.response?.data?.detail || "An error occurred. Please try again.";
      setMessages(prev => [...prev, { role: 'ai', content: `System Error: ${errorMsg}` }]);
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
            <span className="text-[11px] text-gray-300 truncate max-w-[150px]">{selectedFile.name}</span>
            <button onClick={() => setSelectedFile(null)} className="text-gray-500 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
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
            className={`p-2 mb-1 rounded-lg transition-colors ${selectedFile ? 'text-blue-400' : 'text-gray-400 hover:text-white'}`}
          >
            <Paperclip size={20} />
          </button>
          
          <textarea 
            rows="1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask Excellence AI..."
            className="flex-1 bg-transparent border-none outline-none py-3 text-sm text-white resize-none max-h-40 custom-scrollbar"
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
          />

          <button 
            onClick={handleSend}
            disabled={(!input.trim() && !selectedFile) || loading}
            className={`p-2 mb-1 rounded-lg transition-all ${ (input.trim() || selectedFile) ? 'bg-white text-black hover:bg-gray-200' : 'text-gray-600'}`}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptSection;