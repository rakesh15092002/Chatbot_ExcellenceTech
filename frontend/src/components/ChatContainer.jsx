import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useChat } from '../context/ChatContext';
import { FileText } from 'lucide-react';
import ChatNavbar from './ChatNavbar';
import PromptSection from './PromptSection';
import WelcomeScreen from './WelcomeScreen';

// ─────────────────────────────────────────────
// PDF Bubble
// ─────────────────────────────────────────────
const PdfBubble = ({ filename }) => (
  <div className="flex items-center gap-3 bg-[#2f2f2f] border border-white/10
                  rounded-2xl px-4 py-3 max-w-[220px]">
    <div className="bg-red-500/20 p-2 rounded-lg">
      <FileText size={20} className="text-red-400" />
    </div>
    <div className="flex flex-col overflow-hidden">
      <span className="text-white text-xs font-medium truncate max-w-[130px]">
        {filename}
      </span>
      <span className="text-gray-400 text-[10px] mt-0.5">PDF • Uploaded</span>
    </div>
  </div>
);

const isPdfMessage    = (content) => typeof content === "string" && content.startsWith("📎 ");
const extractFilename = (content) => content.replace("📎 ", "").trim();

// ─────────────────────────────────────────────
// ChatContainer
// ─────────────────────────────────────────────
const ChatContainer = ({ toggleSidebar }) => {
  const { activeThreadId, messages, fetchMessages } = useChat();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (activeThreadId) fetchMessages(activeThreadId);
  }, [activeThreadId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const hasMessages = messages.length > 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121] min-w-0">

      {/* Navbar */}
      <ChatNavbar toggleSidebar={toggleSidebar} />

      {hasMessages ? (
        // ─── Chat Mode — messages + prompt at bottom ───
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'user' && isPdfMessage(msg.content) ? (
                    <PdfBubble filename={extractFilename(msg.content)} />
                  ) : (
                    <div className={`max-w-[90%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-[#2f2f2f] text-white'
                        : 'bg-transparent text-gray-100'
                    }`}>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter
                                  style={vscDarkPlus}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
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
          </div>

          {/* ✅ Prompt at BOTTOM when chatting */}
          <PromptSection />
        </>

      ) : (
        // ─── Welcome Mode — centered prompt ───
        <div className="flex-1 flex flex-col items-center justify-center px-4">

          {/* Welcome text */}
          <WelcomeScreen />

          {/* ✅ Prompt CENTERED below welcome */}
          <div className="w-full max-w-2xl mt-6">
            <PromptSection />
          </div>

        </div>
      )}

    </div>
  );
};

export default ChatContainer;