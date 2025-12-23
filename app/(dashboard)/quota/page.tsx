"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

interface QuotaStats {
  today: {
    used: number;
    limit: number;
    requests: number;
    errors: number;
    errorRate: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    count: number;
    cost: number;
    errors: number;
  }>;
  hourly: Array<{
    hour: number;
    cost: number;
  }>;
}

export default function QuotaPage() {
  const [stats, setStats] = useState<QuotaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("ru-RU");
  };

  const getPercentage = () => {
    if (!stats) return 0;
    return Math.round((stats.today.used / stats.today.limit) * 100);
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 80) return "var(--error)";
    if (percentage >= 50) return "var(--warning, #f59e0b)";
    return "var(--accent)";
  };

  const getStatusBadge = (percentage: number) => {
    if (percentage >= 80) return { class: "badge-error", text: "Критично" };
    if (percentage >= 50) return { class: "badge-warning", text: "Внимание" };
    return { class: "badge-success", text: "Норма" };
  };

  const maxHourlyCost = stats?.hourly?.length
    ? Math.max(...stats.hourly.map((h) => h.cost), 1)
    : 1;

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
        <div className={styles.grid}>
          {/* Warning banner */}
          {getPercentage() >= 50 && (
            <div
              className={styles.warningBanner}
              style={{
                backgroundColor:
                  getPercentage() >= 80
                    ? "rgba(239, 68, 68, 0.1)"
                    : "rgba(245, 158, 11, 0.1)",
                borderColor:
                  getPercentage() >= 80 ? "var(--error)" : "var(--warning, #f59e0b)",
              }}
            >
              <span className={styles.warningIcon}>
                {getPercentage() >= 80 ? "🚨" : "⚠️"}
              </span>
              <div>
                <strong>
                  {getPercentage() >= 80
                    ? "Критический уровень использования!"
                    : "Повышенное использование квоты"}
                </strong>
                <p>
                  {getPercentage() >= 80
                    ? "API запросы могут быть заблокированы при достижении 80% лимита."
                    : "Рекомендуется снизить частоту запросов."}
                </p>
              </div>
            </div>
          )}

          {/* Main stats card */}
          <div className={`${styles.card} ${styles.mainCard}`}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Общий расход</h2>
              <span
                className={`badge ${getStatusBadge(getPercentage()).class}`}
                style={{
                  backgroundColor:
                    getPercentage() >= 80
                      ? "rgba(239, 68, 68, 0.2)"
                      : getPercentage() >= 50
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(34, 197, 94, 0.2)",
                  color: getStatusColor(getPercentage()),
                }}
              >
                {getPercentage()}% — {getStatusBadge(getPercentage()).text}
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
                    width: `${Math.min(getPercentage(), 100)}%`,
                    backgroundColor: getStatusColor(getPercentage()),
                  }}
                />
                {/* 50% and 80% markers */}
                <div className={styles.marker} style={{ left: "50%" }} title="50% - предупреждение" />
                <div className={styles.marker} style={{ left: "80%" }} title="80% - блокировка" />
              </div>
            </div>

            {/* Quick stats */}
            <div className={styles.quickStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Запросов</span>
                <span className={styles.statValue}>{formatNumber(stats.today.requests)}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Ошибок</span>
                <span
                  className={styles.statValue}
                  style={{ color: stats.today.errors > 0 ? "var(--error)" : undefined }}
                >
                  {stats.today.errors} ({stats.today.errorRate}%)
                </span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Осталось</span>
                <span className={styles.statValue}>
                  {formatNumber(stats.today.limit - stats.today.used)}
                </span>
              </div>
            </div>
          </div>

          {/* Hourly chart */}
          {stats.hourly.length > 0 && (
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>Расход по часам</h2>
              <div className={styles.chartContainer}>
                {stats.hourly.map((h) => (
                  <div key={h.hour} className={styles.chartBar}>
                    <div
                      className={styles.barFill}
                      style={{
                        height: `${(h.cost / maxHourlyCost) * 100}%`,
                        backgroundColor: getStatusColor(
                          (h.cost / (stats.today.limit / 24)) * 100
                        ),
                      }}
                      title={`${h.hour}:00 — ${formatNumber(h.cost)} единиц`}
                    />
                    <span className={styles.barLabel}>{h.hour}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Endpoint breakdown */}
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
                      <th className={styles.textRight}>Ошибки</th>
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
                        <td
                          className={styles.textRight}
                          style={{ color: row.errors > 0 ? "var(--error)" : undefined }}
                        >
                          {row.errors}
                        </td>
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
      )}
    </div>
  );
}
