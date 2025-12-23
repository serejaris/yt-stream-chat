import { NextResponse } from "next/server";
import { Pool } from "pg";

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
    // Total usage and error rate
    const todayStats = await client.query(`
      SELECT
        COALESCE(SUM(quota_cost), 0) as total_used,
        COUNT(*) as total_requests,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count
      FROM api_request_logs
      WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                         AT TIME ZONE 'America/Los_Angeles'
    `);

    // By endpoint with error stats
    const byEndpoint = await client.query(`
      SELECT
        endpoint_type,
        COUNT(*)::int as count,
        SUM(quota_cost)::int as total_cost,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END)::int as errors
      FROM api_request_logs
      WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                         AT TIME ZONE 'America/Los_Angeles'
      GROUP BY endpoint_type
      ORDER BY total_cost DESC
    `);

    // Hourly breakdown for chart
    const hourlyStats = await client.query(`
      SELECT
        EXTRACT(HOUR FROM timestamp AT TIME ZONE 'America/Los_Angeles')::int as hour,
        SUM(quota_cost)::int as cost
      FROM api_request_logs
      WHERE timestamp >= (NOW() AT TIME ZONE 'America/Los_Angeles')::date
                         AT TIME ZONE 'America/Los_Angeles'
      GROUP BY EXTRACT(HOUR FROM timestamp AT TIME ZONE 'America/Los_Angeles')
      ORDER BY hour
    `);

    const used = Number(todayStats.rows[0].total_used);
    const totalRequests = Number(todayStats.rows[0].total_requests);
    const errorCount = Number(todayStats.rows[0].error_count);

    return NextResponse.json({
      today: {
        used,
        limit: DAILY_LIMIT,
        requests: totalRequests,
        errors: errorCount,
        errorRate: totalRequests > 0 ? Math.round((errorCount / totalRequests) * 100) : 0,
      },
      byEndpoint: byEndpoint.rows.map((row) => ({
        endpoint: row.endpoint_type,
        count: row.count,
        cost: row.total_cost,
        errors: row.errors,
      })),
      hourly: hourlyStats.rows.map((row) => ({
        hour: row.hour,
        cost: row.cost,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
