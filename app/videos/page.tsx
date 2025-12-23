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
    <div className={styles.layout}>
      <Navigation />
      <main className={styles.content}>
        <h1 className={styles.title}>Видео</h1>

        <div className={styles.actions}>
          <button
            className={styles.loadButton}
            onClick={fetchVideos}
            disabled={loading}
          >
            {loading ? "Загрузка..." : hasLoaded ? "Обновить список" : "Загрузить видео"}
          </button>
        </div>
        
        {error && <div className={styles.error}>{error}</div>}

        {!loading && hasLoaded && !error && videos.length === 0 && (
          <div className={styles.empty}>Видео не найдены</div>
        )}
        
        {!loading && !error && videos.length > 0 && (
          <div className={styles.grid}>
            {videos.map((video) => (
              <div key={video.id} className={styles.videoCard}>
                <div className={styles.thumbnailContainer}>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className={styles.thumbnail}
                  />
                </div>
                <div className={styles.videoInfo}>
                  <h3 className={styles.videoTitle}>{video.title}</h3>
                  <div className={styles.videoMeta}>
                    <span className={styles.publishedDate}>
                      {formatDate(video.publishedAt)}
                    </span>
                  </div>
                  <div className={styles.descriptionContainer}>
                    <label className={styles.descriptionLabel}>
                      Описание:
                    </label>
                    <textarea
                      className={styles.descriptionInput}
                      value={descriptions[video.id] || ""}
                      onChange={(e) =>
                        handleDescriptionChange(video.id, e.target.value)
                      }
                      placeholder="Введите описание видео..."
                      rows={6}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

