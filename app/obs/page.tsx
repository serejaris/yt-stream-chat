"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

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

interface FeedMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  exiting?: boolean;
}

export default function OBSPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [overlayMessage, setOverlayMessage] = useState<OverlayMessage | null>(null);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const lastOverlayIdRef = useRef<string | null>(null);
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("obsMonitoringEnabled");
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });

  // Feed mode state
  const [mode, setMode] = useState<"feed" | "manual">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("obsOverlayMode");
      return (saved === "feed" || saved === "manual") ? saved : "feed";
    }
    return "feed";
  });
  const [feedMessages, setFeedMessages] = useState<FeedMessage[]>([]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const checkStreamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const retryDelayRef = useRef<number>(5000);
  const isMountedRef = useRef<boolean>(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const checkForStreamRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obsMonitoringEnabled", String(isMonitoringEnabled));
    }
  }, [isMonitoringEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("obsOverlayMode", mode);
    }
  }, [mode]);

  // Polling for overlay messages
  useEffect(() => {
    const pollOverlay = async () => {
      try {
        const response = await fetch("/api/overlay");
        if (response.ok) {
          const data = await response.json();
          const newOverlay = data.overlay as OverlayMessage | null;

          if (newOverlay && newOverlay.id !== lastOverlayIdRef.current) {
            lastOverlayIdRef.current = newOverlay.id;
            setOverlayMessage(newOverlay);
            setDisplayedText("");
            setIsTyping(true);
            setIsVisible(true);
          } else if (!newOverlay && lastOverlayIdRef.current) {
            lastOverlayIdRef.current = null;
            setIsVisible(false);
            setTimeout(() => {
              setOverlayMessage(null);
              setDisplayedText("");
            }, 300);
          }
        }
      } catch (error) {
        console.error("Failed to fetch overlay:", error);
      }
    };

    pollOverlay();
    const interval = setInterval(pollOverlay, 1500);
    return () => clearInterval(interval);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!overlayMessage || !isTyping) return;

    const text = overlayMessage.message;
    let index = 0;

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [overlayMessage, isTyping]);

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

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setMessages([]);
  }, []);

  const startStreaming = useCallback(
    (payload: { liveChatId: string; videoId: string }) => {
      if (!isMountedRef.current || !isMonitoringEnabled || document.hidden) {
        return;
      }

      const { liveChatId, videoId } = payload;

      if (liveChatId && videoId) {
        const url = `/api/messages/stream?liveChatId=${encodeURIComponent(liveChatId)}&videoId=${encodeURIComponent(videoId)}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          if (!isMountedRef.current) return;
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
          if (!isMountedRef.current) return;
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
      const response = await fetch("/api/live-chat-id", {
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("live chat id not found");
      }

      const payload = await response.json();
      retryDelayRef.current = 5000;
      startStreaming(payload);
    } catch (error: any) {
      if (error.name === "AbortError") {
        return;
      }

      if (!isMountedRef.current) return;

      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 30000);
      scheduleNextCheck();
    }
  }, [isMonitoringEnabled, startStreaming, scheduleNextCheck]);

  useEffect(() => {
    checkForStreamRef.current = checkForStream;
  }, [checkForStream]);

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
  }, [isMonitoringEnabled]);

  return (
    <div className={styles.container}>
      {overlayMessage && (
        <div className={`${styles.overlay} ${isVisible ? styles.overlayVisible : styles.overlayHidden}`}>
          <div className={styles.overlayAuthor}>{overlayMessage.author}</div>
          <div className={styles.overlayText}>
            {displayedText}
            {isTyping && <span className={styles.cursor}>|</span>}
          </div>
        </div>
      )}
    </div>
  );
}
