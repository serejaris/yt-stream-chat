"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
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
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("ru-RU");
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
      )}
    </div>
  );
}
