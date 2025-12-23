import dotenv from "dotenv";
import { google } from "googleapis";
import {
  getActiveLiveBroadcastEfficient,
  getChannelVideosEfficient,
} from "./utils/youtube-api";

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

    console.log("\n=== Последние видео (efficient: 3 units) ===");
    const videos = await getChannelVideosEfficient(youtube, targetChannelId, 5);
    if (videos.length > 0) {
      videos.forEach((video, index: number) => {
        console.log(`${index + 1}. ${video.title}`);
        console.log(`   Опубликовано: ${video.publishedAt}`);
        console.log(`   ID видео: ${video.id}`);
        console.log();
      });
    } else {
      console.log("Видео не найдены");
    }

    console.log("=== Активные трансляции (efficient: 3 units) ===");
    const liveBroadcast = await getActiveLiveBroadcastEfficient(youtube, targetChannelId);
    if (liveBroadcast) {
      console.log(`1. ${liveBroadcast.title}`);
      console.log(`   ID видео: ${liveBroadcast.videoId}`);
      console.log(`   Live Chat ID: ${liveBroadcast.liveChatId}`);
    } else {
      console.log("Активных трансляций нет");
    }

    // Note: getUpcomingBroadcasts removed - efficient method focuses on active broadcasts only
    console.log("\n=== Предстоящие трансляции ===");
    console.log("(Проверка предстоящих трансляций отключена для экономии квоты)");

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

