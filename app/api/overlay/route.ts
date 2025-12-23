import { NextResponse } from "next/server";

interface OverlayMessage {
  id: string;
  author: string;
  authorPhoto?: string;
  message: string;
  timestamp: number;
}

let currentOverlay: OverlayMessage | null = null;

export async function GET() {
  return NextResponse.json({ overlay: currentOverlay });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.author || !body.message) {
      return NextResponse.json(
        { error: "author and message are required" },
        { status: 400 }
      );
    }

    currentOverlay = {
      id: body.id || `${Date.now()}`,
      author: body.author,
      authorPhoto: body.authorPhoto,
      message: body.message,
      timestamp: Date.now(),
    };

    return NextResponse.json({ overlay: currentOverlay });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  currentOverlay = null;
  return NextResponse.json({ overlay: null });
}
