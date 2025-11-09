import dotenv from "dotenv";
import { youtube_v3 } from "googleapis";
import { createYoutubeClient, fetchMessages, formatMessage, getLiveBroadcasts, getLiveChatId } from "./utils/youtube-api";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  throw new Error("YOUTUBE_API_KEY отсутствует в окружении");
}

const youtube = createYoutubeClient(apiKey);
const channelHandle = process.env.YOUTUBE_CHANNEL_HANDLE ?? "@serejaris";

async function getChannelIdByHandle(handle: string): Promise<string | null> {
  const cleanHandle = handle.startsWith("@") ? handle : `@${handle}`;
  try {
    const response = await youtube.channels.list({
      part: ["id"],
      forHandle: cleanHandle,
    } as youtube_v3.Params$Resource$Channels$List);
    return response.data.items?.[0]?.id || null;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Ошибка при поиске handle ${cleanHandle}:`, error.message);
    }
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
    channelId,
    type: ["video"],
    order: "date",
    maxResults,
  } as youtube_v3.Params$Resource$Search$List);
  return response.data?.items || [];
}

async function testChannel() {
  try {
    const safeApiKey = apiKey as string;
    console.log(`Тестирование канала ${channelHandle}...\n`);
    console.log(`API ключ: ${safeApiKey.substring(0, 10)}...\n`);

    const channelId = await getChannelIdByHandle(channelHandle);

    if (!channelId) {
      throw new Error(`Не удалось найти канал с handle: ${channelHandle}`);
    }

    console.log(`✅ Канал найден! Channel ID: ${channelId}\n`);

    console.log("=== Информация о канале ===");
    const channelData = await getChannelData(channelId);
    if (channelData) {
      console.log("Название:", channelData.snippet?.title);
      console.log("Описание:", channelData.snippet?.description?.substring(0, 100) + "...");
      console.log("Подписчиков:", channelData.statistics?.subscriberCount);
      console.log("Всего видео:", channelData.statistics?.videoCount);
      console.log("Просмотров:", channelData.statistics?.viewCount);
      console.log("Дата создания:", channelData.snippet?.publishedAt);
      console.log("Ссылка:", `https://www.youtube.com/channel/${channelId}`);
    }

    console.log("\n=== Последние видео ===");
    const videos = await getChannelVideos(channelId, 5);
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

    console.log("\n=== Поиск активной трансляции ===");
    const liveBroadcasts = await getLiveBroadcasts(youtube, channelId);
    if (liveBroadcasts.length === 0) {
      console.log("❌ Активных трансляций не найдено");
      console.log("\n✅ Тест завершен. API работает корректно, но трансляций нет.");
      return;
    }

    const firstLiveVideo = liveBroadcasts[0];
    const videoId = firstLiveVideo.id?.videoId;
    if (!videoId) {
      throw new Error("Не удалось получить ID видео трансляции");
    }

    console.log(`Найдена трансляция: ${firstLiveVideo.snippet?.title}`);
    console.log(`ID видео: ${videoId}`);

    console.log("\n=== Получение Live Chat ID ===");
    const chatId = await getLiveChatId(youtube, videoId);
    if (!chatId) {
      console.log("❌ Не удалось получить Live Chat ID");
      console.log("Возможно, трансляция не имеет активного чата или чат отключен");
      return;
    }

    console.log(`✅ Live Chat ID найден: ${chatId}`);

    console.log("\n=== Тестирование получения сообщений ===");
    const messagesData = await fetchMessages(youtube, chatId);
    const messages = messagesData.items || [];

    if (messages.length === 0) {
      console.log("Сообщений в чате пока нет");
    } else {
      console.log(`Найдено сообщений: ${messages.length}\n`);
      messages.forEach((item: any) => {
        const formatted = formatMessage(item);
        const pieces = [formatted.time, formatted.author, formatted.text].filter(Boolean);
        if (pieces.length > 0) {
          console.log(pieces.join(" | "));
        }
      });
    }

    console.log("\n✅ Тест успешно завершен! Live Chat ID извлечен и сообщения получены.");
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Ошибка:", error.message);
    } else {
      console.error("❌ Неизвестная ошибка:", error);
    }
    process.exit(1);
  }
}

testChannel();
