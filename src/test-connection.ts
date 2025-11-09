import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;

if (!apiKey) {
  throw new Error("YOUTUBE_API_KEY отсутствует в окружении");
}

const youtube = google.youtube({ version: "v3", auth: apiKey });

async function testConnection() {
  try {
    console.log("Проверка подключения к YouTube API...");
    console.log("API ключ:", apiKey!.substring(0, 10) + "...");
    
    const response = await youtube.videos.list({
      part: ["snippet"],
      chart: "mostPopular",
      maxResults: 1,
      regionCode: "RU",
    });

    if (response.data.items && response.data.items.length > 0) {
      const video = response.data.items[0];
      console.log("✅ Подключение успешно!");
      console.log("Тестовое видео:", video.snippet?.title);
      console.log("Канал:", video.snippet?.channelTitle);
      console.log("API работает корректно.");
    } else {
      console.log("⚠️ Подключение установлено, но данные не получены.");
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("❌ Ошибка подключения:", error.message);
      if (error.message.includes("API key")) {
        console.error("Проверьте правильность API ключа.");
      }
    } else {
      console.error("❌ Неизвестная ошибка:", error);
    }
    process.exit(1);
  }
}

testConnection();

