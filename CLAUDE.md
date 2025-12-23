# YT-Chat Project

YouTube канал помощник с live chat интеграцией и статистикой.

## Agents

Для фронтенд задач (компоненты, страницы, стили) используй агента `frontend-developer`.

## Stack

- Next.js 14 (App Router)
- PostgreSQL (pg)
- YouTube Data API v3 (googleapis)
- TypeScript

## Structure

```
app/                    # Next.js pages
  api/                  # API routes
    channel-stats/      # Статистика канала
    live-chat-id/       # Получение chat ID трансляции
    messages/           # Сообщения чата (polling, SSE, DB)
    videos/             # Список видео канала
  obs/                  # OBS Browser Source интерфейс
  overview/             # Статистика канала
  transmissions/        # Live chat трансляций
  videos/               # Редактирование видео
components/             # React компоненты
lib/                    # Утилиты
  database.ts           # PostgreSQL подключение и операции
  youtube-api.ts        # YouTube API wrapper
  api-logger.ts         # Логирование API запросов
src/                    # CLI скрипты (legacy)
```

## Environment Variables

```
YOUTUBE_API_KEY         # YouTube Data API v3 key
YOUTUBE_CHANNEL_ID      # ID канала
DB_HOST=localhost       # PostgreSQL host
DB_PORT=5432
DB_NAME=yt_chat
DB_USER=ris             # Роль PostgreSQL (не postgres!)
DB_PASSWORD=
```

## Commands

```bash
npm run dev             # Development server
npm run build           # Production build
npm run test:connection # Тест YouTube API
npm run test:serejaris  # Тест получения chat ID
```

## API Quota

YouTube API имеет дневной лимит квоты. `search.list` стоит 100 единиц — используй кнопку загрузки на /videos вместо автозапросов.

## Database

PostgreSQL с таблицами:
- `chat_messages` — сообщения из live chat
- `api_request_logs` — логи API запросов

Таблицы создаются автоматически при первом подключении (`lib/database.ts:initDatabase`).
