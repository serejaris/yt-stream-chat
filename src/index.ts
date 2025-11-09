import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const apiKey = process.env.YOUTUBE_API_KEY;
const liveChatId = process.env.YOUTUBE_LIVE_CHAT_ID;

if (!apiKey) {
  throw new Error("YOUTUBE_API_KEY отсутствует в окружении");
}

if (!liveChatId) {
  throw new Error("YOUTUBE_LIVE_CHAT_ID отсутствует в окружении");
}

const youtube = google.youtube({ version: "v3", auth: apiKey });

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMessage(item: {
  snippet?: { publishedAt?: string | null; displayMessage?: string | null };
  authorDetails?: { displayName?: string | null };
}) {
  const time = item.snippet?.publishedAt
    ? new Date(item.snippet.publishedAt).toLocaleTimeString("ru-RU", { hour12: false })
    : "";
  const author = item.authorDetails?.displayName ?? "Неизвестный автор";
  const text = item.snippet?.displayMessage ?? "";
  return { time, author, text };
}

async function fetchMessages(pageToken?: string) {
  const response = await youtube.liveChatMessages.list({
    liveChatId,
    part: ["id", "snippet", "authorDetails"],
    pageToken,
  });
  return response.data;
}

async function run() {
  let pageToken: string | undefined;
  while (true) {
    const data = await fetchMessages(pageToken);
    const items = data.items ?? [];
    for (const item of items) {
      const formatted = formatMessage(item);
      const pieces = [formatted.time, formatted.author, formatted.text].filter(Boolean);
      if (pieces.length > 0) {
        console.log(pieces.join(" | "));
      }
    }
    pageToken = data.nextPageToken ?? pageToken;
    const delay = data.pollingIntervalMillis ?? 2000;
    await sleep(delay);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

