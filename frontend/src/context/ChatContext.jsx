import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false); // Added for better UI

  //  fetch all threads
  const fetchThreads = async () => {
    setLoadingThreads(true);
    try {
      const response = await axios.get('http://localhost:8000/thread/thread-all');
      setThreads(response.data);
    } catch (error) {
      console.error("Error fetching threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  };

  //  fetch messages for the active thread
  const fetchMessages = async (id) => {
    if (!id) return;
    setLoadingMessages(true);
    try {
      const response = await axios.get(`http://localhost:8000/thread/${id}/messages`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchThreads();
  }, []);

  // Update messages whenever active thread changes
  useEffect(() => {
    if (activeThreadId) {
      fetchMessages(activeThreadId);
    } else {
      setMessages([]);
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
      refreshThreads: fetchThreads,
    }}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);