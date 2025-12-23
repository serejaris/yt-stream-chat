import { google, youtube_v3 } from "googleapis";

export function createYoutubeClient(apiKey: string) {
  return google.youtube({ version: "v3", auth: apiKey });
}

// Re-export efficient methods from lib (3 units instead of 100 for search.list)
export {
  getActiveLiveBroadcastEfficient,
  getChannelVideosEfficient,
  getUploadsPlaylistId,
  getRecentVideosFromPlaylist,
  findActiveLiveBroadcast,
} from "../../lib/youtube-api";

export async function getLiveChatId(youtube: youtube_v3.Youtube, videoId: string) {
  const response = await youtube.videos.list({
    part: ["liveStreamingDetails"],
    id: [videoId],
  });
  return response.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
}

export async function fetchMessages(
  youtube: youtube_v3.Youtube,
  liveChatId: string,
  pageToken?: string
) {
  const response = await youtube.liveChatMessages.list({
    liveChatId,
    part: ["id", "snippet", "authorDetails"],
    pageToken,
  });
  return response.data;
}

export function formatMessage(item: youtube_v3.Schema$LiveChatMessage) {
  const time = item.snippet?.publishedAt
    ? new Date(item.snippet.publishedAt).toLocaleTimeString("ru-RU", { hour12: false })
    : "";
  const author = item.authorDetails?.displayName ?? "Неизвестный автор";
  const text = item.snippet?.displayMessage ?? "";
  const messageId = item.id ?? "";
  const publishedAt = item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : new Date();
  return { time, author, text, messageId, publishedAt };
}
