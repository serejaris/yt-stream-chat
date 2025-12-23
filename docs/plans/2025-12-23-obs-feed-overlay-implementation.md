# OBS Feed Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add automatic message feed to OBS overlay with slide animations and mode switcher.

**Architecture:** Extend existing `/obs` page to support two modes: "feed" (auto-display all chat messages) and "manual" (current overlay behavior). Feed mode renders messages in a vertical list with CSS animations for appearance/disappearance.

**Tech Stack:** Next.js 14, React hooks, CSS Modules, localStorage

---

## Task 1: Add FeedMessage Type and State

**Files:**
- Modify: `app/obs/page.tsx:1-40`

**Step 1: Add FeedMessage interface after existing interfaces**

After line 17 (after `OverlayMessage` interface), add:

```typescript
interface FeedMessage {
  id: string;
  author: string;
  text: string;
  createdAt: number;
  exiting?: boolean;
}

type OverlayMode = "feed" | "manual";
```

**Step 2: Add new state variables**

After line 25 (`lastOverlayIdRef`), add:

```typescript
const [mode, setMode] = useState<OverlayMode>(() => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("obsOverlayMode");
    return (saved === "feed" || saved === "manual") ? saved : "feed";
  }
  return "feed";
});
const [feedMessages, setFeedMessages] = useState<FeedMessage[]>([]);
const feedTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
```

**Step 3: Add useEffect to persist mode**

After the existing localStorage effect (line 46), add:

```typescript
useEffect(() => {
  if (typeof window !== "undefined") {
    localStorage.setItem("obsOverlayMode", mode);
  }
}, [mode]);
```

**Step 4: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors related to new types

**Step 5: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): add FeedMessage type and mode state"
```

---

## Task 2: Add Feed Message Management Functions

**Files:**
- Modify: `app/obs/page.tsx` (after `appendMessage` function, around line 116)

**Step 1: Add function to add message to feed**

After `appendMessage` function, add:

```typescript
const addFeedMessage = useCallback((msg: Message) => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const feedMsg: FeedMessage = {
    id,
    author: msg.author,
    text: msg.text,
    createdAt: Date.now(),
  };

  setFeedMessages((prev) => {
    const updated = [...prev, feedMsg];
    // Keep max 5 messages
    if (updated.length > 5) {
      const oldest = updated[0];
      // Clear timer for removed message
      const timer = feedTimersRef.current.get(oldest.id);
      if (timer) {
        clearTimeout(timer);
        feedTimersRef.current.delete(oldest.id);
      }
      return updated.slice(1);
    }
    return updated;
  });

  // Schedule exit animation after 5 seconds
  const exitTimer = setTimeout(() => {
    setFeedMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, exiting: true } : m))
    );

    // Remove after animation (300ms)
    const removeTimer = setTimeout(() => {
      setFeedMessages((prev) => prev.filter((m) => m.id !== id));
      feedTimersRef.current.delete(id);
    }, 300);

    feedTimersRef.current.set(`${id}-remove`, removeTimer);
  }, 5000);

  feedTimersRef.current.set(id, exitTimer);
}, []);
```

**Step 2: Add cleanup for timers on unmount**

Find the existing cleanup `useEffect` (around line 231-246) that handles `isMountedRef`. Add to its cleanup:

```typescript
// Add inside the return cleanup function, before the closing }
feedTimersRef.current.forEach((timer) => clearTimeout(timer));
feedTimersRef.current.clear();
```

**Step 3: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 4: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): add feed message management with auto-removal"
```

---

## Task 3: Integrate Feed with SSE Messages

**Files:**
- Modify: `app/obs/page.tsx` (SSE handler around line 139-145)

**Step 1: Modify SSE message handler to route to feed**

Find the `eventSource.onmessage` handler (around line 139). Change:

```typescript
eventSource.onmessage = (event) => {
  if (!isMountedRef.current) return;
  try {
    const data = JSON.parse(event.data);
    if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach((msg: Message) => appendMessage(msg));
    }
  } catch (error) {
    console.error("Failed to parse SSE message:", error);
  }
};
```

