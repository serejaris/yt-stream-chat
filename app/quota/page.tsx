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
    <div className={styles.layout}>
      <Navigation />
      <main className={styles.content}>
        <h1 className={styles.title}>Квота API</h1>

        {loading && <div className={styles.loading}>Загрузка...</div>}

        {error && <div className={styles.error}>{error}</div>}

        {stats && (
          <>
            <div className={styles.counter}>
              <div className={styles.counterLabel}>Использовано сегодня</div>
              <div className={styles.counterValue}>
                {formatNumber(stats.today.used)}{" "}
                <span>/ {formatNumber(stats.today.limit)} единиц</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${getPercentage()}%` }}
                />
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Расход по операциям</h2>
              {stats.byEndpoint.length === 0 ? (
                <div className={styles.empty}>Нет данных за сегодня</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Запросов</th>
                      <th>Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byEndpoint.map((row) => (
                      <tr key={row.endpoint}>
                        <td className={styles.endpoint}>{row.endpoint}</td>
                        <td className={styles.count}>{row.count}</td>
                        <td>{formatNumber(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
