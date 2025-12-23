import { NextRequest, NextResponse } from "next/server";
import { createYoutubeClient, getActiveLiveBroadcastEfficient } from "@/lib/youtube-api";

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
    // Uses 3 quota units instead of 101 (search.list=100 + videos.list=1)
    const broadcast = await getActiveLiveBroadcastEfficient(youtube, channelId);

    if (!broadcast) {
      return NextResponse.json({ error: "Активная трансляция не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      liveChatId: broadcast.liveChatId,
      videoId: broadcast.videoId,
      title: broadcast.title,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}





