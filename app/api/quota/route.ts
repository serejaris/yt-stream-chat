import { NextResponse } from "next/server";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "yt_chat",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
});

const DAILY_LIMIT = 10000;

export async function GET() {
  const client = await pool.connect();
  try {
    const todayStats = await client.query(`
      SELECT COALESCE(SUM(quota_cost), 0) as total_used
      FROM api_request_logs
      WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                         AT TIME ZONE 'America/Los_Angeles'
    `);

    const byEndpoint = await client.query(`
      SELECT
        endpoint_type,
        COUNT(*)::int as count,
        SUM(quota_cost)::int as total_cost
      FROM api_request_logs
      WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                         AT TIME ZONE 'America/Los_Angeles'
      GROUP BY endpoint_type
      ORDER BY total_cost DESC
    `);

    const used = Number(todayStats.rows[0].total_used);

    return NextResponse.json({
      today: {
        used,
        limit: DAILY_LIMIT,
      },
      byEndpoint: byEndpoint.rows.map((row) => ({
        endpoint: row.endpoint_type,
        count: row.count,
        cost: row.total_cost,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
