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

// =============================================================================
// QUOTA-EFFICIENT FUNCTIONS (1 unit each instead of 100)
// =============================================================================

/**
 * Get uploads playlist ID for a channel (1 quota unit)
 * Uses channels.list instead of search.list
 */
export async function getUploadsPlaylistId(youtube: youtube_v3.Youtube, channelId: string): Promise<string | null> {
  const startTime = Date.now();
  try {
    const response = await youtube.channels.list({
      part: ["contentDetails"],
      id: [channelId],
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getUploadsPlaylistId",
      "channels.list",
      { channelId },
      "success",
      responseTime
    );
    return response.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getUploadsPlaylistId",
      "channels.list",
      { channelId },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Get recent videos from uploads playlist (1 quota unit)
 * Uses playlistItems.list instead of search.list
 */
export async function getRecentVideosFromPlaylist(
  youtube: youtube_v3.Youtube,
  playlistId: string,
  maxResults: number = 10
): Promise<string[]> {
  const startTime = Date.now();
  try {
    const response = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId,
      maxResults,
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getRecentVideosFromPlaylist",
      "playlistItems.list",
      { playlistId, maxResults },
      "success",
      responseTime
    );
    return response.data.items
      ?.map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => !!id) ?? [];
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "getRecentVideosFromPlaylist",
      "playlistItems.list",
      { playlistId, maxResults },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Find active live broadcast from video IDs (1 quota unit)
 * Uses videos.list with liveStreamingDetails instead of search.list
 */
export async function findActiveLiveBroadcast(
  youtube: youtube_v3.Youtube,
  videoIds: string[]
): Promise<{ videoId: string; title: string; liveChatId: string | null } | null> {
  if (videoIds.length === 0) return null;

  const startTime = Date.now();
  try {
    const response = await youtube.videos.list({
      part: ["snippet", "liveStreamingDetails"],
      id: videoIds,
    });
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "findActiveLiveBroadcast",
      "videos.list",
      { videoCount: videoIds.length },
      "success",
      responseTime
    );

    const liveVideo = response.data.items?.find(
      (video) => video.liveStreamingDetails?.activeLiveChatId
    );

    if (!liveVideo) return null;

    return {
      videoId: liveVideo.id ?? "",
      title: liveVideo.snippet?.title ?? "",
      liveChatId: liveVideo.liveStreamingDetails?.activeLiveChatId ?? null,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    await logApiRequest(
      "findActiveLiveBroadcast",
      "videos.list",
      { videoCount: videoIds.length },
      "error",
      responseTime,
      error instanceof Error ? error.message : "Unknown error"
    );
    throw error;
  }
}

/**
 * Get active live broadcast efficiently (3 quota units total)
 * Replaces getLiveBroadcasts which uses search.list (100 units)
 */
export async function getActiveLiveBroadcastEfficient(
  youtube: youtube_v3.Youtube,
  channelId: string
): Promise<{ videoId: string; title: string; liveChatId: string } | null> {
  // Step 1: Get uploads playlist ID (1 unit)
  const uploadsPlaylistId = await getUploadsPlaylistId(youtube, channelId);
  if (!uploadsPlaylistId) return null;

  // Step 2: Get recent videos from playlist (1 unit)
  const recentVideoIds = await getRecentVideosFromPlaylist(youtube, uploadsPlaylistId, 10);
  if (recentVideoIds.length === 0) return null;

  // Step 3: Find active live broadcast (1 unit)
  const liveBroadcast = await findActiveLiveBroadcast(youtube, recentVideoIds);
  if (!liveBroadcast?.liveChatId) return null;

  return {
    videoId: liveBroadcast.videoId,
    title: liveBroadcast.title,
    liveChatId: liveBroadcast.liveChatId,
  };
}

/**
 * Get channel videos efficiently (2 quota units total)
 * Replaces getChannelVideosWithDetails which uses search.list (100+ units)
 */
export async function getChannelVideosEfficient(
  youtube: youtube_v3.Youtube,
  channelId: string,
  maxResults: number = 50
) {
  // Step 1: Get uploads playlist ID (1 unit)
  const uploadsPlaylistId = await getUploadsPlaylistId(youtube, channelId);
  if (!uploadsPlaylistId) return [];

  // Step 2: Get video IDs from playlist (1 unit)
  const videoIds = await getRecentVideosFromPlaylist(youtube, uploadsPlaylistId, maxResults);
  if (videoIds.length === 0) return [];

  // Step 3: Get video details (1 unit)
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

