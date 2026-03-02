import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/clerk-react';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user } = useUser();

  const [threads, setThreads]                 = useState([]);
  const [activeThreadId, setActiveThreadId]   = useState(null);
  const [messages, setMessages]               = useState([]);
  const [localPdfBubbles, setLocalPdfBubbles] = useState({});
  const [loadingThreads, setLoadingThreads]   = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [currentPdfName, setCurrentPdfName]   = useState(null);

  const skipNextFetch = useRef(false);  // ✅ flag to skip fetch on new upload

  const authHeaders = () => ({
    headers: { "x-user-id": user?.id || "" }
  });

  const fetchThreads = async () => {
    if (!user) return;
    setLoadingThreads(true);
    try {
      const response = await axios.get(
        'http://localhost:8000/thread/thread-all',
        authHeaders()
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
        authHeaders()
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

  const fetchCurrentPdf = async (threadId) => {
    try {
      const res  = await axios.get(
        `http://localhost:8000/documents/?thread_id=${threadId}`,
        authHeaders()
      );
      const docs = res.data?.documents || [];
      if (docs.length > 0) {
        setCurrentPdfName(docs[0].filename);
      } else {
        setCurrentPdfName(null);
      }
    } catch (e) {
      setCurrentPdfName(null);
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
        authHeaders()
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
        setCurrentPdfName(null);
      }
    } catch (error) {
      console.error("Error deleting thread:", error);
    }
  };

  useEffect(() => {
    if (user) fetchThreads();
  }, [user]);

  useEffect(() => {
    if (activeThreadId) {
      // ✅ Skip fetch if flag is set (new upload — messages already in state)
      if (skipNextFetch.current) {
        skipNextFetch.current = false;
        return;
      }
      const timer = setTimeout(() => {
        fetchMessages(activeThreadId);
        fetchCurrentPdf(activeThreadId);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setMessages([]);
      setCurrentPdfName(null);
    }
  }, [activeThreadId]);

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
      refreshThreads:  fetchThreads,
      addPdfBubble,
      deleteThread,
      authHeaders,
      currentPdfName,
      setCurrentPdfName,
      skipNextFetch,    // ✅ expose ref
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);