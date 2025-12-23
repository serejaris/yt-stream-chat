import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "yt_chat",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const since = searchParams.get("since");
  const limit = Math.min(Number(searchParams.get("limit") || 100), 500);

  const client = await pool.connect();
  try {
    let query: string;
    let params: (string | number)[];

    if (since) {
      query = `
        SELECT id, timestamp, endpoint_type, quota_cost
        FROM api_request_logs
        WHERE timestamp > $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      params = [since, limit];
    } else {
      // Default: today's logs (Pacific time)
      query = `
        SELECT id, timestamp, endpoint_type, quota_cost
        FROM api_request_logs
        WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                           AT TIME ZONE 'America/Los_Angeles'
        ORDER BY timestamp DESC
        LIMIT $1
      `;
      params = [limit];
    }

    const result = await client.query(query, params);

    // Calculate session total
    let sessionTotalQuery: string;
    let sessionTotalParams: string[];

    if (since) {
      sessionTotalQuery = `
        SELECT COALESCE(SUM(quota_cost), 0) as total
        FROM api_request_logs
        WHERE timestamp > $1
      `;
      sessionTotalParams = [since];
    } else {
      sessionTotalQuery = `
        SELECT COALESCE(SUM(quota_cost), 0) as total
        FROM api_request_logs
        WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                           AT TIME ZONE 'America/Los_Angeles'
      `;
      sessionTotalParams = [];
    }

    const totalResult = await client.query(sessionTotalQuery, sessionTotalParams);

    return NextResponse.json({
      logs: result.rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        endpointType: row.endpoint_type,
        quotaCost: row.quota_cost,
      })),
      sessionTotal: Number(totalResult.rows[0].total),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
