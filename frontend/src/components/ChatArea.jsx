import React, { useState, useRef, useEffect } from "react";

export default function ChatArea() {
  const [messages, setMessages] = useState([
    { id: 1, text: "Hello! How can I help you?", sender: "bot" },
  ]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { id: Date.now(), text: input, sender: "user" }]);
    setInput("");
  };

  const handlePdfUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Please upload a PDF file!");
      return;
    }
    setMessages([
      ...messages,
      { id: Date.now(), text: file.name, sender: "user", type: "pdf", file },
    ]);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-xl shadow-md overflow-hidden">
      {/* Chat Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.type === "pdf" ? (
              <a
                href={URL.createObjectURL(msg.file)}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-2 rounded-xl max-w-xs break-words flex items-center gap-2 transition ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white hover:bg-blue-600 shadow-md"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
              >
                📄 <span className="truncate">{msg.text}</span>
              </a>
            ) : (
              <div
                className={`px-4 py-2 rounded-xl max-w-xs break-words shadow-sm transition ${
                  msg.sender === "user"
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-gray-200 text-gray-900 hover:bg-gray-300"
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input + Symbol Buttons */}
      <div className="p-4 border-t border-gray-200 flex items-center gap-3 bg-white">
        {/* Circular + Symbol for PDF upload */}
        <div className="relative">
          <label className="w-12 h-12 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center cursor-pointer text-3xl font-bold shadow-md transition-transform hover:scale-105">
            +
            <input
              type="file"
              accept="application/pdf"
              onChange={handlePdfUpload}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </label>
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition placeholder-gray-400 text-gray-900"
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />

        {/* Send symbol (paper plane) */}
        <button
          onClick={handleSend}
          className={`w-12 h-12 flex items-center justify-center text-white rounded-full shadow-md transition-transform hover:scale-105
            ${input.trim() ? "bg-blue-500 hover:bg-blue-600" : "bg-gray-300 cursor-not-allowed"}`}
          disabled={!input.trim()}
          title="Send"
        >
          ✈️
        </button>
      </div>
    </div>
  );
}