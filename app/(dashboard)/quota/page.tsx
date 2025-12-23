"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import styles from "./page.module.css";

interface QuotaStats {
  today: {
    used: number;
    limit: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    count: number;
    cost: number;
  }>;
}

interface LogEntry {
  id: number;
  timestamp: string;
  endpointType: string;
  quotaCost: number;
}

export default function QuotaPage() {
  const [stats, setStats] = useState<QuotaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessionTotal, setSessionTotal] = useState(0);
  const [since, setSince] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const url = since
        ? `/api/quota/activity?since=${encodeURIComponent(since)}`
        : "/api/quota/activity";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch logs");
      const data = await response.json();
      setLogs(data.logs);
      setSessionTotal(data.sessionTotal);
    } catch (err) {
      console.error("Error fetching logs:", err);
    }
  }, [since]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/quota");
        if (!response.ok) {
          throw new Error("Не удалось загрузить статистику квоты");
        }
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    // Connect to SSE stream
    const eventSource = new EventSource("/api/quota/activity/stream");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const newLog: LogEntry = JSON.parse(event.data);

        // Check if log should be included based on since filter
        if (since && new Date(newLog.timestamp) <= new Date(since)) {
          return;
        }

        setLogs((prev) => {
          // Avoid duplicates
          if (prev.some((log) => log.id === newLog.id)) {
            return prev;
          }
          return [newLog, ...prev];
        });
        setSessionTotal((prev) => prev + newLog.quotaCost);

        // Update main stats too
        setStats((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            today: {
              ...prev.today,
              used: prev.today.used + newLog.quotaCost,
            },
          };
        });
      } catch (err) {
        // Ignore parse errors (heartbeats, etc.)
      }
    };

    eventSource.onerror = () => {
      // Reconnect on error
      eventSource.close();
      setTimeout(() => {
        eventSourceRef.current = new EventSource("/api/quota/activity/stream");
      }, 5000);
    };

    return () => {
      eventSource.close();
    };
  }, [since]);

  const handleResetSession = () => {
    const now = new Date().toISOString();
    setSince(now);
    setLogs([]);
    setSessionTotal(0);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("ru-RU");
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getPercentage = () => {
    if (!stats) return 0;
    return Math.round((stats.today.used / stats.today.limit) * 100);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Использование API Квоты</h1>
        <p className={styles.description}>Мониторинг лимитов YouTube Data API v3</p>
      </header>

      {loading && (
        <div className={styles.loadingCard}>
          <div className={styles.spinner} />
          <span>Получение данных...</span>
        </div>
      )}

      {error && (
        <div className={styles.errorCard}>
          <span className={styles.errorIcon}>⚠️</span>
          <div className={styles.errorText}>
            <strong>Ошибка загрузки</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {stats && (
        <>
          <div className={styles.grid}>
            <div className={`${styles.card} ${styles.mainCard}`}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Общий расход</h2>
                <span className={getPercentage() > 80 ? "badge badge-error" : "badge badge-success"}>
                  {getPercentage()}% использовано
                </span>
              </div>

              <div className={styles.progressContainer}>
                <div className={styles.progressHeader}>
                  <span className={styles.usedValue}>{formatNumber(stats.today.used)}</span>
                  <span className={styles.limitValue}>из {formatNumber(stats.today.limit)}</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{
                      width: `${getPercentage()}%`,
                      backgroundColor: getPercentage() > 80 ? "var(--error)" : "var(--accent)"
                    }}
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Детализация по операциям</h2>
              <div className={styles.tableWrapper}>
                {stats.byEndpoint.length === 0 ? (
                  <div className={styles.emptyTable}>Нет активности за последние 24 часа</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Метод API</th>
                        <th className={styles.textRight}>Вызовы</th>
                        <th className={styles.textRight}>Единиц</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byEndpoint.map((row) => (
                        <tr key={row.endpoint}>
                          <td className={styles.endpointCol}>
                            <code>{row.endpoint}</code>
                          </td>
                          <td className={styles.textRight}>{row.count}</td>
                          <td className={`${styles.textRight} ${styles.costCol}`}>
                            {formatNumber(row.cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.logHeader}>
              <div className={styles.logTitleRow}>
                <h2 className={styles.cardTitle}>Лог запросов</h2>
                <span className={styles.sessionBadge}>
                  Сессия: {formatNumber(sessionTotal)} ед.
                </span>
              </div>
              <button onClick={handleResetSession} className={styles.resetButton}>
                Сброс
              </button>
            </div>

            <div className={styles.logList}>
              {logs.length === 0 ? (
                <div className={styles.emptyLog}>
                  {since ? "Нет запросов с начала сессии" : "Нет запросов за сегодня"}
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className={styles.logEntry}>
                    <span className={styles.logTime}>{formatTime(log.timestamp)}</span>
                    <code className={styles.logEndpoint}>{log.endpointType}</code>
                    <span className={styles.logCost}>{log.quotaCost} ед.</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
