document.addEventListener("DOMContentLoaded", () => {
  const pinnedContainer = document.getElementById("pinned-container");
  const shortcutContainer = document.getElementById("shortcut-container");
  const pinnedEmptyState = document.getElementById("pinned-empty-state");
  const emptyState = document.getElementById("empty-state");
  const shortcutCount = document.getElementById("shortcut-count");
  const pinnedShortcutCount = document.getElementById("pinned-shortcut-count");
  const regularShortcutCount = document.getElementById("regular-shortcut-count");
  const shortcutsSectionTitle = document.getElementById("shortcuts-section-title");
  const googleSearch = document.getElementById("google-search");
  const shortcutFilterInput = document.getElementById("shortcut-filter");
  const addShortcutButton = document.getElementById("add-shortcut");

  const currentTime = document.getElementById("current-time");
  const currentDate = document.getElementById("current-date");
  const monthProgressBar = document.getElementById("month-progress-bar");
  const monthProgressLabel = document.getElementById("month-progress-label");

  const newsList = document.getElementById("news-list");
  const newsEmpty = document.getElementById("news-empty");
  const serverStatusList = document.getElementById("server-status-list");
  const serverEmpty = document.getElementById("server-empty");

  const backgroundSettingsButton = document.getElementById("background-settings-button");
  const backgroundSettingsPopup = document.getElementById("background-settings-popup");
  const backgroundColorInput = document.getElementById("background-color");
  const backgroundImageInput = document.getElementById("background-image");
  const applyBackgroundButton = document.getElementById("apply-background");
  const resetBackgroundButton = document.getElementById("reset-background");
  const closeBackgroundSettingsButton = document.getElementById("close-background-settings");

  const feedSettingsButton = document.getElementById("feed-settings-button");
  const feedSettingsModal = document.getElementById("feed-settings-modal");
  const newsSourcesInput = document.getElementById("news-sources-input");
  const serverEndpointsInput = document.getElementById("server-endpoints-input");
  const saveFeedSettingsButton = document.getElementById("save-feed-settings");
  const closeFeedSettingsButton = document.getElementById("close-feed-settings");

  const shortcutModal = document.getElementById("shortcut-modal");
  const shortcutModalTitle = document.getElementById("shortcut-modal-title");
  const shortcutForm = document.getElementById("shortcut-form");
  const shortcutNameInput = document.getElementById("shortcut-name-input");
  const shortcutUrlInput = document.getElementById("shortcut-url-input");
  const shortcutPinnedInput = document.getElementById("shortcut-pinned");
  const shortcutCancelButton = document.getElementById("shortcut-cancel");

  const NEWS_REFRESH_MS = 10 * 60 * 1000;
  const SERVER_REFRESH_MS = 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;

  const state = {
    shortcuts: [],
    filterQuery: "",
    editingIndex: null,
    background: {},
    dashboardSettings: {
      newsSourcesText: "",
      serverEndpointsText: ""
    }
  };

  const timeFormatter = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit"
  });
  const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "long"
  });
  const metaDateFormatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  function getStoredData(keys, callback) {
    chrome.storage.sync.get(keys, callback);
  }

  function saveStoredData(payload, callback = () => {}) {
    chrome.storage.sync.set(payload, callback);
  }

  function updateCurrentTime() {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const progress = Math.round((now.getDate() / daysInMonth) * 100);

    currentTime.textContent = timeFormatter.format(now);
    currentDate.textContent = dateFormatter.format(now);
    monthProgressBar.style.width = `${progress}%`;
    monthProgressLabel.textContent = `${progress}%`;
  }

  function normalizeUrl(rawValue) {
    const trimmed = (rawValue || "").trim();
    if (!trimmed) {
      return null;
    }

    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed)
      ? trimmed
      : `https://${trimmed}`;

    try {
      const parsed = new URL(withProtocol);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  function deriveLabelFromUrl(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return url;
    }
  }

  function parseConfiguredLines(text) {
    return (text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelPart, urlPart] = line.includes("|")
          ? line.split("|", 2)
          : ["", line];
        const url = normalizeUrl(urlPart);
        if (!url) {
          return null;
        }
        return {
          label: (labelPart || "").trim() || deriveLabelFromUrl(url),
          url
        };
      })
      .filter(Boolean);
  }

  function buildShortcut(rawUrl, rawName, pinned = false) {
    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      return null;
    }

    return {
      url: normalizedUrl,
      name: (rawName || "").trim() || normalizedUrl,
      pinned: Boolean(pinned)
    };
  }

  function applyBackground(background = {}) {
    const color = (background.color || "").trim();
    const imageUrl = normalizeUrl(background.imageUrl || "");

    state.background = background;

    if (color) {
      document.body.style.setProperty("--page-bg-color", color);
      document.body.style.setProperty("--page-bg-accent", color);
    } else {
      document.body.style.removeProperty("--page-bg-color");
      document.body.style.removeProperty("--page-bg-accent");
    }

    if (imageUrl) {
      document.body.style.backgroundImage = `url("${imageUrl}")`;
      document.body.style.backgroundPosition = "center";
      document.body.style.backgroundSize = "cover";
      document.body.style.backgroundRepeat = "no-repeat";
    } else {
      document.body.style.backgroundImage = "";
      document.body.style.backgroundPosition = "";
      document.body.style.backgroundSize = "";
      document.body.style.backgroundRepeat = "";
    }

    backgroundColorInput.value = color || "#f6efe3";
    backgroundImageInput.value = imageUrl || "";
  }

  function loadSettingsAndBackground(callback = () => {}) {
    getStoredData(["background", "dashboardSettings"], (data) => {
      state.dashboardSettings = {
        newsSourcesText: data.dashboardSettings?.newsSourcesText || "",
        serverEndpointsText: data.dashboardSettings?.serverEndpointsText || ""
      };
      newsSourcesInput.value = state.dashboardSettings.newsSourcesText;
      serverEndpointsInput.value = state.dashboardSettings.serverEndpointsText;
      applyBackground(data.background || {});
      callback();
    });
  }

  function saveShortcuts(shortcuts, callback = () => {}) {
    saveStoredData({ shortcuts }, callback);
  }

  function getFilteredShortcuts() {
    const query = state.filterQuery.trim().toLowerCase();
    return state.shortcuts
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!query) {
          return true;
        }
        return (
          (item.name || "").toLowerCase().includes(query) ||
          (item.url || "").toLowerCase().includes(query)
        );
      });
  }

  function updateEmptyStates(pinnedVisibleCount, regularVisibleCount) {
    pinnedEmptyState.hidden = pinnedVisibleCount > 0;
    pinnedEmptyState.textContent = state.filterQuery
      ? "条件に一致する固定ショートカットがありません。"
      : "固定したショートカットはここに表示されます。";

    emptyState.hidden = regularVisibleCount > 0;
    emptyState.textContent = state.filterQuery
      ? "条件に一致する通常ショートカットがありません。"
      : "通常ショートカットはまだありません。「ショートカット追加」から登録できます。";
  }

  function updateShortcutSummary(pinnedVisibleCount, regularVisibleCount) {
    const totalPinned = state.shortcuts.filter((item) => item.pinned).length;
    const totalRegular = state.shortcuts.length - totalPinned;

    pinnedShortcutCount.textContent = `${pinnedVisibleCount}/${totalPinned}`;
    regularShortcutCount.textContent = `${regularVisibleCount}/${totalRegular}`;
    shortcutCount.textContent = `${pinnedVisibleCount + regularVisibleCount}/${state.shortcuts.length}`;
    shortcutsSectionTitle.textContent = state.filterQuery ? "絞り込み結果" : "通常ショートカット";
  }

  function createShortcutElement(item, index) {
    const normalizedUrl = normalizeUrl(item.url);
    if (!normalizedUrl) {
      return null;
    }

    const url = new URL(normalizedUrl);
    const displayName = (item.name || "").trim() || url.hostname;
    const shortcutEl = document.createElement("div");
    shortcutEl.className = `shortcut${item.pinned ? " is-pinned" : ""}`;
    shortcutEl.dataset.index = String(index);
    shortcutEl.title = normalizedUrl;

    const contentContainer = document.createElement("div");
    contentContainer.className = "shortcut-content";

    const favicon = document.createElement("img");
    favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
    favicon.className = "shortcut-icon";
    favicon.alt = "";
    favicon.addEventListener("error", () => {
      favicon.style.display = "none";
    });
    contentContainer.appendChild(favicon);

    const textContainer = document.createElement("div");
    textContainer.className = "shortcut-text";

    const nameEl = document.createElement("span");
    nameEl.className = "shortcut-name";
    nameEl.textContent = displayName;
    textContainer.appendChild(nameEl);

    if (item.pinned) {
      const badge = document.createElement("span");
      badge.className = "shortcut-badge";
      badge.textContent = "固定";
      textContainer.appendChild(badge);
    }

    const urlEl = document.createElement("span");
    urlEl.className = "shortcut-url";
    urlEl.textContent = url.hostname;
    textContainer.appendChild(urlEl);

    contentContainer.appendChild(textContainer);
    shortcutEl.appendChild(contentContainer);

    const moreBtn = document.createElement("button");
    moreBtn.className = "more-shortcut";
    moreBtn.type = "button";
    moreBtn.textContent = "⋮";
    moreBtn.setAttribute("aria-label", `${displayName} の操作を開く`);
    moreBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      showMoreOptions(item, index);
    });
    shortcutEl.appendChild(moreBtn);

    shortcutEl.addEventListener("click", () => {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    });

    return shortcutEl;
  }

  function renderShortcuts() {
    const filtered = getFilteredShortcuts();
    const pinnedShortcuts = filtered.filter(({ item }) => item.pinned);
    const regularShortcuts = filtered.filter(({ item }) => !item.pinned);

    pinnedContainer.innerHTML = "";
    shortcutContainer.innerHTML = "";

    pinnedShortcuts.forEach(({ item, index }) => {
      const el = createShortcutElement(item, index);
      if (el) {
        pinnedContainer.appendChild(el);
      }
    });

    regularShortcuts.forEach(({ item, index }) => {
      const el = createShortcutElement(item, index);
      if (el) {
        shortcutContainer.appendChild(el);
      }
    });

    updateEmptyStates(pinnedShortcuts.length, regularShortcuts.length);
    updateShortcutSummary(pinnedShortcuts.length, regularShortcuts.length);
  }

  function loadShortcuts() {
    getStoredData("shortcuts", (data) => {
      const shortcuts = Array.isArray(data.shortcuts) ? data.shortcuts : [];
      state.shortcuts = shortcuts.map((item) => ({
        ...item,
        pinned: Boolean(item.pinned)
      }));
      renderShortcuts();
    });
  }

  function openShortcutModal(mode, index = null) {
    state.editingIndex = index;

    if (mode === "edit" && index !== null && state.shortcuts[index]) {
      const item = state.shortcuts[index];
      shortcutModalTitle.textContent = "ショートカットを編集";
      shortcutNameInput.value = item.name || "";
      shortcutUrlInput.value = item.url || "";
      shortcutPinnedInput.checked = Boolean(item.pinned);
    } else {
      shortcutModalTitle.textContent = "ショートカットを追加";
      shortcutForm.reset();
      shortcutPinnedInput.checked = false;
    }

    shortcutModal.hidden = false;
    shortcutUrlInput.focus();
  }

  function closeShortcutModal() {
    shortcutModal.hidden = true;
    state.editingIndex = null;
    shortcutForm.reset();
    shortcutPinnedInput.checked = false;
  }

  function closeBackgroundSettings() {
    backgroundSettingsPopup.hidden = true;
  }

  function openBackgroundSettings() {
    backgroundSettingsPopup.hidden = false;
  }

  function closeFeedSettings() {
    feedSettingsModal.hidden = true;
  }

  function openFeedSettings() {
    newsSourcesInput.value = state.dashboardSettings.newsSourcesText;
    serverEndpointsInput.value = state.dashboardSettings.serverEndpointsText;
    feedSettingsModal.hidden = false;
  }

  function closePopup() {
    const popup = document.querySelector('[data-transient-popup="true"]');
    if (popup) {
      document.body.removeChild(popup);
    }
  }

  function submitShortcutForm(event) {
    event.preventDefault();

    const nextShortcut = buildShortcut(
      shortcutUrlInput.value,
      shortcutNameInput.value,
      shortcutPinnedInput.checked
    );

    if (!nextShortcut) {
      alert("有効な http または https の URL を入力してください。");
      shortcutUrlInput.focus();
      return;
    }

    const nextShortcuts = [...state.shortcuts];
    if (state.editingIndex !== null && nextShortcuts[state.editingIndex]) {
      nextShortcuts[state.editingIndex] = nextShortcut;
    } else {
      nextShortcuts.push(nextShortcut);
    }

    saveShortcuts(nextShortcuts, () => {
      closeShortcutModal();
      loadShortcuts();
    });
  }

  function removeShortcut(index) {
    const nextShortcuts = [...state.shortcuts];
    nextShortcuts.splice(index, 1);
    saveShortcuts(nextShortcuts, loadShortcuts);
  }

  function togglePinShortcut(index) {
    const nextShortcuts = [...state.shortcuts];
    if (!nextShortcuts[index]) {
      return;
    }

    nextShortcuts[index] = {
      ...nextShortcuts[index],
      pinned: !nextShortcuts[index].pinned
    };

    saveShortcuts(nextShortcuts, () => {
      closePopup();
      loadShortcuts();
    });
  }

  function reorderSection(newOrder, pinned) {
    const matching = newOrder
      .map((index) => state.shortcuts[index])
      .filter((item) => item && Boolean(item.pinned) === pinned);
    const others = state.shortcuts.filter((item) => Boolean(item.pinned) !== pinned);
    const nextShortcuts = pinned ? [...matching, ...others] : [...others, ...matching];
    saveShortcuts(nextShortcuts, loadShortcuts);
  }

  function showMoreOptions(item, index) {
    closePopup();

    const popup = document.createElement("div");
    popup.className = "popup";
    popup.dataset.transientPopup = "true";
    popup.addEventListener("click", (event) => {
      if (event.target === popup) {
        closePopup();
      }
    });

    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";

    const popupTitle = document.createElement("h2");
    popupTitle.textContent = "その他の操作";
    popupContent.appendChild(popupTitle);

    const popupDescription = document.createElement("p");
    popupDescription.textContent = item.name || item.url;
    popupContent.appendChild(popupDescription);

    const editButton = document.createElement("button");
    editButton.className = "button-primary";
    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.addEventListener("click", () => {
      closePopup();
      openShortcutModal("edit", index);
    });
    popupContent.appendChild(editButton);

    const pinButton = document.createElement("button");
    pinButton.className = "button-neutral";
    pinButton.type = "button";
    pinButton.textContent = item.pinned ? "ピン解除" : "ピン留め";
    pinButton.addEventListener("click", () => {
      togglePinShortcut(index);
    });
    popupContent.appendChild(pinButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "button-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => {
      if (confirm("このショートカットを削除しますか？")) {
        removeShortcut(index);
        closePopup();
      }
    });
    popupContent.appendChild(deleteButton);

    const cancelButton = document.createElement("button");
    cancelButton.className = "button-neutral";
    cancelButton.type = "button";
    cancelButton.textContent = "キャンセル";
    cancelButton.addEventListener("click", closePopup);
    popupContent.appendChild(cancelButton);

    popup.appendChild(popupContent);
    document.body.appendChild(popup);
  }

  function addDroppedShortcut(text) {
    const shortcut = buildShortcut(text, "");
    if (!shortcut) {
      return;
    }
    saveShortcuts([...state.shortcuts, shortcut], loadShortcuts);
  }

  function createInfoMetaChip(text, className = "status-chip") {
    const chip = document.createElement("span");
    chip.className = className;
    chip.textContent = text;
    return chip;
  }

  function renderNewsItems(items, emptyMessage) {
    newsList.innerHTML = "";
    if (!items.length) {
      newsEmpty.hidden = false;
      newsEmpty.textContent = emptyMessage;
      return;
    }

    newsEmpty.hidden = true;
    items.forEach((item) => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = item.link || "#";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = item.title;
      li.appendChild(link);

      if (item.description) {
        const desc = document.createElement("p");
        desc.textContent = item.description;
        li.appendChild(desc);
      }

      const meta = document.createElement("div");
      meta.className = "info-meta";
      meta.appendChild(createInfoMetaChip(item.source));
      if (item.publishedAt) {
        meta.appendChild(createInfoMetaChip(metaDateFormatter.format(item.publishedAt), "status-chip status-chip--soft"));
      }
      li.appendChild(meta);
      newsList.appendChild(li);
    });
  }

  function renderServerItems(items, emptyMessage) {
    serverStatusList.innerHTML = "";
    if (!items.length) {
      serverEmpty.hidden = false;
      serverEmpty.textContent = emptyMessage;
      return;
    }

    serverEmpty.hidden = true;
    items.forEach((item) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.label;
      li.appendChild(title);

      const desc = document.createElement("p");
      desc.textContent = item.detail;
      li.appendChild(desc);

      const meta = document.createElement("div");
      meta.className = "info-meta";
      meta.appendChild(createInfoMetaChip(item.status, `status-chip ${item.statusClass}`));
      if (item.latencyMs !== null) {
        meta.appendChild(createInfoMetaChip(`${item.latencyMs} ms`, "status-chip status-chip--soft"));
      }
      if (item.checkedAt) {
        meta.appendChild(createInfoMetaChip(metaDateFormatter.format(item.checkedAt), "status-chip status-chip--soft"));
      }
      li.appendChild(meta);
      serverStatusList.appendChild(li);
    });
  }

  async function fetchTextWithTimeout(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        cache: "no-store"
      });
      const text = await response.text();
      return { response, text };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function parseFeedItems(xmlText, sourceLabel) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      return [];
    }

    const nodes = Array.from(doc.querySelectorAll("item, entry")).slice(0, 4);
    return nodes
      .map((node) => {
        const title = node.querySelector("title")?.textContent?.trim();
        const linkNode = node.querySelector("link");
        const link =
          linkNode?.getAttribute("href") ||
          linkNode?.textContent?.trim() ||
          "";
        const description =
          node.querySelector("description, summary")?.textContent?.trim() || "";
        const publishedText =
          node.querySelector("pubDate, updated, published")?.textContent?.trim() || "";
        const publishedAt = publishedText ? new Date(publishedText) : null;

        if (!title || !link) {
          return null;
        }

        return {
          source: sourceLabel,
          title,
          link,
          description: description.slice(0, 120),
          publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null
        };
      })
      .filter(Boolean);
  }

  async function refreshNewsPanel() {
    const sources = parseConfiguredLines(state.dashboardSettings.newsSourcesText);
    if (!sources.length) {
      renderNewsItems([], "まだニュースソースがありません。「情報設定」から登録してください。");
      return;
    }

    const settled = await Promise.allSettled(
      sources.map(async (source) => {
        const { text } = await fetchTextWithTimeout(source.url);
        return parseFeedItems(text, source.label);
      })
    );

    const items = settled
      .filter((entry) => entry.status === "fulfilled")
      .flatMap((entry) => entry.value)
      .sort((a, b) => {
        if (!a.publishedAt || !b.publishedAt) {
          return 0;
        }
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      })
      .slice(0, 8);

    renderNewsItems(
      items,
      "ニュースソースに接続できませんでした。URL や RSS/Atom 形式を確認してください。"
    );
  }

  async function probeServer(endpoint) {
    const startedAt = performance.now();
    try {
      const { response, text } = await fetchTextWithTimeout(endpoint.url);
      const latencyMs = Math.round(performance.now() - startedAt);
      let status = response.ok ? "HEALTHY" : `HTTP ${response.status}`;
      let detail = endpoint.url;
      let statusClass = response.ok ? "status-chip--healthy" : "status-chip--error";

      try {
        const json = JSON.parse(text);
        if (typeof json.status === "string") {
          status = json.status.toUpperCase();
        } else if (typeof json.ok === "boolean") {
          status = json.ok ? "HEALTHY" : "UNHEALTHY";
        }
        detail =
          json.message ||
          json.detail ||
          json.version ||
          endpoint.url;
        statusClass = /healthy|ok|up/i.test(status)
          ? "status-chip--healthy"
          : "status-chip--error";
      } catch {
        if (/healthy|ok|up/i.test(text)) {
          status = "HEALTHY";
          statusClass = "status-chip--healthy";
        }
      }

      return {
        label: endpoint.label,
        status,
        detail,
        latencyMs,
        checkedAt: new Date(),
        statusClass
      };
    } catch (error) {
      return {
        label: endpoint.label,
        status: "UNREACHABLE",
        detail: error.name === "AbortError" ? "タイムアウトしました" : "接続できませんでした",
        latencyMs: null,
        checkedAt: new Date(),
        statusClass: "status-chip--error"
      };
    }
  }

  async function refreshServerPanel() {
    const endpoints = parseConfiguredLines(state.dashboardSettings.serverEndpointsText);
    if (!endpoints.length) {
      renderServerItems([], "監視先がありません。「情報設定」から health endpoint を追加してください。");
      return;
    }

    const results = await Promise.all(endpoints.map((endpoint) => probeServer(endpoint)));
    renderServerItems(results, "サーバー状態を取得できませんでした。");
  }

  function schedulePanelRefresh() {
    refreshNewsPanel();
    refreshServerPanel();
    window.setInterval(refreshNewsPanel, NEWS_REFRESH_MS);
    window.setInterval(refreshServerPanel, SERVER_REFRESH_MS);
  }

  googleSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const query = googleSearch.value.trim();
      if (query) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });

  shortcutFilterInput.addEventListener("input", (event) => {
    state.filterQuery = event.target.value;
    renderShortcuts();
  });

  addShortcutButton.addEventListener("click", () => {
    openShortcutModal("create");
  });

  shortcutForm.addEventListener("submit", submitShortcutForm);
  shortcutCancelButton.addEventListener("click", closeShortcutModal);

  shortcutModal.addEventListener("click", (event) => {
    if (event.target === shortcutModal) {
      closeShortcutModal();
    }
  });

  if (typeof Sortable !== "undefined") {
    new Sortable(pinnedContainer, {
      animation: 150,
      onEnd: () => {
        if (state.filterQuery) {
          loadShortcuts();
          return;
        }
        const newOrder = Array.from(pinnedContainer.children).map((el) => Number(el.dataset.index));
        reorderSection(newOrder, true);
      }
    });

    new Sortable(shortcutContainer, {
      animation: 150,
      onEnd: () => {
        if (state.filterQuery) {
          loadShortcuts();
          return;
        }
        const newOrder = Array.from(shortcutContainer.children).map((el) => Number(el.dataset.index));
        reorderSection(newOrder, false);
      }
    });
  }

  [pinnedContainer, shortcutContainer].forEach((container) => {
    container.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    container.addEventListener("drop", (event) => {
      event.preventDefault();
      const uriList = event.dataTransfer.getData("text/uri-list");
      const text = uriList || event.dataTransfer.getData("text/plain");
      if (text) {
        addDroppedShortcut(text.split("\n")[0]);
      }
    });
  });

  backgroundSettingsButton.addEventListener("click", openBackgroundSettings);
  closeBackgroundSettingsButton.addEventListener("click", closeBackgroundSettings);
  backgroundSettingsPopup.addEventListener("click", (event) => {
    if (event.target === backgroundSettingsPopup) {
      closeBackgroundSettings();
    }
  });

  applyBackgroundButton.addEventListener("click", () => {
    const nextBackground = {
      color: backgroundColorInput.value,
      imageUrl: backgroundImageInput.value.trim()
    };

    if (nextBackground.imageUrl && !normalizeUrl(nextBackground.imageUrl)) {
      alert("背景画像URLには有効な http または https の URL を入力してください。");
      return;
    }

    saveStoredData({ background: nextBackground }, () => {
      applyBackground(nextBackground);
      closeBackgroundSettings();
    });
  });

  resetBackgroundButton.addEventListener("click", () => {
    saveStoredData({ background: {} }, () => {
      applyBackground({});
      closeBackgroundSettings();
    });
  });

  feedSettingsButton.addEventListener("click", openFeedSettings);
  closeFeedSettingsButton.addEventListener("click", closeFeedSettings);
  feedSettingsModal.addEventListener("click", (event) => {
    if (event.target === feedSettingsModal) {
      closeFeedSettings();
    }
  });

  saveFeedSettingsButton.addEventListener("click", () => {
    state.dashboardSettings = {
      newsSourcesText: newsSourcesInput.value.trim(),
      serverEndpointsText: serverEndpointsInput.value.trim()
    };

    saveStoredData({ dashboardSettings: state.dashboardSettings }, () => {
      closeFeedSettings();
      refreshNewsPanel();
      refreshServerPanel();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopup();
      closeBackgroundSettings();
      closeFeedSettings();
      closeShortcutModal();
    }
  });

  updateCurrentTime();
  window.setInterval(updateCurrentTime, 1000);
  loadSettingsAndBackground(schedulePanelRefresh);
  loadShortcuts();
});
