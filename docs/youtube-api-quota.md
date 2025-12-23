# YouTube Data API v3 Quota

## Лимиты

| Параметр | Значение |
|----------|----------|
| Дневной лимит по умолчанию | **10,000 единиц** |
| Сброс квоты | Полночь по Pacific Time (PT) |
| Привязка | К Google Cloud проекту (не к API ключу) |

Несколько API ключей в одном проекте делят общую квоту.

## Стоимость операций

| Метод | Стоимость | Используется в проекте |
|-------|-----------|------------------------|
| `search.list` | **100** | `getLiveBroadcasts`, `getChannelVideos` |
| `videos.list` | 1 | `getLiveChatId`, `getVideosDetails` |
| `channels.list` | 1 | `getChannelStats` |
| `liveChatMessages.list` | ~5* | `fetchMessages` (polling) |
| `videos.update` | 50 | - |
| `videos.insert` | 1,600 | - |

*Точная стоимость `liveChatMessages.list` не указана в документации. Оценка 5 единиц.

## Расчёт для типичных сценариев

### Проверка активной трансляции
- `search.list` (eventType=live) = **100 единиц**

### Polling чата (1 час стрима)
- Интервал 5 сек = 720 запросов/час
- `liveChatMessages.list` × 720 = **~3,600 единиц**

### Загрузка списка видео
- `search.list` = 100
- `videos.list` (детали) = 1
- Итого: **101 единица**

### Просмотр статистики канала
- `channels.list` = **1 единица**

## Проблемные места в проекте

1. **`search.list` для проверки трансляции** — 100 единиц каждый раз
   - При polling каждые 30 сек = 2,880 единиц/день только на проверку

2. **`search.list` для списка видео** — 100 единиц
   - Решено: кнопка ручной загрузки

## Оптимизация

### 1. Использовать `fields` параметр
```typescript
youtube.videos.list({
  part: ["snippet"],
  id: [videoId],
  fields: "items(id,snippet/title)" // только нужные поля
})
```

### 2. Batch запросы
```typescript
// Плохо: 5 запросов = 5 единиц
for (const id of videoIds) {
  await youtube.videos.list({ id: [id] })
}

// Хорошо: 1 запрос = 1 единица
await youtube.videos.list({ id: videoIds })
```

### 3. ETags для кэширования
Если ресурс не изменился, возвращается `304 Not Modified` без расхода квоты.

### 4. Заменить `search.list` на `playlistItems.list`
Для получения видео канала использовать uploads playlist:
```typescript
// Стоимость: 1 единица вместо 100
const uploadsPlaylistId = "UU" + channelId.slice(2)
youtube.playlistItems.list({
  playlistId: uploadsPlaylistId,
  part: ["snippet"],
  maxResults: 50
})
```

### 5. Увеличить интервал проверки трансляции
Вместо polling каждые 5 сек — проверять реже или по событию.

## Увеличение квоты

Можно запросить увеличение через [Google Cloud Console](https://console.cloud.google.com/apis/api/youtube.googleapis.com/quotas).

Требования:
- Описание use case
- Соответствие YouTube API Terms of Service
- Прохождение compliance audit (для больших квот)

## Источники

- [Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [Quota and Compliance Audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube API Quota Guide 2025](https://getlate.dev/blog/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota)
