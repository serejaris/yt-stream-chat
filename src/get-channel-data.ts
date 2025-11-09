import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;
const channelId = process.env.YOUTUBE_CHANNEL_ID;
const channelUsername = process.env.YOUTUBE_CHANNEL_USERNAME;
const channelHandle = process.env.YOUTUBE_CHANNEL_HANDLE;

if (!apiKey) {
  throw new Error("YOUTUBE_API_KEY отсутствует в окружении");
}

const youtube = google.youtube({ version: "v3", auth: apiKey });

async function getChannelIdByHandle(handle: string): Promise<string | null> {
  try {
    const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
    const response = await youtube.channels.list({
      part: ["id"],
      forHandle: cleanHandle,
    } as any);
    return response.data.items?.[0]?.id || null;
  } catch (error) {
    return null;
  }
}

async function getChannelIdByUsername(username: string): Promise<string | null> {
  try {
    const response = await youtube.channels.list({
      part: ["id"],
      forUsername: username,
    });
    return response.data.items?.[0]?.id || null;
  } catch (error) {
    return null;
  }
}

async function getChannelData(channelId: string) {
  const response = await youtube.channels.list({
    part: ["snippet", "statistics", "contentDetails"],
    id: [channelId],
  });
  return response.data.items?.[0];
}

async function getChannelVideos(channelId: string, maxResults: number = 10) {
  const response = await youtube.search.list({
    part: ["snippet"],
    channelId: channelId,
    type: "video",
    order: "date",
    maxResults: maxResults,
  } as any);
  return response.data?.items || [];
}

async function getLiveBroadcasts(channelId: string) {
  const response = await youtube.search.list({
    part: ["snippet"],
    channelId: channelId,
    type: "video",
    eventType: "live",
    maxResults: 10,
  } as any);
  return response.data?.items || [];
}

async function getUpcomingBroadcasts(channelId: string) {
  const response = await youtube.search.list({
    part: ["snippet"],
    channelId: channelId,
    type: "video",
    eventType: "upcoming",
    maxResults: 10,
  } as any);
  return response.data?.items || [];
}

async function run() {
  try {
    console.log("Получение данных канала...\n");

    let targetChannelId: string | undefined = channelId;

    if (!targetChannelId && channelHandle) {
      console.log(`Поиск канала по handle: ${channelHandle}`);
      const foundId = await getChannelIdByHandle(channelHandle);
      if (!foundId) {
        throw new Error(`Не удалось найти канал с handle: ${channelHandle}`);
      }
      targetChannelId = foundId;
      console.log(`Найден channel ID: ${targetChannelId}\n`);
    }

    if (!targetChannelId && channelUsername) {
      console.log(`Поиск канала по username: ${channelUsername}`);
      const foundId = await getChannelIdByUsername(channelUsername);
      if (!foundId) {
        throw new Error(`Не удалось найти канал с username: ${channelUsername}`);
      }
      targetChannelId = foundId;
      console.log(`Найден channel ID: ${targetChannelId}\n`);
    }

    if (!targetChannelId) {
      throw new Error("Укажите YOUTUBE_CHANNEL_ID, YOUTUBE_CHANNEL_HANDLE или YOUTUBE_CHANNEL_USERNAME в .env файле");
    }

    console.log("=== Информация о канале ===");
    const channelData = await getChannelData(targetChannelId);
    if (channelData) {
      console.log("Название:", channelData.snippet?.title);
      console.log("Описание:", channelData.snippet?.description?.substring(0, 100) + "...");
      console.log("Подписчиков:", channelData.statistics?.subscriberCount);
      console.log("Всего видео:", channelData.statistics?.videoCount);
      console.log("Просмотров:", channelData.statistics?.viewCount);
      console.log("Дата создания:", channelData.snippet?.publishedAt);
      console.log("Ссылка:", `https://www.youtube.com/channel/${targetChannelId}`);
    }

    console.log("\n=== Последние видео ===");
    const videos = await getChannelVideos(targetChannelId, 5);
    if (videos.length > 0) {
      videos.forEach((video: any, index: number) => {
        console.log(`${index + 1}. ${video.snippet?.title}`);
        console.log(`   Опубликовано: ${video.snippet?.publishedAt}`);
        console.log(`   ID видео: ${video.id?.videoId}`);
        console.log();
      });
    } else {
      console.log("Видео не найдены");
    }

    console.log("=== Активные трансляции ===");
    const liveBroadcasts = await getLiveBroadcasts(targetChannelId);
    if (liveBroadcasts.length > 0) {
      liveBroadcasts.forEach((broadcast: any, index: number) => {
        console.log(`${index + 1}. ${broadcast.snippet?.title}`);
        console.log(`   ID видео: ${broadcast.id?.videoId}`);
        console.log(`   Начало: ${broadcast.snippet?.publishedAt}`);
        console.log();
      });
    } else {
      console.log("Активных трансляций нет");
    }

    console.log("=== Предстоящие трансляции ===");
    const upcomingBroadcasts = await getUpcomingBroadcasts(targetChannelId);
    if (upcomingBroadcasts.length > 0) {
      upcomingBroadcasts.forEach((broadcast: any, index: number) => {
        console.log(`${index + 1}. ${broadcast.snippet?.title}`);
        console.log(`   ID видео: ${broadcast.id?.videoId}`);
        console.log(`   Запланировано: ${broadcast.snippet?.publishedAt}`);
        console.log();
      });
    } else {
      console.log("Предстоящих трансляций нет");
    }

  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Ошибка:", error.message);
    } else {
      console.error("❌ Неизвестная ошибка:", error);
    }
    process.exit(1);
  }
}

run();

