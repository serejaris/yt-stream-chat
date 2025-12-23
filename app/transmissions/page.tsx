"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Navigation from "@/components/Navigation";
import styles from "./page.module.css";
import { logEmitter } from "@/lib/api-logger-client";

interface Message {
  time: string;
  author: string;
  text: string;
}

interface OverlayMessage {
  id: string;
  author: string;
  message: string;
  timestamp: number;
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
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("monitoringEnabled");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [apiActivity, setApiActivity] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [overlayMessage, setOverlayMessage] = useState<OverlayMessage | null>(null);
  const [activeMessageIndex, setActiveMessageIndex] = useState<number | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const checkStreamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef<number>(5000);
  const isMountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const checkForStreamRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("monitoringEnabled", String(isMonitoringEnabled));
    }
  }, [isMonitoringEnabled]);

  // Listen for API activity
  useEffect(() => {
    const handleApiLog = () => {
      setApiActivity(true);
      setTimeout(() => setApiActivity(false), 1000);
    };

    logEmitter.on("newLog", handleApiLog);
    return () => {
      logEmitter.off("newLog", handleApiLog);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setLiveChatId(null);
    setVideoId(null);
    setStreamTitle("");
    setMessages([]);
  }, []);

  const startStreaming = useCallback(
    (payload: { liveChatId: string; videoId: string; title?: string }) => {
      if (!isMountedRef.current || !isMonitoringEnabled || document.hidden) {
        return;
      }

      const chatId = payload.liveChatId;
      const vidId = payload.videoId;

      setLiveChatId(chatId);
      setVideoId(vidId);
      setStreamTitle(payload.title ?? "");
      setStreamStatus("Чат подключен");
      setPollingStatus("Получение сообщений...");
      setPollingError(false);
      setIsError(false);
      setErrorDetails(null);

      if (chatId && vidId) {
        const url = `/api/messages/stream?liveChatId=${encodeURIComponent(chatId)}&videoId=${encodeURIComponent(vidId)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          if (!isMountedRef.current) return;
          try {
            const data = JSON.parse(event.data);
            if (data.messages && Array.isArray(data.messages)) {
              setMessages((prev) => [...prev, ...data.messages]);
              setPollingStatus(
                "Последнее обновление: " +
                  new Date().toLocaleTimeString("ru-RU", { hour12: false })
              );
              setPollingError(false);
              setErrorDetails(null);
            }
            if (data.error) {
              setPollingStatus("Ошибка получения сообщений");
              setPollingError(true);
              setErrorDetails(data.error);
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          if (!isMountedRef.current) return;
          setPollingStatus("Ошибка подключения");
          setPollingError(true);
          eventSource.close();
          eventSourceRef.current = null;

          if (isMonitoringEnabled && !document.hidden && isMountedRef.current && checkForStreamRef.current) {
            checkStreamTimerRef.current = setTimeout(() => {
              checkForStreamRef.current?.();
            }, 5000);
          }
        };
      }
    },
    [isMonitoringEnabled]
  );

  const scheduleNextCheck = useCallback(() => {
    if (checkStreamTimerRef.current) {
      clearTimeout(checkStreamTimerRef.current);
      checkStreamTimerRef.current = null;
    }

    if (
      isMonitoringEnabled &&
      !document.hidden &&
      isMountedRef.current &&
      !eventSourceRef.current &&
      checkForStreamRef.current
    ) {
      checkStreamTimerRef.current = setTimeout(() => {
        checkForStreamRef.current?.();
      }, retryDelayRef.current);
    }
  }, [isMonitoringEnabled]);

  const checkForStream = useCallback(async () => {
    if (!isMonitoringEnabled || document.hidden || !isMountedRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setStreamStatus("Поиск трансляции...");
      setPollingStatus("Проверка...");
      setIsError(false);
      setErrorDetails(null);

      const response = await fetch("/api/live-chat-id", {
        signal: abortControllerRef.current.signal,
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "live chat id not found");
      }

      retryDelayRef.current = 5000;
      startStreaming(payload);
    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }

      if (!isMountedRef.current) return;

      const errorMessage = error.message || "Неизвестная ошибка";
      setStreamStatus("Нет активной трансляции");
      setPollingStatus("Ожидание трансляции");
      setIsError(true);
      setPollingError(true);
      setErrorDetails(errorMessage);

      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      scheduleNextCheck();
    }
  }, [isMonitoringEnabled, startStreaming, scheduleNextCheck]);

  useEffect(() => {
    checkForStreamRef.current = checkForStream;
  }, [checkForStream]);

  const showInOverlay = useCallback(async (message: Message, index: number) => {
    try {
      const response = await fetch("/api/overlay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `${index}-${Date.now()}`,
          author: message.author,
          message: message.text,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setOverlayMessage(data.overlay);
        setActiveMessageIndex(index);
      }
    } catch (error) {
      console.error("Failed to show in overlay:", error);
    }
  }, []);

  const clearOverlay = useCallback(async () => {
    try {
      const response = await fetch("/api/overlay", { method: "DELETE" });
      if (response.ok) {
        setOverlayMessage(null);
        setActiveMessageIndex(null);
      }
    } catch (error) {
      console.error("Failed to clear overlay:", error);
    }
  }, []);

  const toggleMonitoring = useCallback(() => {
    const newValue = !isMonitoringEnabled;
    setIsMonitoringEnabled(newValue);

    if (!newValue) {
      stopStreaming();
      if (checkStreamTimerRef.current) {
        clearTimeout(checkStreamTimerRef.current);
        checkStreamTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setStreamStatus("Мониторинг выключен");
      setPollingStatus("Ожидание...");
    } else {
      retryDelayRef.current = 5000;
      if (checkForStreamRef.current) {
        checkForStreamRef.current();
      }
    }
  }, [isMonitoringEnabled, stopStreaming]);

  useEffect(() => {
    isMountedRef.current = true;

    if (isMonitoringEnabled && checkForStreamRef.current) {
      checkForStreamRef.current();
    }

    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (checkStreamTimerRef.current) {
        clearTimeout(checkStreamTimerRef.current);
        checkStreamTimerRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isMonitoringEnabled]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
        if (checkStreamTimerRef.current) {
          clearTimeout(checkStreamTimerRef.current);
          checkStreamTimerRef.current = null;
        }
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
      } else if (isMonitoringEnabled && isMountedRef.current && checkForStreamRef.current) {
        retryDelayRef.current = 5000;
        checkForStreamRef.current();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isMonitoringEnabled, checkForStream]);

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
          <button
            onClick={toggleMonitoring}
            type="button"
            className={isMonitoringEnabled ? styles.monitoringActive : styles.monitoringInactive}
          >
            {isMonitoringEnabled ? "Выключить мониторинг" : "Включить мониторинг"}
          </button>
          <button onClick={() => checkForStreamRef.current?.()} type="button">
            Обновить
          </button>
        </div>
      </header>
      <div className={styles.overlayPanel}>
        <div className={styles.overlayStatus}>
          {overlayMessage ? (
            <>
              <span className={styles.overlayActive}>В оверлее:</span>
              <span className={styles.overlayAuthor}>{overlayMessage.author}</span>
            </>
          ) : (
            <span className={styles.overlayEmpty}>Оверлей пуст</span>
          )}
        </div>
        {overlayMessage && (
          <button onClick={clearOverlay} className={styles.clearOverlayBtn} type="button">
            Убрать из оверлея
          </button>
        )}
      </div>
      <main className={styles.content}>
        <ul className={styles.messages}>
          {messages.map((message, index) => (
            <li key={index} className={`${styles.message} ${activeMessageIndex === index ? styles.messageActive : ""}`}>
              <time>{message.time}</time>
              <strong>{message.author}</strong>
              <button
                onClick={() => showInOverlay(message, index)}
                className={styles.overlayBtn}
                type="button"
                title="Показать в оверлее"
              >
                📺
              </button>
              <p>{message.text}</p>
            </li>
          ))}
          <div ref={messagesEndRef} />
        </ul>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerStatus}>
          <span className={pollingError ? styles.statusError : ""}>{pollingStatus}</span>
          {errorDetails && (
            <span className={styles.errorDetails}>{errorDetails}</span>
          )}
        </div>
        <span className={styles.apiIndicator}>
          <span className={`${styles.apiDot} ${apiActivity ? styles.apiActive : ""}`} />
          API
        </span>
      </footer>
    </div>
  );
}
