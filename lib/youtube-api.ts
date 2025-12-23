import { google, youtube_v3 } from "googleapis";
import { logApiRequest } from "./api-logger";

export function createYoutubeClient(apiKey: string) {
  return google.youtube({ version: "v3", auth: apiKey });
}

export async function getLiveBroadcasts(youtube: youtube_v3.Youtube, channelId: string) {
  const startTime = Date.now();
  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      channelId,
      type: ["video"],
      eventType: "live",
      maxResults: 10,
    } as any);
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getLiveBroadcasts",
      "search.list",
      { channelId, eventType: "live", maxResults: 10 },
      "success",
      responseTime
    );
    return response.data?.items ?? [];
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getLiveBroadcasts",
      "search.list",
      { channelId, eventType: "live", maxResults: 10 },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function getLiveChatId(youtube: youtube_v3.Youtube, videoId: string) {
  const startTime = Date.now();
  try {
    const response = await youtube.videos.list({
      part: ["liveStreamingDetails"],
      id: [videoId],
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getLiveChatId",
      "videos.list",
      { videoId },
      "success",
      responseTime
    );
    return response.data.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getLiveChatId",
      "videos.list",
      { videoId },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function fetchMessages(
  youtube: youtube_v3.Youtube,
  liveChatId: string,
  pageToken?: string
) {
  const startTime = Date.now();
  try {
    const response = await youtube.liveChatMessages.list({
      liveChatId,
      part: ["id", "snippet", "authorDetails"],
      pageToken,
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "fetchMessages",
      "liveChatMessages.list",
      { liveChatId, hasPageToken: !!pageToken },
      "success",
      responseTime
    );
    return response.data;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "fetchMessages",
      "liveChatMessages.list",
      { liveChatId, hasPageToken: !!pageToken },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
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
  const startTime = Date.now();
  try {
    const response = await youtube.channels.list({
      part: ["snippet", "statistics"],
      id: [channelId],
    });
    
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getChannelStats",
      "channels.list",
      { channelId },
      "success",
      responseTime
    );
    
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
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getChannelStats",
      "channels.list",
      { channelId },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function getChannelVideos(youtube: youtube_v3.Youtube, channelId: string, maxResults: number = 50) {
  const startTime = Date.now();
  try {
    const response = await youtube.search.list({
      part: ["snippet"],
      channelId,
      type: ["video"],
      order: "date",
      maxResults,
    } as any);
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getChannelVideos",
      "search.list",
      { channelId, maxResults },
      "success",
      responseTime
    );
    return response.data?.items ?? [];
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getChannelVideos",
      "search.list",
      { channelId, maxResults },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function getVideosDetails(youtube: youtube_v3.Youtube, videoIds: string[]) {
  if (videoIds.length === 0) return [];
  
  const startTime = Date.now();
  try {
    const response = await youtube.videos.list({
      part: ["snippet"],
      id: videoIds,
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getVideosDetails",
      "videos.list",
      { videoCount: videoIds.length },
      "success",
      responseTime
    );
    return response.data?.items ?? [];
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getVideosDetails",
      "videos.list",
      { videoCount: videoIds.length },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

export async function getChannelVideosWithDetails(youtube: youtube_v3.Youtube, channelId: string, maxResults: number = 50) {
  const searchResults = await getChannelVideos(youtube, channelId, maxResults);
  
  if (searchResults.length === 0) {
    return [];
  }
  
  const videoIds = searchResults
    .map((item) => item.id?.videoId)
    .filter((id): id is string => !!id);
  
  if (videoIds.length === 0) {
    return [];
  }
  
  const videosDetails = await getVideosDetails(youtube, videoIds);
  
  return videosDetails.map((video) => ({
    id: video.id ?? "",
    title: video.snippet?.title ?? "",
    description: video.snippet?.description ?? "",
    publishedAt: video.snippet?.publishedAt ?? "",
    thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
    channelId: video.snippet?.channelId ?? "",
    channelTitle: video.snippet?.channelTitle ?? "",
  }));
}

