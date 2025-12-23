import { NextRequest, NextResponse } from "next/server";
import { createYoutubeClient, getLiveBroadcasts, getLiveChatId } from "@/lib/youtube-api";

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY отсутствует в окружении" }, { status: 500 });
  }

  if (!channelId) {
    return NextResponse.json({ error: "YOUTUBE_CHANNEL_ID отсутствует в окружении" }, { status: 500 });
  }

  try {
    const youtube = createYoutubeClient(apiKey);
    const broadcasts = await getLiveBroadcasts(youtube, channelId);
    const liveVideo = broadcasts.find((item) => item.id?.videoId);
    
    if (!liveVideo?.id?.videoId) {
      return NextResponse.json({ error: "Активная трансляция не найдена" }, { status: 404 });
    }
    
    const liveChatId = await getLiveChatId(youtube, liveVideo.id.videoId);
    if (!liveChatId) {
      return NextResponse.json({ error: "Live Chat ID не найден" }, { status: 404 });
    }
    
    return NextResponse.json({
      liveChatId,
      videoId: liveVideo.id.videoId,
      title: liveVideo.snippet?.title ?? "",
      scheduledStartTime: liveVideo.snippet?.publishedAt ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}





