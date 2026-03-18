document.addEventListener("DOMContentLoaded", () => {
  const shortcutContainer = document.getElementById("shortcut-container");
  const addShortcutButton = document.getElementById("add-shortcut");
  const googleSearch = document.getElementById("google-search");
  const emptyState = document.getElementById("empty-state");
  const backgroundColorInput = document.getElementById("background-color");
  const backgroundImageInput = document.getElementById("background-image");
  const applyBackgroundButton = document.getElementById("apply-background");
  const resetBackgroundButton = document.getElementById("reset-background");
  const backgroundSettingsButton = document.getElementById("background-settings-button");
  const backgroundSettingsPopup = document.getElementById("background-settings-popup");
  const closeBackgroundSettingsButton = document.getElementById("close-background-settings");

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

  function buildShortcut(rawUrl, rawName) {
    const normalizedUrl = normalizeUrl(rawUrl);
    if (!normalizedUrl) {
      return null;
    }

    const normalizedName = (rawName || "").trim() || normalizedUrl;
    return { url: normalizedUrl, name: normalizedName };
  }

  function toggleEmptyState(shortcuts) {
    if (!emptyState) {
      return;
    }
    emptyState.hidden = shortcuts.length > 0;
  }

  function applyBackground(background = {}) {
    const color = (background.color || "").trim();
    const imageUrl = normalizeUrl(background.imageUrl || "");

    if (color) {
      document.body.style.backgroundColor = color;
    } else {
      document.body.style.backgroundColor = "";
    }

    if (imageUrl) {
      document.body.style.backgroundImage = `url("${imageUrl}")`;
    } else {
      document.body.style.backgroundImage = "";
    }

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

  function openBackgroundSettings() {
    if (backgroundSettingsPopup) {
      backgroundSettingsPopup.hidden = false;
    }
  }

  function closeBackgroundSettings() {
    if (backgroundSettingsPopup) {
      backgroundSettingsPopup.hidden = true;
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

  function loadShortcuts() {
    getStoredShortcuts((shortcuts) => {
      shortcutContainer.innerHTML = "";
      let renderedCount = 0;

      shortcuts.forEach((item, index) => {
        const shortcutEl = createShortcutElement(item, index);
        if (shortcutEl) {
          shortcutContainer.appendChild(shortcutEl);
          renderedCount += 1;
        }
      });

      toggleEmptyState(new Array(renderedCount));
    });
  }

  function addShortcut() {
    const rawUrl = prompt("ショートカットのURLを入力してください:");
    if (!rawUrl) {
      return;
    }

    const rawName = prompt("ショートカットの名前を入力してください:");
    const shortcut = buildShortcut(rawUrl, rawName);

    if (!shortcut) {
      alert("有効な http または https の URL を入力してください。");
      return;
    }

    getStoredShortcuts((shortcuts) => {
      shortcuts.push(shortcut);
      saveShortcuts(shortcuts, loadShortcuts);
    });
  }

  function removeShortcut(index) {
    getStoredShortcuts((shortcuts) => {
      shortcuts.splice(index, 1);
      saveShortcuts(shortcuts, loadShortcuts);
    });
  }

  function editShortcut(item, index) {
    const newUrlInput = prompt("ショートカットの新しいURL:", item.url);
    if (!newUrlInput) {
      return;
    }

    const newNameInput = prompt("ショートカットの新しい名前:", item.name || "");
    const updatedShortcut = buildShortcut(newUrlInput, newNameInput);

    if (!updatedShortcut) {
      alert("有効な http または https の URL を入力してください。");
      return;
    }

    getStoredShortcuts((shortcuts) => {
      if (shortcuts[index]) {
        shortcuts[index] = updatedShortcut;
      }
      saveShortcuts(shortcuts, loadShortcuts);
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
    shortcutEl.className = "shortcut";
    shortcutEl.dataset.index = index;
    shortcutEl.title = normalizedUrl;

    const contentContainer = document.createElement("div");
    contentContainer.className = "shortcut-content";

    const favicon = document.createElement("img");
    favicon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
    favicon.className = "shortcut-icon";
    favicon.alt = "";
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

  function showMoreOptions(item, index) {
    closePopup();

    const popup = document.createElement("div");
    popup.className = "popup";
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
    editButton.type = "button";
    editButton.innerText = "編集";
    editButton.addEventListener("click", () => {
      editShortcut(item, index);
      closePopup();
    });
    popupContent.appendChild(editButton);

    const deleteButton = document.createElement("button");
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
    cancelButton.type = "button";
    cancelButton.innerText = "キャンセル";
    cancelButton.addEventListener("click", () => {
      closePopup();
    });
    popupContent.appendChild(cancelButton);

    popup.appendChild(popupContent);
    document.body.appendChild(popup);
  }

  function closePopup() {
    const popup = document.querySelector(".popup:not([hidden])");
    if (popup && popup !== backgroundSettingsPopup) {
      document.body.removeChild(popup);
    }
  }

  if (typeof Sortable !== "undefined" && shortcutContainer) {
    new Sortable(shortcutContainer, {
      animation: 150,
      onEnd: () => {
        const newOrder = Array.from(shortcutContainer.children).map((el) => Number(el.dataset.index));
        reorderShortcuts(newOrder);
      }
    });
  }

  function reorderShortcuts(newOrder) {
    getStoredShortcuts((shortcuts) => {
      const reordered = newOrder
        .map((idx) => shortcuts[idx])
        .filter(Boolean);
      saveShortcuts(reordered, loadShortcuts);
    });
  }

  function addDroppedShortcut(text) {
    const shortcut = buildShortcut(text, "");
    if (!shortcut) {
      return;
    }

    getStoredShortcuts((shortcuts) => {
      shortcuts.push(shortcut);
      saveShortcuts(shortcuts, loadShortcuts);
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
      addShortcut();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closePopup();
      closeBackgroundSettings();
    }
  });

  loadBackground();
  loadShortcuts();
});
