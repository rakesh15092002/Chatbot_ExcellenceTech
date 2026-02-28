import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useChat } from '../context/ChatContext';
import { FileText } from 'lucide-react'; // ✅ add this
import ChatNavbar from './ChatNavbar';
import PromptSection from './PromptSection';

// ─────────────────────────────────────────────
// ✅ PDF Bubble Component — shows on RIGHT side
// ─────────────────────────────────────────────
const PdfBubble = ({ filename }) => (
  <div className="flex items-center gap-3 bg-[#2f2f2f] border border-white/10 
                  rounded-2xl px-4 py-3 max-w-[220px]">
    {/* PDF Icon */}
    <div className="bg-red-500/20 p-2 rounded-lg">
      <FileText size={20} className="text-red-400" />
    </div>

    {/* File Info */}
    <div className="flex flex-col overflow-hidden">
      <span className="text-white text-xs font-medium truncate max-w-[130px]">
        {filename}
      </span>
      <span className="text-gray-400 text-[10px] mt-0.5">PDF • Uploaded</span>
    </div>
  </div>
);

// ─────────────────────────────────────────────
// ✅ Check if message is a PDF acknowledgment
// ─────────────────────────────────────────────
const isPdfMessage = (content) => {
  return typeof content === "string" && content.startsWith("📎 ");
};

const extractFilename = (content) => {
  return content.replace("📎 ", "").trim();
};

// ─────────────────────────────────────────────
// Main ChatContainer
// ─────────────────────────────────────────────
const ChatContainer = () => {
  const { activeThreadId, messages, fetchMessages } = useChat();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (activeThreadId) fetchMessages(activeThreadId);
  }, [activeThreadId]);

  // ✅ Auto scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121]">
      <ChatNavbar />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:px-[5%] lg:px-[10%] space-y-6 pb-40"
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* ✅ PDF bubble — user side (right) */}
            {msg.role === "user" && isPdfMessage(msg.content) ? (
              <PdfBubble filename={extractFilename(msg.content)} />

            ) : (
              /* ✅ Normal text bubble */
              <div
                className={`max-w-[95%] p-4 rounded-2xl ${
                  msg.role === "user" ? "bg-[#2f2f2f]" : "bg-transparent"
                }`}
              >
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        return !inline && match ? (
                          <SyntaxHighlighter
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, "")}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {msg.content || msg.reply}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <PromptSection />
    </div>
  );
};

export default ChatContainer;