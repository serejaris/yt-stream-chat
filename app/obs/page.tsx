"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

const FEED_MESSAGE_ANIMATION_TIME = 300;
const MAX_FEED_MESSAGES = 5;

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
  const modeRef = useRef(mode);
  const [feedMessages, setFeedMessages] = useState<FeedMessage[]>([]);
  const feedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Mode switcher visibility
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const switcherTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    modeRef.current = mode;
  }, [mode]);

  // Mouse movement handler for switcher visibility
  useEffect(() => {
    const handleMouseMove = () => {
      setSwitcherVisible(true);

      if (switcherTimerRef.current) {
        clearTimeout(switcherTimerRef.current);
      }

      switcherTimerRef.current = setTimeout(() => {
        setSwitcherVisible(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (switcherTimerRef.current) {
        clearTimeout(switcherTimerRef.current);
      }
    };
  }, []);

  // Clear feed messages and timers when switching to manual mode
  useEffect(() => {
    if (mode === "manual") {
      setFeedMessages([]);
      feedTimersRef.current.forEach((timer) => clearTimeout(timer));
      feedTimersRef.current.clear();
    }
  }, [mode]);

  // Polling for overlay messages (manual mode only)
  useEffect(() => {
    if (mode !== "manual") return;

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
  }, [mode]);

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

  const addFeedMessage = useCallback((author: string, text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    const newMessage: FeedMessage = {
      id,
      author,
      text,
      createdAt: Date.now(),
    };

    setFeedMessages((prev) => {
      const newMessages = [...prev, newMessage];
      // Keep only last MAX_FEED_MESSAGES, mark overflow as exiting for animation
      if (newMessages.length > MAX_FEED_MESSAGES) {
        const toRemove = newMessages.length - MAX_FEED_MESSAGES;
        // Mark first N as exiting, keep rest
        return newMessages.slice(toRemove);
      }
      return newMessages;
    });
  }, []);

  const stopStreaming = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setMessages([]);
  }, []);

  const startStreaming = useCallback(
    (payload: { liveChatId: string; videoId: string }) => {
      if (!isMountedRef.current || !isMonitoringEnabled) {
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
              data.messages.forEach((msg: Message) => {
                appendMessage(msg);
                // Add to feed if in feed mode
                if (modeRef.current === "feed") {
                  addFeedMessage(msg.author, msg.text);
                }
              });
            }
          } catch (error) {
            console.error("Failed to parse SSE message:", error);
          }
        };

        eventSource.onerror = () => {
          if (!isMountedRef.current) return;
          eventSource.close();
          eventSourceRef.current = null;

          if (isMonitoringEnabled && isMountedRef.current && checkForStreamRef.current) {
            checkStreamTimerRef.current = setTimeout(() => {
              checkForStreamRef.current?.();
            }, 5000);
          }
        };
      }
    },
    [isMonitoringEnabled, addFeedMessage]
  );

  const scheduleNextCheck = useCallback(() => {
    if (checkStreamTimerRef.current) {
      clearTimeout(checkStreamTimerRef.current);
      checkStreamTimerRef.current = null;
    }

    if (
      isMonitoringEnabled &&
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
    if (!isMonitoringEnabled || !isMountedRef.current) {
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
      if (switcherTimerRef.current) {
        clearTimeout(switcherTimerRef.current);
        switcherTimerRef.current = null;
      }
      // Clean up all feed message timers
      feedTimersRef.current.forEach((timer) => clearTimeout(timer));
      feedTimersRef.current.clear();
    };
  }, [isMonitoringEnabled]);

  return (
    <div className={styles.container}>
      {/* Mode switcher */}
      <div className={`${styles.modeSwitcher} ${!switcherVisible ? styles.modeSwitcherHidden : ''}`}>
        <button
          className={`${styles.modeButton} ${mode === "feed" ? styles.modeButtonActive : ''}`}
          onClick={() => setMode("feed")}
        >
          Лента
        </button>
        <button
          className={`${styles.modeButton} ${mode === "manual" ? styles.modeButtonActive : ''}`}
          onClick={() => setMode("manual")}
        >
          Ручной
        </button>
      </div>

      {/* Feed mode */}
      {mode === "feed" && (
        <div className={styles.feed}>
          {feedMessages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.feedMessage} ${msg.exiting ? styles.feedMessageExiting : ''}`}
            >
              <div className={styles.feedAuthor}>{msg.author}</div>
              <div className={styles.feedText}>{msg.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Manual mode */}
      {mode === "manual" && overlayMessage && (
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
