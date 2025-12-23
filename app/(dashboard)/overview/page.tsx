"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import styles from "./page.module.css";

interface ChannelStats {
  title: string;
  description: string;
  subscriberCount: string;
  videoCount: string;
  viewCount: string;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/channel-stats");
        if (!response.ok) {
          throw new Error("Не удалось загрузить статистику");
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

  const formatNumber = (num: string) => {
    const number = parseInt(num, 10);
    if (number >= 1000000) {
      return (number / 1000000).toFixed(1) + "M";
    }
    if (number >= 1000) {
      return (number / 1000).toFixed(1) + "K";
    }
    return number.toLocaleString("ru-RU");
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Обзор канала</h1>
        <p className={styles.description}>Основные показатели эффективности</p>
      </header>

      {loading && (
        <div className={styles.loadingGrid}>
          {[1, 2, 3].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {error && (
        <div className={styles.errorCard}>
          <p>{error}</p>
        </div>
      )}

      {stats && (
        <div className={styles.content}>
          <section className={styles.heroCard}>
            <div className={styles.heroInfo}>
              <h2 className={styles.channelName}>{stats.title}</h2>
              <p className={styles.channelBio}>{stats.description}</p>
            </div>
          </section>

          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>👥</div>
              <div className={styles.metricData}>
                <span className={styles.metricLabel}>Подписчики</span>
                <span className={styles.metricValue}>{formatNumber(stats.subscriberCount)}</span>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>👁️</div>
              <div className={styles.metricData}>
                <span className={styles.metricLabel}>Просмотры</span>
                <span className={styles.metricValue}>{formatNumber(stats.viewCount)}</span>
              </div>
            </div>

            <div className={styles.metricCard}>
              <div className={styles.metricIcon}>📹</div>
              <div className={styles.metricData}>
                <span className={styles.metricLabel}>Видео</span>
                <span className={styles.metricValue}>{formatNumber(stats.videoCount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}





