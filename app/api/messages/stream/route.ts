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
  const videoId = searchParams.get("videoId");
  
  if (!liveChatId || liveChatId.length === 0) {
    return NextResponse.json({ error: "Параметр liveChatId обязателен" }, { status: 400 });
  }
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const youtube = createYoutubeClient(apiKey);
      let nextPageToken: string | undefined = undefined;
      const MIN_POLLING_INTERVAL = 5000; // Minimum 5 seconds to save quota
      let pollingInterval = MIN_POLLING_INTERVAL;
      let timer: NodeJS.Timeout | null = null;
      
      const poll = async () => {
        try {
          await ensureDatabaseInitialized();
          const data = await fetchMessages(youtube, liveChatId, nextPageToken);
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
            
            const messagesToSend = formattedMessages.map(({ messageId, publishedAt, ...rest }) => rest);
            const jsonData = JSON.stringify({ messages: messagesToSend });
            controller.enqueue(encoder.encode(`data: ${jsonData}\n\n`));
          }
          
          nextPageToken = data.nextPageToken ?? undefined;
          // Use YouTube's recommended interval, but never less than minimum
          const youtubeInterval = data.pollingIntervalMillis ?? MIN_POLLING_INTERVAL;
          pollingInterval = Math.max(youtubeInterval, MIN_POLLING_INTERVAL);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`));
        }
        
        timer = setTimeout(poll, pollingInterval);
      };
      
      poll();
      
      request.signal.addEventListener("abort", () => {
        if (timer) {
          clearTimeout(timer);
        }
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

