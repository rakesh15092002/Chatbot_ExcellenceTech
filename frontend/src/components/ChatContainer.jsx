import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
// 1. Add these imports
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'; 
import { useChat } from '../context/ChatContext'; 
import ChatNavbar from './ChatNavbar';
import PromptSection from './PromptSection';

const ChatContainer = () => {
  const { activeThreadId, messages, fetchMessages } = useChat();
  const scrollRef = useRef(null);

  useEffect(() => {
    if (activeThreadId) fetchMessages(activeThreadId);
  }, [activeThreadId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#212121]">
      <ChatNavbar />
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:px-[5%] lg:px-[10%] space-y-6 pb-40">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[95%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-[#2f2f2f]' : 'bg-transparent'}`}>
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  // 2. Add the components prop to handle syntax highlighting
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
          </div>
        ))}
      </div>
      <PromptSection />
    </div>
  );
};

export default ChatContainer;