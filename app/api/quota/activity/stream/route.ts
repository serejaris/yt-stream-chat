import { logEmitter, ApiLogEntry } from "@/lib/api-logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onNewLog = (log: ApiLogEntry) => {
        const data = JSON.stringify({
          id: log.id,
          timestamp: log.timestamp,
          endpointType: log.endpointType,
          quotaCost: log.quotaCost,
        });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      logEmitter.on("newLog", onNewLog);

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": heartbeat\n\n"));
      }, 30000);

      // Cleanup when client disconnects
      const cleanup = () => {
        logEmitter.off("newLog", onNewLog);
        clearInterval(heartbeat);
      };

      // Handle abort signal
      controller.enqueue(encoder.encode(": connected\n\n"));

      return cleanup;
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
