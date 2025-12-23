import { Pool } from "pg";
import { logEmitter } from "./api-logger-client";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "yt_chat",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Quota costs based on YouTube Data API v3 documentation
export const QUOTA_COSTS = {
  "search.list": 100,
  "videos.list": 1,
  "channels.list": 1,
  "liveChatMessages.list": 5,
} as const;

export interface ApiLogEntry {
  id?: number;
  timestamp: Date;
  endpointType: string;
  methodName: string;
  requestParams?: Record<string, any>;
  status: "success" | "error";
  errorMessage?: string;
  quotaCost: number;
  responseTimeMs: number;
}

// Event emitter is exported from api-logger-client.ts
export { logEmitter } from "./api-logger-client";

/**
 * Save a log entry to the database
 */
async function saveLogToDatabase(log: ApiLogEntry): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO api_request_logs 
        (timestamp, endpoint_type, method_name, request_params, status, error_message, quota_cost, response_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        log.timestamp,
        log.endpointType,
        log.methodName,
        log.requestParams ? JSON.stringify(log.requestParams) : null,
        log.status,
        log.errorMessage || null,
        log.quotaCost,
        log.responseTimeMs,
      ]
    );
  } catch (error) {
    console.error("Failed to save API log to database:", error);
  } finally {
    client.release();
  }
}

/**
 * Log an API request
 */
export async function logApiRequest(
  methodName: string,
  endpointType: keyof typeof QUOTA_COSTS,
  requestParams: Record<string, any> | undefined,
  status: "success" | "error",
  responseTimeMs: number,
  errorMessage?: string
): Promise<void> {
  const log: ApiLogEntry = {
    timestamp: new Date(),
    methodName,
    endpointType,
    requestParams,
    status,
    errorMessage,
    quotaCost: QUOTA_COSTS[endpointType] || 0,
    responseTimeMs,
  };

  // Emit event for real-time activity indicator
  logEmitter.emit("newLog", log);

  // Save to database asynchronously (don't await to avoid blocking)
  saveLogToDatabase(log).catch((error) => {
    console.error("Error saving API log:", error);
  });
}

