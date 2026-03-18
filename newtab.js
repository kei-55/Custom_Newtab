document.addEventListener("DOMContentLoaded", () => {
  const shortcutContainer = document.getElementById("shortcut-container");
  const addShortcutButton = document.getElementById("add-shortcut");
  const googleSearch = document.getElementById("google-search");
  const shortcutFilterInput = document.getElementById("shortcut-filter");
  const emptyState = document.getElementById("empty-state");
  const shortcutCount = document.getElementById("shortcut-count");
  const shortcutsSectionTitle = document.getElementById("shortcuts-section-title");

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
    editingIndex: null
  };

  function getStoredData(keys, callback) {
    chrome.storage.sync.get(keys, callback);
  }

  function getStoredShortcuts(callback) {
    getStoredData("shortcuts", (data) => {
      const shortcuts = Array.isArray(data.shortcuts) ? data.shortcuts : [];
      callback(shortcuts);
    });
  }

  function saveShortcuts(shortcuts, callback = () => {}) {
    chrome.storage.sync.set({ shortcuts }, callback);
  }

  function saveBackground(background, callback = () => {}) {
    chrome.storage.sync.set({ background }, callback);
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

    const normalizedName = (rawName || "").trim() || normalizedUrl;
    return {
      url: normalizedUrl,
      name: normalizedName,
      pinned: Boolean(pinned)
    };
  }

  function applyBackground(background = {}) {
    const color = (background.color || "").trim();
    const imageUrl = normalizeUrl(background.imageUrl || "");

    document.body.style.backgroundColor = color || "";
    document.body.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";

    if (backgroundColorInput) {
      backgroundColorInput.value = color || "#f6efe3";
    }
    if (backgroundImageInput) {
      backgroundImageInput.value = imageUrl || "";
    }
  }

  function loadBackground() {
    getStoredData("background", (data) => {
      applyBackground(data.background || {});
    });
  }

  function toggleEmptyState(hasItems) {
    if (emptyState) {
      emptyState.hidden = hasItems;
      emptyState.textContent = state.filterQuery
        ? "条件に一致するショートカットがありません。"
        : "まだショートカットがありません。「ショートカット追加」から登録できます。";
    }
  }

  function updateShortcutSummary(totalCount, visibleCount) {
    if (shortcutCount) {
      shortcutCount.textContent = `${visibleCount}/${totalCount}`;
    }

    if (shortcutsSectionTitle) {
      shortcutsSectionTitle.textContent = state.filterQuery
        ? "絞り込み結果"
        : "ショートカット";
    }
  }

  function getFilteredShortcuts() {
    const query = state.filterQuery.trim().toLowerCase();
    const normalized = state.shortcuts.map((item, index) => ({ item, index }));

    const filtered = query
      ? normalized.filter(({ item }) => {
          const name = (item.name || "").toLowerCase();
          const url = (item.url || "").toLowerCase();
          return name.includes(query) || url.includes(query);
        })
      : normalized;

    return filtered.sort((a, b) => {
      if (Boolean(a.item.pinned) !== Boolean(b.item.pinned)) {
        return a.item.pinned ? -1 : 1;
      }
      return a.index - b.index;
    });
  }

  function createShortcutElement(item, index) {
    if (!item || typeof item.url !== "string") {
      return null;
    }

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

    const urlEl = document.createElement("span");
    urlEl.className = "shortcut-url";
    urlEl.textContent = url.hostname;

    textContainer.appendChild(nameEl);

    if (item.pinned) {
      const badge = document.createElement("span");
      badge.className = "shortcut-badge";
      badge.textContent = "固定";
      textContainer.appendChild(badge);
    }

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
    shortcutContainer.innerHTML = "";

    let renderedCount = 0;
    filteredShortcuts.forEach(({ item, index }) => {
      const shortcutEl = createShortcutElement(item, index);
      if (shortcutEl) {
        shortcutContainer.appendChild(shortcutEl);
        renderedCount += 1;
      }
    });

    updateShortcutSummary(state.shortcuts.length, renderedCount);
    toggleEmptyState(renderedCount > 0);
  }

  function loadShortcuts() {
    getStoredShortcuts((shortcuts) => {
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

  function closePopup() {
    const popup = document.querySelector('[data-transient-popup="true"]');
    if (popup) {
      document.body.removeChild(popup);
    }
  }

  function reorderShortcuts(newOrder) {
    const pinnedItems = newOrder
      .map((index) => state.shortcuts[index])
      .filter((item) => item && item.pinned);
    const regularItems = newOrder
      .map((index) => state.shortcuts[index])
      .filter((item) => item && !item.pinned);

    saveShortcuts([...pinnedItems, ...regularItems], loadShortcuts);
  }

  function addDroppedShortcut(text) {
    const shortcut = buildShortcut(text, "");
    if (!shortcut) {
      return;
    }

    saveShortcuts([...state.shortcuts, shortcut], loadShortcuts);
  }

  function closeBackgroundSettings() {
    if (backgroundSettingsPopup) {
      backgroundSettingsPopup.hidden = true;
    }
  }

  function openBackgroundSettings() {
    if (backgroundSettingsPopup) {
      backgroundSettingsPopup.hidden = false;
    }
  }

  googleSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const query = googleSearch.value.trim();
      if (query) {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });

  if (shortcutFilterInput) {
    shortcutFilterInput.addEventListener("input", (event) => {
      state.filterQuery = event.target.value;
      renderShortcuts();
    });
  }

  if (typeof Sortable !== "undefined" && shortcutContainer) {
    new Sortable(shortcutContainer, {
      animation: 150,
      onEnd: () => {
        if (state.filterQuery) {
          loadShortcuts();
          return;
        }

        const newOrder = Array.from(shortcutContainer.children).map((el) => Number(el.dataset.index));
        reorderShortcuts(newOrder);
      }
    });
  }

  shortcutContainer.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  shortcutContainer.addEventListener("drop", (event) => {
    event.preventDefault();

    const uriList = event.dataTransfer.getData("text/uri-list");
    const text = uriList || event.dataTransfer.getData("text/plain");
    if (!text) {
      return;
    }

    addDroppedShortcut(text.split("\n")[0]);
  });

  if (backgroundSettingsButton) {
    backgroundSettingsButton.addEventListener("click", openBackgroundSettings);
  }

  if (closeBackgroundSettingsButton) {
    closeBackgroundSettingsButton.addEventListener("click", closeBackgroundSettings);
  }

  if (backgroundSettingsPopup) {
    backgroundSettingsPopup.addEventListener("click", (event) => {
      if (event.target === backgroundSettingsPopup) {
        closeBackgroundSettings();
      }
    });
  }

  if (applyBackgroundButton) {
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
  }

  if (resetBackgroundButton) {
    resetBackgroundButton.addEventListener("click", () => {
      saveBackground({}, () => {
        applyBackground({});
        closeBackgroundSettings();
      });
    });
  }

  if (addShortcutButton) {
    addShortcutButton.addEventListener("click", () => {
      openShortcutModal("create");
    });
  }

  if (shortcutForm) {
    shortcutForm.addEventListener("submit", submitShortcutForm);
  }

  if (shortcutCancelButton) {
    shortcutCancelButton.addEventListener("click", closeShortcutModal);
  }

  if (shortcutModal) {
    shortcutModal.addEventListener("click", (event) => {
      if (event.target === shortcutModal) {
        closeShortcutModal();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopup();
      closeBackgroundSettings();
      closeShortcutModal();
    }
  });

  loadBackground();
  loadShortcuts();
});
