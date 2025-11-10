import { Pool } from "pg";

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

export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id SERIAL PRIMARY KEY,
        message_id VARCHAR(255) UNIQUE NOT NULL,
        video_id VARCHAR(255),
        live_chat_id VARCHAR(255),
        author_name VARCHAR(255) NOT NULL,
        message_text TEXT NOT NULL,
        published_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_message_id ON chat_messages(message_id);
      CREATE INDEX IF NOT EXISTS idx_video_id ON chat_messages(video_id);
      CREATE INDEX IF NOT EXISTS idx_published_at ON chat_messages(published_at DESC);
    `);
  } finally {
    client.release();
  }
}

export interface ChatMessage {
  messageId: string;
  videoId?: string;
  liveChatId?: string;
  authorName: string;
  messageText: string;
  publishedAt: Date;
}

export async function saveMessage(message: ChatMessage): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO chat_messages (message_id, video_id, live_chat_id, author_name, message_text, published_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (message_id) DO NOTHING`,
      [
        message.messageId,
        message.videoId || null,
        message.liveChatId || null,
        message.authorName,
        message.messageText,
        message.publishedAt,
      ]
    );
  } finally {
    client.release();
  }
}

export async function saveMessages(messages: ChatMessage[]): Promise<void> {
  if (messages.length === 0) return;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const message of messages) {
      await client.query(
        `INSERT INTO chat_messages (message_id, video_id, live_chat_id, author_name, message_text, published_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (message_id) DO NOTHING`,
        [
          message.messageId,
          message.videoId || null,
          message.liveChatId || null,
          message.authorName,
          message.messageText,
          message.publishedAt,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getMessages(
  limit: number = 100,
  offset: number = 0,
  videoId?: string
): Promise<ChatMessage[]> {
  const client = await pool.connect();
  try {
    let query = `
      SELECT message_id, video_id, live_chat_id, author_name, message_text, published_at
      FROM chat_messages
    `;
    const params: any[] = [];
    
    if (videoId) {
      query += ` WHERE video_id = $1`;
      params.push(videoId);
    }
    
    query += ` ORDER BY published_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const result = await client.query(query, params);
    return result.rows.map((row) => ({
      messageId: row.message_id,
      videoId: row.video_id,
      liveChatId: row.live_chat_id,
      authorName: row.author_name,
      messageText: row.message_text,
      publishedAt: row.published_at,
    }));
  } finally {
    client.release();
  }
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}

