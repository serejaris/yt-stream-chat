import { google, youtube_v3 } from "googleapis";

export function createYoutubeClient(apiKey: string) {
  return google.youtube({ version: "v3", auth: apiKey });
}

export async function getLiveBroadcasts(youtube: youtube_v3.Youtube, channelId: string) {
  const response = await youtube.search.list({
    part: ["snippet"],
    channelId,
    type: ["video"],
    eventType: "live",
    maxResults: 10,
  } as any);
  return response.data?.items ?? [];
}

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

export async function getChannelStats(youtube: youtube_v3.Youtube, channelId: string) {
  const response = await youtube.channels.list({
    part: ["snippet", "statistics"],
    id: [channelId],
  });
  
  const channel = response.data.items?.[0];
  if (!channel) {
    return null;
  }
  
  return {
    title: channel.snippet?.title ?? "",
    description: channel.snippet?.description ?? "",
    subscriberCount: channel.statistics?.subscriberCount ?? "0",
    videoCount: channel.statistics?.videoCount ?? "0",
    viewCount: channel.statistics?.viewCount ?? "0",
  };
}

