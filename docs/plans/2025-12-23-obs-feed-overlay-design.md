# OBS Feed Overlay Design

## Overview

Автоматическое отображение сообщений из чата в OBS overlay в виде ленты. Сообщения появляются с анимацией, остаются ~5 секунд, затем уходят. Переключатель позволяет выбрать между режимом "лента" и "ручной выбор".

## Requirements

- Все сообщения из чата показываются в overlay
- Лента: новые сообщения появляются снизу, старые уходят вверх
- Анимация: fade + slide (появление и исчезновение)
- Максимум 3-5 сообщений одновременно
- Авто-удаление через ~5 секунд
- Переключатель режимов: "лента" / "ручной выбор"

## Architecture

### Component Structure

```
OBSPage
├── mode: "feed" | "manual"           // переключатель режима
├── feedMessages: FeedMessage[]       // сообщения для ленты
├── overlayMessage: OverlayMessage    // для ручного режима (как сейчас)
└── render:
    ├── Переключатель режима (авто-скрытие)
    ├── mode === "feed" → MessageFeed
    └── mode === "manual" → Overlay (текущий)
```

### Data Types

```typescript
interface FeedMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  exiting?: boolean;  // для анимации исчезновения
}
```

### Message Lifecycle

1. SSE сообщение получено → добавляем в `feedMessages` с уникальным id
2. Если > 5 сообщений → удаляем самое старое
3. Через 5 сек → `exiting: true`, запускается slideOut
4. Через 5.3 сек → удаляем из state

## CSS Animations

### Container

- Позиция: низ экрана
- `flex-direction: column-reverse` — новые внизу
- Высота: ~40% экрана, `overflow: hidden`

### Slide In (появление)

```css
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
/* 0.3s ease-out */
```

### Slide Out (исчезновение)

```css
@keyframes slideOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-20px);
  }
}
/* 0.3s ease-in */
```

### Message Styling

- Полупрозрачный тёмный фон
- Имя автора выделено цветом
- Компактный padding
- Border-radius

## Mode Switcher

### UI

- Позиция: верхний правый угол
- Варианты: "Лента" / "Ручной"
- Полупрозрачный, неброский
- Авто-скрытие через 3 сек неактивности
- Появляется при движении мыши

### Behavior

| | Лента (feed) | Ручной (manual) |
|---|---|---|
| SSE сообщения | Показываются в ленте | Не показываются |
| `/api/overlay` polling | Отключен | Работает |
| Typewriter анимация | Нет | Да |

### Storage

- localStorage key: `obsOverlayMode`
- Значения: `"feed"` | `"manual"`
- По умолчанию: `"feed"`

## Implementation Tasks

**Files:**
- `app/obs/page.tsx` — основная логика
- `app/obs/page.module.css` — стили

**Tasks:**

1. Добавить state и типы для ленты
   - `FeedMessage` интерфейс
   - `mode`, `feedMessages` state
   - Загрузка режима из localStorage

2. Логика управления лентой
   - При SSE сообщении → добавить в feedMessages
   - Таймер 5 сек → пометить exiting
   - Таймер 5.3 сек → удалить
   - Лимит 5 сообщений

3. CSS анимации
   - `.feed` контейнер
   - `.feedMessage` с slideIn
   - `.feedMessageExiting` с slideOut

4. Переключатель режимов
   - UI компонент
   - Авто-скрытие через 3 сек
   - Сохранение в localStorage

5. Условный рендеринг по режиму
