import { NextRequest, NextResponse } from "next/server";
import { createYoutubeClient, getChannelVideosEfficient } from "@/lib/youtube-api";

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
    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get("maxResults") || "50", 10);

    // Uses 3 quota units instead of 101 (search.list=100 + videos.list=1)
    const videos = await getChannelVideosEfficient(youtube, channelId, maxResults);
    
    return NextResponse.json({ videos });
  } catch (error) {
    let message = "Неизвестная ошибка";
    
    if (error instanceof Error) {
      message = error.message;
      if (message.includes("quota") || message.includes("exceeded")) {
        message = "Превышена квота YouTube API. Попробуйте позже или проверьте настройки API ключа.";
      } else if (message.includes("API key")) {
        message = "Неверный API ключ YouTube. Проверьте настройки окружения.";
      }
    }
    
    console.error("Ошибка при получении видео:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

