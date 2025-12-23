"use client";

import { useState } from "react";
import Navigation from "@/components/Navigation";
import styles from "./page.module.css";

interface Video {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  channelId: string;
  channelTitle: string;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchVideos = async () => {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/videos");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Не удалось загрузить видео");
      }

      setVideos(data.videos || []);

      const initialDescriptions: Record<string, string> = {};
      data.videos?.forEach((video: Video) => {
        initialDescriptions[video.id] = video.description || "";
      });
      setDescriptions(initialDescriptions);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleDescriptionChange = (videoId: string, value: string) => {
    setDescriptions((prev) => ({
      ...prev,
      [videoId]: value,
    }));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>Управление Видео</h1>
          <p className={styles.description}>Редактирование метаданных и обзор контента</p>
        </div>
        <button
          className={loading ? styles.btnLoading : styles.btnPrimary}
          onClick={fetchVideos}
          disabled={loading}
        >
          {loading ? "⏳ Загрузка..." : hasLoaded ? "🔄 Обновить" : "📥 Загрузить видео"}
        </button>
      </header>
      
      {error && (
        <div className={styles.errorCard}>
          <span className={styles.errorIcon}>⚠️</span>
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className={styles.loadingGrid}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      )}

      {!loading && hasLoaded && !error && videos.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎬</div>
          <p>Видео не найдены</p>
        </div>
      )}
      
      {!loading && !error && videos.length > 0 && (
        <div className={styles.grid}>
          {videos.map((video) => (
            <div key={video.id} className={styles.videoCard}>
              <div className={styles.thumbnailWrapper}>
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className={styles.thumbnail}
                />
                <div className={styles.dateBadge}>
                  {formatDate(video.publishedAt)}
                </div>
              </div>
              <div className={styles.videoContent}>
                <h3 className={styles.videoTitle} title={video.title}>
                  {video.title}
                </h3>
                
                <div className={styles.editorArea}>
                  <div className={styles.editorHeader}>
                    <span className={styles.editorLabel}>Описание</span>
                    <button className={styles.copyBtn} title="Копировать">📋</button>
                  </div>
                  <textarea
                    className={styles.textarea}
                    value={descriptions[video.id] || ""}
                    onChange={(e) =>
                      handleDescriptionChange(video.id, e.target.value)
                    }
                    placeholder="Описание видео..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

