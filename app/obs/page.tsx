"use client";

import { useEffect, useState, useRef } from "react";
import styles from "./page.module.css";

interface Message {
  time: string;
  author: string;
  text: string;
}

export default function OBSPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const appendMessage = (message: Message) => {
    setMessages((prev) => {
      const updated = [...prev, message];
      const maxMessages = 50;
      return updated.slice(-maxMessages);
    });
  };

  const loadLiveChatId = async () => {
    try {
      const response = await fetch("/api/live-chat-id");
      if (!response.ok) {
        throw new Error("live chat id not found");
      }
      const payload = await response.json();
      return payload;
    } catch (error) {
      console.error("Failed to load live chat id:", error);
      throw error;
    }
  };

  const initialize = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setMessages([]);

    try {
      const { liveChatId, videoId } = await loadLiveChatId();
      if (liveChatId && videoId) {
        const url = `/api/messages/stream?liveChatId=${encodeURIComponent(liveChatId)}&videoId=${encodeURIComponent(videoId)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.messages && Array.isArray(data.messages)) {
              data.messages.forEach((msg: Message) => appendMessage(msg));
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          eventSource.close();
          setTimeout(initialize, 5000);
        };
      }
    } catch (error) {
      setTimeout(initialize, 5000);
    }
  };

  useEffect(() => {
    initialize();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className={styles.container}>
      <ul className={styles.messages}>
        {messages.map((message, index) => (
          <li key={index} className={styles.message}>
            <div className={styles.messageHeader}>
              <strong className={styles.messageAuthor}>{message.author}</strong>
              <span className={styles.messageTime}>{message.time}</span>
            </div>
            <p className={styles.messageText}>{message.text}</p>
          </li>
        ))}
        <div ref={messagesEndRef} />
      </ul>
    </div>
  );
}

