const messagesList = document.getElementById("messages");
const streamStatus = document.getElementById("stream-status");
const streamTitle = document.getElementById("stream-title");
const pollingStatus = document.getElementById("polling-status");
const refreshButton = document.getElementById("refresh");
const scrollContainer = document.querySelector(".content");

const state = {
  liveChatId: null,
  nextPageToken: null,
  pollingInterval: 2000,
  timer: null,
  loading: false,
};

function clearTimer() {
  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }
}

function setStreamStatus(text, isError) {
  streamStatus.textContent = text;
  streamStatus.classList.toggle("status-error", Boolean(isError));
}

function setPollingStatus(text, isError) {
  pollingStatus.textContent = text;
  pollingStatus.classList.toggle("status-error", Boolean(isError));
}

function resetMessages() {
  messagesList.innerHTML = "";
}

function appendMessages(messages) {
  if (messages.length === 0) {
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const message of messages) {
    const item = document.createElement("li");
    item.className = "message";
    const time = document.createElement("time");
    time.textContent = message.time;
    const author = document.createElement("strong");
    author.textContent = message.author;
    const text = document.createElement("p");
    text.textContent = message.text;
    item.append(time, author, text);
    fragment.appendChild(item);
  }
  messagesList.appendChild(fragment);
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

async function loadLiveChatId() {
  setStreamStatus("Поиск трансляции...", false);
  try {
    const response = await fetch("/api/live-chat-id");
    if (!response.ok) {
      throw new Error("live chat id not found");
    }
    const payload = await response.json();
    state.liveChatId = payload.liveChatId;
    state.nextPageToken = null;
    state.pollingInterval = 2000;
    streamTitle.textContent = payload.title ?? "";
    setStreamStatus("Чат подключен", false);
    setPollingStatus("Получение сообщений...", false);
  } catch (error) {
    setStreamStatus("Нет активной трансляции", true);
    setPollingStatus("Ожидание трансляции", true);
    throw error;
  }
}

async function loadMessages() {
  if (!state.liveChatId) {
    return;
  }
  if (state.loading) {
    return;
  }
  state.loading = true;
  try {
    const params = new URLSearchParams({ liveChatId: state.liveChatId });
    if (state.nextPageToken) {
      params.set("pageToken", state.nextPageToken);
    }
    const response = await fetch(`/api/messages?${params.toString()}`);
    if (!response.ok) {
      throw new Error("messages request failed");
    }
    const payload = await response.json();
    appendMessages(payload.messages ?? []);
    state.nextPageToken = payload.nextPageToken ?? null;
    state.pollingInterval = Number(payload.pollingIntervalMillis ?? 2000);
    setPollingStatus("Последнее обновление: " + new Date().toLocaleTimeString("ru-RU", { hour12: false }), false);
  } catch (error) {
    setPollingStatus("Ошибка получения сообщений", true);
  } finally {
    state.loading = false;
    scheduleNextPoll();
  }
}

function scheduleNextPoll() {
  clearTimer();
  if (!state.liveChatId) {
    return;
  }
  state.timer = setTimeout(loadMessages, state.pollingInterval);
}

async function initialize() {
  clearTimer();
  resetMessages();
  streamTitle.textContent = "";
  state.liveChatId = null;
  state.nextPageToken = null;
  try {
    await loadLiveChatId();
    await loadMessages();
  } catch (error) {
    clearTimer();
  }
}

refreshButton.addEventListener("click", () => {
  initialize();
});

initialize();
