document.addEventListener("DOMContentLoaded", () => {
  const pinnedContainer = document.getElementById("pinned-container");
  const shortcutContainer = document.getElementById("shortcut-container");
  const pinnedEmptyState = document.getElementById("pinned-empty-state");
  const addShortcutButton = document.getElementById("add-shortcut");
  const googleSearch = document.getElementById("google-search");
  const shortcutFilterInput = document.getElementById("shortcut-filter");
  const emptyState = document.getElementById("empty-state");
  const shortcutCount = document.getElementById("shortcut-count");
  const pinnedShortcutCount = document.getElementById("pinned-shortcut-count");
  const regularShortcutCount = document.getElementById("regular-shortcut-count");
  const shortcutsSectionTitle = document.getElementById("shortcuts-section-title");
  const currentTime = document.getElementById("current-time");
  const currentDate = document.getElementById("current-date");
  const monthProgressBar = document.getElementById("month-progress-bar");
  const monthProgressLabel = document.getElementById("month-progress-label");
  const backgroundStatus = document.getElementById("background-status");
  const lastUpdated = document.getElementById("last-updated");

  const shortcutModal = document.getElementById("shortcut-modal");
  const shortcutModalTitle = document.getElementById("shortcut-modal-title");
  const shortcutForm = document.getElementById("shortcut-form");
  const shortcutNameInput = document.getElementById("shortcut-name-input");
  const shortcutUrlInput = document.getElementById("shortcut-url-input");
  const shortcutPinnedInput = document.getElementById("shortcut-pinned");
  const shortcutCancelButton = document.getElementById("shortcut-cancel");

  const backgroundColorInput = document.getElementById("background-color");
  const backgroundImageInput = document.getElementById("background-image");
  const applyBackgroundButton = document.getElementById("apply-background");
  const resetBackgroundButton = document.getElementById("reset-background");
  const backgroundSettingsButton = document.getElementById("background-settings-button");
  const backgroundSettingsPopup = document.getElementById("background-settings-popup");
  const closeBackgroundSettingsButton = document.getElementById("close-background-settings");

  const state = {
    shortcuts: [],
    filterQuery: "",
    editingIndex: null,
    background: {},
    lastShortcutUpdateAt: ""
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
  const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  function getStoredData(keys, callback) {
    chrome.storage.sync.get(keys, callback);
  }

  function updateCurrentTime() {
    const now = new Date();
    const progress = Math.min(
      100,
      Math.round((now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) * 100)
    );

    if (currentTime) {
      currentTime.textContent = timeFormatter.format(now);
    }
    if (currentDate) {
      currentDate.textContent = dateFormatter.format(now);
    }
    if (monthProgressBar) {
      monthProgressBar.style.width = `${progress}%`;
    }
    if (monthProgressLabel) {
      monthProgressLabel.textContent = `${progress}%`;
    }
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

  function getBackgroundStatusLabel(background) {
    if (background && normalizeUrl(background.imageUrl || "")) {
      return "画像背景";
    }
    if (background && (background.color || "").trim()) {
      return "カラー背景";
    }
    return "未設定";
  }

  function updateBackgroundStatus() {
    if (backgroundStatus) {
      backgroundStatus.textContent = getBackgroundStatusLabel(state.background);
    }
  }

  function updateLastUpdated() {
    if (!lastUpdated) {
      return;
    }

    if (!state.lastShortcutUpdateAt) {
      lastUpdated.textContent = "まだ更新なし";
      return;
    }

    lastUpdated.textContent = dateTimeFormatter.format(new Date(state.lastShortcutUpdateAt));
  }

  function applyBackground(background = {}) {
    const color = (background.color || "").trim();
    const imageUrl = normalizeUrl(background.imageUrl || "");

    state.background = background;
    document.body.style.backgroundColor = color || "";
    document.body.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";

    if (backgroundColorInput) {
      backgroundColorInput.value = color || "#f6efe3";
    }
    if (backgroundImageInput) {
      backgroundImageInput.value = imageUrl || "";
    }

    updateBackgroundStatus();
  }

  function loadDashboardMeta() {
    getStoredData(["background", "lastShortcutUpdateAt"], (data) => {
      state.lastShortcutUpdateAt = data.lastShortcutUpdateAt || "";
      applyBackground(data.background || {});
      updateLastUpdated();
    });
  }

  function saveShortcuts(shortcuts, callback = () => {}) {
    const savedAt = new Date().toISOString();
    chrome.storage.sync.set(
      {
        shortcuts,
        lastShortcutUpdateAt: savedAt
      },
      () => {
        state.lastShortcutUpdateAt = savedAt;
        updateLastUpdated();
        callback();
      }
    );
  }

  function saveBackground(background, callback = () => {}) {
    chrome.storage.sync.set({ background }, () => {
      state.background = background;
      updateBackgroundStatus();
      callback();
    });
  }

  function getFilteredShortcuts() {
    const query = state.filterQuery.trim().toLowerCase();

    return state.shortcuts
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => {
        if (!query) {
          return true;
        }

        const name = (item.name || "").toLowerCase();
        const url = (item.url || "").toLowerCase();
        return name.includes(query) || url.includes(query);
      });
  }

  function updateEmptyStates(pinnedVisibleCount, regularVisibleCount) {
    if (emptyState) {
      const hasRegularItems = regularVisibleCount > 0;
      emptyState.hidden = hasRegularItems;
      emptyState.textContent = state.filterQuery
        ? "条件に一致する通常ショートカットがありません。"
        : "通常ショートカットはまだありません。「ショートカット追加」から登録できます。";
    }

    if (pinnedEmptyState) {
      const hasPinnedItems = pinnedVisibleCount > 0;
      pinnedEmptyState.hidden = hasPinnedItems;
      pinnedEmptyState.textContent = state.filterQuery
        ? "条件に一致する固定ショートカットがありません。"
        : "固定したショートカットはここに表示されます。";
    }
  }

  function updateShortcutSummary(pinnedVisibleCount, regularVisibleCount) {
    const totalVisible = pinnedVisibleCount + regularVisibleCount;
    const totalPinned = state.shortcuts.filter((item) => item.pinned).length;
    const totalRegular = state.shortcuts.length - totalPinned;

    if (shortcutCount) {
      shortcutCount.textContent = `${totalVisible}/${state.shortcuts.length}`;
    }
    if (pinnedShortcutCount) {
      pinnedShortcutCount.textContent = `${pinnedVisibleCount}/${totalPinned}`;
    }
    if (regularShortcutCount) {
      regularShortcutCount.textContent = `${regularVisibleCount}/${totalRegular}`;
    }
    if (shortcutsSectionTitle) {
      shortcutsSectionTitle.textContent = state.filterQuery ? "絞り込み結果" : "通常ショートカット";
    }
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
    moreBtn.innerText = "⋮";
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
    const filteredShortcuts = getFilteredShortcuts();
    const pinnedShortcuts = filteredShortcuts.filter(({ item }) => item.pinned);
    const regularShortcuts = filteredShortcuts.filter(({ item }) => !item.pinned);

    pinnedContainer.innerHTML = "";
    shortcutContainer.innerHTML = "";

    pinnedShortcuts.forEach(({ item, index }) => {
      const shortcutEl = createShortcutElement(item, index);
      if (shortcutEl) {
        pinnedContainer.appendChild(shortcutEl);
      }
    });

    regularShortcuts.forEach(({ item, index }) => {
      const shortcutEl = createShortcutElement(item, index);
      if (shortcutEl) {
        shortcutContainer.appendChild(shortcutEl);
      }
    });

    updateShortcutSummary(pinnedShortcuts.length, regularShortcuts.length);
    updateEmptyStates(pinnedShortcuts.length, regularShortcuts.length);
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

  function closePopup() {
    const popup = document.querySelector('[data-transient-popup="true"]');
    if (popup) {
      document.body.removeChild(popup);
    }
  }

  function closeBackgroundSettings() {
    backgroundSettingsPopup.hidden = true;
  }

  function openBackgroundSettings() {
    backgroundSettingsPopup.hidden = false;
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
    const matching = state.shortcuts.filter((item) => Boolean(item.pinned) === pinned);
    const others = state.shortcuts.filter((item) => Boolean(item.pinned) !== pinned);

    const reorderedMatching = newOrder
      .map((index) => state.shortcuts[index])
      .filter((item) => item && Boolean(item.pinned) === pinned);

    const nextShortcuts = pinned
      ? [...reorderedMatching, ...others]
      : [...others, ...reorderedMatching];

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
    popupTitle.innerText = "その他の操作";
    popupContent.appendChild(popupTitle);

    const popupDescription = document.createElement("p");
    popupDescription.innerText = item.name || item.url;
    popupContent.appendChild(popupDescription);

    const editButton = document.createElement("button");
    editButton.className = "button-primary";
    editButton.type = "button";
    editButton.innerText = "編集";
    editButton.addEventListener("click", () => {
      closePopup();
      openShortcutModal("edit", index);
    });
    popupContent.appendChild(editButton);

    const pinButton = document.createElement("button");
    pinButton.className = "button-neutral";
    pinButton.type = "button";
    pinButton.innerText = item.pinned ? "ピン解除" : "ピン留め";
    pinButton.addEventListener("click", () => {
      togglePinShortcut(index);
    });
    popupContent.appendChild(pinButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "button-danger";
    deleteButton.type = "button";
    deleteButton.innerText = "削除";
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
    cancelButton.innerText = "キャンセル";
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

    saveBackground(nextBackground, () => {
      applyBackground(nextBackground);
      closeBackgroundSettings();
    });
  });

  resetBackgroundButton.addEventListener("click", () => {
    saveBackground({}, () => {
      applyBackground({});
      closeBackgroundSettings();
    });
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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopup();
      closeBackgroundSettings();
      closeShortcutModal();
    }
  });

  updateCurrentTime();
  window.setInterval(updateCurrentTime, 1000);
  loadDashboardMeta();
  loadShortcuts();
});
