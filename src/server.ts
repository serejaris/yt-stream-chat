import path from "path";
import express from "express";
import dotenv from "dotenv";
import { createYoutubeClient, fetchMessages, formatMessage, getLiveBroadcasts, getLiveChatId } from "./utils/youtube-api";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;
const channelId = process.env.YOUTUBE_CHANNEL_ID;
const port = Number(process.env.PORT ?? 3000);

if (!apiKey) {
  throw new Error("YOUTUBE_API_KEY отсутствует в окружении");
}

if (!channelId) {
  throw new Error("YOUTUBE_CHANNEL_ID отсутствует в окружении");
}

const app = express();
const youtube = createYoutubeClient(apiKey);
const publicDir = path.resolve(__dirname, "..", "public");

app.get("/api/live-chat-id", async (_, res) => {
  try {
    const broadcasts = await getLiveBroadcasts(youtube, channelId);
    const liveVideo = broadcasts.find((item) => item.id?.videoId);
    if (!liveVideo?.id?.videoId) {
      res.status(404).json({ error: "Активная трансляция не найдена" });
      return;
    }
    const liveChatId = await getLiveChatId(youtube, liveVideo.id.videoId);
    if (!liveChatId) {
      res.status(404).json({ error: "Live Chat ID не найден" });
      return;
    }
    res.json({
      liveChatId,
      videoId: liveVideo.id.videoId,
      title: liveVideo.snippet?.title ?? "",
      scheduledStartTime: liveVideo.snippet?.publishedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    res.status(500).json({ error: message });
  }
});

app.get("/api/messages", async (req, res) => {
  const liveChatId = req.query.liveChatId;
  const pageToken = req.query.pageToken;
  if (typeof liveChatId !== "string" || liveChatId.length === 0) {
    res.status(400).json({ error: "Параметр liveChatId обязателен" });
    return;
  }
  try {
    const data = await fetchMessages(youtube, liveChatId, typeof pageToken === "string" ? pageToken : undefined);
    const items = data.items ?? [];
    res.json({
      messages: items.map((item) => formatMessage(item)),
      nextPageToken: data.nextPageToken ?? null,
      pollingIntervalMillis: data.pollingIntervalMillis ?? 2000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    res.status(500).json({ error: message });
  }
});

app.use(express.static(publicDir));

app.get("*", (_, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
