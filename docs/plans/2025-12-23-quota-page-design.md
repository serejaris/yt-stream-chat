# Quota Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Создать страницу `/quota` для мониторинга расхода квоты YouTube API

**Architecture:** API endpoint читает из `api_request_logs` (PostgreSQL), фильтрует по Pacific Time, группирует по endpoint. React страница отображает счётчик и таблицу.

**Tech Stack:** Next.js 14 (App Router), PostgreSQL, CSS Modules

---

## Task 1: API Endpoint

**Files:**
- Create: `app/api/quota/route.ts`

**Step 1: Create API route file**

```typescript
// app/api/quota/route.ts
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
```

**Step 2: Verify API works**

Run: `curl http://localhost:3000/api/quota`

Expected: JSON response with `today` and `byEndpoint` fields

**Step 3: Commit**

```bash
git add app/api/quota/route.ts
git commit -m "feat: add /api/quota endpoint for quota monitoring"
```

---

## Task 2: Page Styles

**Files:**
- Create: `app/quota/page.module.css`

**Step 1: Create styles file**

```css
/* app/quota/page.module.css */
.layout {
  width: min(960px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  display: grid;
  grid-template-rows: auto 1fr;
  background: rgba(15, 23, 42, 0.85);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: hidden;
  backdrop-filter: blur(16px);
}

.content {
  padding: 32px 24px;
}

.title {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 32px;
  color: var(--text);
}

.loading,
.error,
.empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}

.error {
  color: var(--error);
}

/* Counter section */
.counter {
  padding: 24px;
  background: rgba(30, 41, 59, 0.85);
  border-radius: 12px;
  border: 1px solid rgba(56, 189, 248, 0.1);
  margin-bottom: 32px;
}

.counterLabel {
  font-size: 14px;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.counterValue {
  font-size: 32px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 16px;
}

.counterValue span {
  font-size: 20px;
  font-weight: 400;
  color: var(--text-muted);
}

.progressBar {
  height: 8px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 4px;
  overflow: hidden;
}

.progressFill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

/* Endpoint table */
.section {
  margin-bottom: 24px;
}

.sectionTitle {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-muted);
  margin-bottom: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  text-align: left;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
}

.table th:last-child {
  text-align: right;
}

.table td {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}

.table td:last-child {
  text-align: right;
  font-weight: 600;
}

.endpoint {
  font-family: "SF Mono", "Monaco", "Consolas", monospace;
  font-size: 14px;
  color: var(--text);
}

.count {
  color: var(--text-muted);
  font-size: 14px;
}

@media (max-width: 640px) {
  .layout {
    border-radius: 0;
  }

  .content {
    padding: 24px 16px;
  }
}
```

**Step 2: Commit**

```bash
git add app/quota/page.module.css
git commit -m "feat: add styles for quota page"
```

---

## Task 3: Page Component

**Files:**
- Create: `app/quota/page.tsx`

**Step 1: Create page component**

```tsx
// app/quota/page.tsx
"use client";

import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import styles from "./page.module.css";

interface QuotaStats {
  today: {
    used: number;
    limit: number;
  };
  byEndpoint: Array<{
    endpoint: string;
    count: number;
    cost: number;
  }>;
}

export default function QuotaPage() {
  const [stats, setStats] = useState<QuotaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/quota");
        if (!response.ok) {
          throw new Error("Не удалось загрузить статистику квоты");
        }
        const data = await response.json();
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const formatNumber = (num: number) => {
    return num.toLocaleString("ru-RU");
  };

  const getPercentage = () => {
    if (!stats) return 0;
    return Math.round((stats.today.used / stats.today.limit) * 100);
  };

  return (
    <div className={styles.layout}>
      <Navigation />
      <main className={styles.content}>
        <h1 className={styles.title}>Квота API</h1>

        {loading && <div className={styles.loading}>Загрузка...</div>}

        {error && <div className={styles.error}>{error}</div>}

        {stats && (
          <>
            <div className={styles.counter}>
              <div className={styles.counterLabel}>Использовано сегодня</div>
              <div className={styles.counterValue}>
                {formatNumber(stats.today.used)}{" "}
                <span>/ {formatNumber(stats.today.limit)} единиц</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${getPercentage()}%` }}
                />
              </div>
            </div>

            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>Расход по операциям</h2>
              {stats.byEndpoint.length === 0 ? (
                <div className={styles.empty}>Нет данных за сегодня</div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Endpoint</th>
                      <th>Запросов</th>
                      <th>Стоимость</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byEndpoint.map((row) => (
                      <tr key={row.endpoint}>
                        <td className={styles.endpoint}>{row.endpoint}</td>
                        <td className={styles.count}>{row.count}</td>
                        <td>{formatNumber(row.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

**Step 2: Verify page renders**

Open: `http://localhost:3000/quota`

Expected: Page with counter showing "0 / 10,000 единиц" and empty table (or data if logs exist)

**Step 3: Commit**

```bash
git add app/quota/page.tsx
git commit -m "feat: add quota monitoring page"
```

---

## Task 4: Navigation Link

**Files:**
- Modify: `components/Navigation.tsx:25-29`

**Step 1: Add link to navigation**

Add after the "Видео" link (line 29):

```tsx
      <Link
        href="/quota"
        className={`${styles.link} ${pathname === "/quota" ? styles.active : ""}`}
      >
        Квота
      </Link>
```

**Step 2: Verify navigation**

Open: `http://localhost:3000/quota`

Expected: "Квота" link visible in navigation, highlighted when on `/quota` page

**Step 3: Commit**

```bash
git add components/Navigation.tsx
git commit -m "feat: add quota link to navigation"
```

---

## Verification Checklist

- [ ] `curl http://localhost:3000/api/quota` returns valid JSON
- [ ] `/quota` page loads without errors
- [ ] Counter shows current usage
- [ ] Table shows breakdown by endpoint (or "Нет данных" if empty)
- [ ] Navigation link works and highlights correctly
- [ ] Styling matches other pages (dark theme, same fonts)
