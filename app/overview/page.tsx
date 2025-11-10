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
    <div className={styles.layout}>
      <Navigation />
      <main className={styles.content}>
        <h1 className={styles.title}>Обзор канала</h1>
        
        {loading && <div className={styles.loading}>Загрузка...</div>}
        
        {error && <div className={styles.error}>{error}</div>}
        
        {stats && (
          <div className={styles.stats}>
            <div className={styles.channelInfo}>
              <h2 className={styles.channelTitle}>{stats.title}</h2>
              {stats.description && (
                <p className={styles.channelDescription}>{stats.description}</p>
              )}
            </div>
            
            <div className={styles.metrics}>
              <div className={styles.metric}>
                <div className={styles.metricValue}>{formatNumber(stats.subscriberCount)}</div>
                <div className={styles.metricLabel}>Подписчиков</div>
              </div>
              
              <div className={styles.metric}>
                <div className={styles.metricValue}>{formatNumber(stats.viewCount)}</div>
                <div className={styles.metricLabel}>Просмотров</div>
              </div>
              
              <div className={styles.metric}>
                <div className={styles.metricValue}>{formatNumber(stats.videoCount)}</div>
                <div className={styles.metricLabel}>Видео</div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

