"use client";

import { useEffect, useState, useRef } from "react";
import Navigation from "@/components/Navigation";
import styles from "./page.module.css";

interface Message {
  time: string;
  author: string;
  text: string;
}

export default function TransmissionsPage() {
  const [liveChatId, setLiveChatId] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [streamStatus, setStreamStatus] = useState("Поиск трансляции...");
  const [pollingStatus, setPollingStatus] = useState("Ожидание...");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isError, setIsError] = useState(false);
  const [pollingError, setPollingError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initialize = async () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setMessages([]);
    setStreamTitle("");
    setLiveChatId(null);
    setVideoId(null);

    try {
      const response = await fetch("/api/live-chat-id");
      if (!response.ok) {
        throw new Error("live chat id not found");
      }
      const payload = await response.json();
      const chatId = payload.liveChatId;
      const vidId = payload.videoId;
      
      setLiveChatId(chatId);
      setVideoId(vidId);
      setStreamTitle(payload.title ?? "");
      setStreamStatus("Чат подключен");
      setPollingStatus("Получение сообщений...");
      setPollingError(false);
      setIsError(false);
      
      if (chatId && vidId) {
        const url = `/api/messages/stream?liveChatId=${encodeURIComponent(chatId)}&videoId=${encodeURIComponent(vidId)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.messages && Array.isArray(data.messages)) {
              setMessages((prev) => [...prev, ...data.messages]);
              setPollingStatus("Последнее обновление: " + new Date().toLocaleTimeString("ru-RU", { hour12: false }));
              setPollingError(false);
            }
            if (data.error) {
              setPollingStatus("Ошибка получения сообщений");
              setPollingError(true);
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          setPollingStatus("Ошибка подключения");
          setPollingError(true);
          eventSource.close();
          setTimeout(initialize, 5000);
        };
      }
    } catch (error) {
      setStreamStatus("Нет активной трансляции");
      setPollingStatus("Ожидание трансляции");
      setIsError(true);
      setPollingError(true);
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
    <div className={styles.layout}>
      <Navigation />
      <header className={styles.header}>
        <div className={styles.streamInfo}>
          <span className={`${styles.streamStatus} ${isError ? styles.statusError : ""}`}>
            {streamStatus}
          </span>
          <h1 className={styles.streamTitle}>{streamTitle}</h1>
        </div>
        <div className={styles.controls}>
          <button onClick={initialize} type="button">
            Обновить
          </button>
        </div>
      </header>
      <main className={styles.content}>
        <ul className={styles.messages}>
          {messages.map((message, index) => (
            <li key={index} className={styles.message}>
              <time>{message.time}</time>
              <strong>{message.author}</strong>
              <p>{message.text}</p>
            </li>
          ))}
          <div ref={messagesEndRef} />
        </ul>
      </main>
      <footer className={styles.footer}>
        <span className={pollingError ? styles.statusError : ""}>{pollingStatus}</span>
      </footer>
    </div>
  );
}

