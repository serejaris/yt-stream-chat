import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/lib/database";
import { ensureDatabaseInitialized } from "@/lib/db-init";

export async function GET(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit") || 100);
    const offset = Number(searchParams.get("offset") || 0);
    const videoId = searchParams.get("videoId") || undefined;
    
    const messages = await getMessages(limit, offset, videoId);
    return NextResponse.json({
      messages: messages.map((msg) => ({
        author: msg.authorName,
        text: msg.messageText,
        time: new Date(msg.publishedAt).toLocaleTimeString("ru-RU", { hour12: false }),
        publishedAt: msg.publishedAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

