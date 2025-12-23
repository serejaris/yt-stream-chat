import { logEmitter, ApiLogEntry } from "@/lib/api-logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let isClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      const safeEnqueue = (data: Uint8Array) => {
        if (!isClosed) {
          try {
            controller.enqueue(data);
          } catch {
            isClosed = true;
          }
        }
      };

      const onNewLog = (log: ApiLogEntry) => {
        const data = JSON.stringify({
          id: log.id,
          timestamp: log.timestamp,
          endpointType: log.endpointType,
          quotaCost: log.quotaCost,
        });
        safeEnqueue(encoder.encode(`data: ${data}\n\n`));
      };

      logEmitter.on("newLog", onNewLog);

      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      const cleanup = () => {
        isClosed = true;
        logEmitter.off("newLog", onNewLog);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      safeEnqueue(encoder.encode(": connected\n\n"));

      return cleanup;
    },
    cancel() {
      isClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
