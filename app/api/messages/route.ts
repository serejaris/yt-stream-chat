import { NextRequest, NextResponse } from "next/server";
import { createYoutubeClient, fetchMessages, formatMessage } from "@/lib/youtube-api";
import { saveMessages } from "@/lib/database";
import { ensureDatabaseInitialized } from "@/lib/db-init";

export async function GET(request: NextRequest) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  
  if (!apiKey) {
    return NextResponse.json({ error: "YOUTUBE_API_KEY отсутствует в окружении" }, { status: 500 });
  }

  const searchParams = request.nextUrl.searchParams;
  const liveChatId = searchParams.get("liveChatId");
  const pageToken = searchParams.get("pageToken");
  const videoId = searchParams.get("videoId");

  if (!liveChatId || liveChatId.length === 0) {
    return NextResponse.json({ error: "Параметр liveChatId обязателен" }, { status: 400 });
  }

  try {
    await ensureDatabaseInitialized();
    const youtube = createYoutubeClient(apiKey);
    const data = await fetchMessages(youtube, liveChatId, pageToken || undefined);
    const items = data.items ?? [];
    const formattedMessages = items.map((item) => formatMessage(item));
    
    if (formattedMessages.length > 0) {
      const messagesToSave = formattedMessages.map((msg) => ({
        messageId: msg.messageId,
        videoId: videoId || undefined,
        liveChatId,
        authorName: msg.author,
        messageText: msg.text,
        publishedAt: msg.publishedAt,
      }));
      await saveMessages(messagesToSave);
    }
    
    return NextResponse.json({
      messages: formattedMessages.map(({ messageId, publishedAt, ...rest }) => rest),
      nextPageToken: data.nextPageToken ?? null,
      pollingIntervalMillis: data.pollingIntervalMillis ?? 2000,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