To:

```typescript
eventSource.onmessage = (event) => {
  if (!isMountedRef.current) return;
  try {
    const data = JSON.parse(event.data);
    if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach((msg: Message) => {
        appendMessage(msg);
        if (mode === "feed") {
          addFeedMessage(msg);
        }
      });
    }
  } catch (error) {
    console.error("Failed to parse SSE message:", error);
  }
};
```

**Step 2: Add mode and addFeedMessage to startStreaming dependencies**

Find `startStreaming` useCallback (around line 126). Update dependencies array from:

```typescript
}, [isMonitoringEnabled]);
```

To:

```typescript
}, [isMonitoringEnabled, mode, addFeedMessage]);
```

**Step 3: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 4: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): route SSE messages to feed in feed mode"
```

---

## Task 4: Add CSS for Feed and Animations

**Files:**
- Modify: `app/obs/page.module.css` (append to end)

**Step 1: Add feed container and message styles**

Append to end of file:

```css
/* Feed Mode Styles */
.feed {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-height: 50vh;
  overflow: hidden;
}

.feedMessage {
  background: rgba(11, 15, 26, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-left: 4px solid var(--accent);
  border-radius: var(--radius-md);
  padding: 1rem 1.25rem;
  backdrop-filter: blur(16px);
  animation: slideIn 0.3s ease-out forwards;
}

.feedMessageExiting {
  animation: slideOut 0.3s ease-in forwards;
}

.feedAuthor {
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.feedText {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.4;
  color: #fff;
}

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

/* Mode Switcher */
.modeSwitcher {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem;
  background: rgba(11, 15, 26, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  backdrop-filter: blur(12px);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 100;
}

.modeSwitcherVisible {
  opacity: 1;
}

.modeButton {
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.modeButton:hover {
  color: rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.05);
}

.modeButtonActive {
  color: var(--accent);
  background: rgba(56, 189, 248, 0.1);
  border-color: rgba(56, 189, 248, 0.3);
}
```

**Step 2: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): add CSS for feed messages and mode switcher"
```

---

## Task 5: Add Mode Switcher Component

**Files:**
- Modify: `app/obs/page.tsx` (add state and render)

**Step 1: Add switcher visibility state**

After `feedTimersRef` (around line 30), add:

```typescript
const [switcherVisible, setSwitcherVisible] = useState(false);
const switcherTimerRef = useRef<NodeJS.Timeout | null>(null);
```

**Step 2: Add mouse movement handler**

After the mode persistence useEffect, add:

```typescript
useEffect(() => {
  const handleMouseMove = () => {
    setSwitcherVisible(true);

    if (switcherTimerRef.current) {
      clearTimeout(switcherTimerRef.current);
    }

    switcherTimerRef.current = setTimeout(() => {
      setSwitcherVisible(false);
    }, 3000);
  };

  window.addEventListener("mousemove", handleMouseMove);

  return () => {
    window.removeEventListener("mousemove", handleMouseMove);
    if (switcherTimerRef.current) {
      clearTimeout(switcherTimerRef.current);
    }
  };
}, []);
```

**Step 3: Add cleanup for switcherTimerRef**

In the main cleanup useEffect, add:

```typescript
if (switcherTimerRef.current) {
  clearTimeout(switcherTimerRef.current);
}
```

**Step 4: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 5: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): add mode switcher visibility logic"
```

---

## Task 6: Update Render Output

**Files:**
- Modify: `app/obs/page.tsx` (return statement, around line 275-287)

**Step 1: Replace entire return statement**

Replace:

```tsx
return (
  <div className={styles.container}>
    {overlayMessage && (
      <div className={`${styles.overlay} ${isVisible ? styles.overlayVisible : styles.overlayHidden}`}>
        <div className={styles.overlayAuthor}>{overlayMessage.author}</div>
        <div className={styles.overlayText}>
          {displayedText}
          {isTyping && <span className={styles.cursor}>|</span>}
        </div>
      </div>
    )}
  </div>
);
```

With:

```tsx
return (
  <div className={styles.container}>
    {/* Mode Switcher */}
    <div className={`${styles.modeSwitcher} ${switcherVisible ? styles.modeSwitcherVisible : ""}`}>
      <button
        className={`${styles.modeButton} ${mode === "feed" ? styles.modeButtonActive : ""}`}
        onClick={() => setMode("feed")}
      >
        Лента
      </button>
      <button
        className={`${styles.modeButton} ${mode === "manual" ? styles.modeButtonActive : ""}`}
        onClick={() => setMode("manual")}
      >
        Ручной
      </button>
    </div>

    {/* Feed Mode */}
    {mode === "feed" && feedMessages.length > 0 && (
      <div className={styles.feed}>
        {feedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.feedMessage} ${msg.exiting ? styles.feedMessageExiting : ""}`}
          >
            <div className={styles.feedAuthor}>{msg.author}</div>
            <div className={styles.feedText}>{msg.text}</div>
          </div>
        ))}
      </div>
    )}

    {/* Manual Mode */}
    {mode === "manual" && overlayMessage && (
      <div className={`${styles.overlay} ${isVisible ? styles.overlayVisible : styles.overlayHidden}`}>
        <div className={styles.overlayAuthor}>{overlayMessage.author}</div>
        <div className={styles.overlayText}>
          {displayedText}
          {isTyping && <span className={styles.cursor}>|</span>}
        </div>
      </div>
    )}
  </div>
);
```

**Step 2: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 3: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): render feed or manual overlay based on mode"
```

---

## Task 7: Disable Overlay Polling in Feed Mode

**Files:**
- Modify: `app/obs/page.tsx` (overlay polling useEffect, around line 49-80)

**Step 1: Wrap polling in mode check**

Find the overlay polling useEffect. Change:

```typescript
useEffect(() => {
  const pollOverlay = async () => {
```

To:

```typescript
useEffect(() => {
  if (mode !== "manual") return;

  const pollOverlay = async () => {
```

**Step 2: Add mode to dependencies**

Change the dependencies from:

```typescript
}, []);
```

To:

```typescript
}, [mode]);
```

**Step 3: Verify no TypeScript errors**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit 2>&1 | head -20`

Expected: No errors

**Step 4: Commit**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "feat(obs): disable overlay polling in feed mode"
```

---

## Task 8: Final Verification

**Step 1: Run TypeScript check**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npx tsc --noEmit`

Expected: No errors

**Step 2: Run build**

Run: `cd ~/worktrees/yt-chat/obs-feed-overlay && npm run build 2>&1 | grep -E "(error|Error|✓)" | head -10`

Expected: Build succeeds (quota error is unrelated DB issue)

**Step 3: Manual testing checklist**

1. Open `http://localhost:3000/obs` in browser
2. Move mouse - switcher appears top-right
3. Default mode is "Лента"
4. Start a live stream or simulate SSE messages
5. Messages appear with slide-in animation
6. After ~5 sec messages fade out with slide-up
7. Max 5 messages visible at once
8. Switch to "Ручной" mode
9. Feed disappears, manual overlay works as before
10. Refresh page - mode persists

**Step 4: Final commit if any fixes needed**

```bash
cd ~/worktrees/yt-chat/obs-feed-overlay && git add -A && git commit -m "fix(obs): address review feedback" # if needed
```

---

## Verification Checklist

- [ ] TypeScript compiles without errors
- [ ] Feed messages appear with slideIn animation
- [ ] Messages auto-remove after 5 seconds with slideOut
- [ ] Maximum 5 messages visible
- [ ] Mode switcher appears on mouse move, hides after 3s
- [ ] Mode persists in localStorage
- [ ] Manual mode works as before (polling, typewriter)
- [ ] Feed mode disables overlay polling
