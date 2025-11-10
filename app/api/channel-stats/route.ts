import { NextRequest, NextResponse } from "next/server";
import { createYoutubeClient, getChannelStats } from "@/lib/youtube-api";

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
    const stats = await getChannelStats(youtube, channelId);
    
    if (!stats) {
      return NextResponse.json({ error: "Канал не найден" }, { status: 404 });
    }
    
    return NextResponse.json(stats);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

