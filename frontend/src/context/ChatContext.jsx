import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/clerk-react';  // ✅

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useUser();  // ✅ get logged in user

  const [threads, setThreads]                 = useState([]);
  const [activeThreadId, setActiveThreadId]   = useState(null);
  const [messages, setMessages]               = useState([]);
  const [localPdfBubbles, setLocalPdfBubbles] = useState({});
  const [loadingThreads, setLoadingThreads]   = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ✅ Helper — always send user_id in headers
  const authHeaders = () => ({
    headers: { "x-user-id": user?.id || "" }
  });

  const fetchThreads = async () => {
    if (!user) return;  // ✅ don't fetch if not logged in
    setLoadingThreads(true);
    try {
      const response = await axios.get(
        'http://localhost:8000/thread/thread-all',
        authHeaders()  // ✅
      );
      setThreads(response.data);
    } catch (error) {
      console.error("Error fetching threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  };

  const fetchMessages = async (id) => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const response    = await axios.get(
        `http://localhost:8000/thread/${id}/messages`,
        authHeaders()  // ✅
      );
      const backendMsgs = response.data.messages || [];

      setLocalPdfBubbles(prev => {
        const pdfBubbles = prev[id] || [];
        setMessages([...pdfBubbles, ...backendMsgs]);
        return prev;
      });

    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const addPdfBubble = (threadId, filename) => {
    const pdfMsg = {
      role:    "user",
      content: `📎 ${filename}`,
      isPdf:   true,
    };
    setLocalPdfBubbles(prev => ({
      ...prev,
      [threadId]: [...(prev[threadId] || []), pdfMsg],
    }));
    setMessages(prev => [...prev, pdfMsg]);
  };

  const deleteThread = async (threadId) => {
    try {
      await axios.delete(
        `http://localhost:8000/thread/${threadId}`,
        authHeaders()  // ✅
      );
      setThreads(prev => prev.filter(t => t.thread_id !== threadId));
      setLocalPdfBubbles(prev => {
        const updated = { ...prev };
        delete updated[threadId];
        return updated;
      });
      if (activeThreadId === threadId) {
        setActiveThreadId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  // ✅ Fetch threads when user logs in
  useEffect(() => {
    if (user) fetchThreads();
  }, [user]);

  useEffect(() => {
    if (activeThreadId) {
      const timer = setTimeout(() => {
        fetchMessages(activeThreadId);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setMessages([]);
    }
  }, [activeThreadId]);

  // ✅ Expose authHeaders for PromptSection
  return (
    <ChatContext.Provider value={{
      threads,
      activeThreadId,
      setActiveThreadId,
      messages,
      setMessages,
      loadingThreads,
      loadingMessages,
      fetchMessages,
      refreshThreads: fetchThreads,
      addPdfBubble,
      deleteThread,
      authHeaders,    // ✅ expose so PromptSection can use it
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);