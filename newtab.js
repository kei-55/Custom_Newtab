document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);
  const els = {
    pinnedContainer: $("pinned-container"),
    shortcutContainer: $("shortcut-container"),
    pinnedEmpty: $("pinned-empty-state"),
    empty: $("empty-state"),
    count: $("shortcut-count"),
    pinnedCount: $("pinned-shortcut-count"),
    regularCount: $("regular-shortcut-count"),
    sectionTitle: $("shortcuts-section-title"),
    search: $("google-search"),
    filter: $("shortcut-filter"),
    addShortcut: $("add-shortcut"),
    addFolder: $("add-folder"),
    importBookmarks: $("import-bookmarks-button"),
    newsList: $("news-list"),
    newsEmpty: $("news-empty"),
    serverList: $("server-status-list"),
    serverEmpty: $("server-empty"),
    backgroundButton: $("background-settings-button"),
    backgroundPopup: $("background-settings-popup"),
    backgroundColor: $("background-color"),
    backgroundImage: $("background-image"),
    applyBackground: $("apply-background"),
    resetBackground: $("reset-background"),
    closeBackground: $("close-background-settings"),
    feedButton: $("feed-settings-button"),
    feedModal: $("feed-settings-modal"),
    newsSources: $("news-sources-input"),
    serverEndpoints: $("server-endpoints-input"),
    saveFeed: $("save-feed-settings"),
    closeFeed: $("close-feed-settings"),
    shortcutModal: $("shortcut-modal"),
    shortcutTitle: $("shortcut-modal-title"),
    shortcutForm: $("shortcut-form"),
    shortcutName: $("shortcut-name-input"),
    shortcutUrl: $("shortcut-url-input"),
    shortcutParent: $("shortcut-parent-folder"),
    shortcutPinned: $("shortcut-pinned"),
    shortcutCancel: $("shortcut-cancel"),
    folderModal: $("folder-modal"),
    folderForm: $("folder-form"),
    folderName: $("folder-name-input"),
    folderPinned: $("folder-pinned"),
    folderCancel: $("folder-cancel"),
    folderViewModal: $("folder-view-modal"),
    folderViewTitle: $("folder-view-title"),
    folderViewSubtitle: $("folder-view-subtitle"),
    folderViewList: $("folder-view-list"),
    folderViewEmpty: $("folder-view-empty"),
    folderAddShortcut: $("folder-add-shortcut"),
    folderClose: $("folder-close"),
    bookmarkModal: $("bookmark-import-modal"),
    bookmarkTree: $("bookmark-tree"),
    bookmarkEmpty: $("bookmark-tree-empty"),
    bookmarkImportSelected: $("bookmark-import-selected"),
    bookmarkImportAll: $("bookmark-import-all"),
    bookmarkClose: $("bookmark-close")
  };

  const SERVER_REFRESH_MS = 60 * 1000;
  const NEWS_REFRESH_MS = 15 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 8000;
  const DEFAULT_NEWS_SOURCES = [
    "Publickey|https://www.publickey1.jp/atom.xml",
    "InfoQ|https://www.infoq.com/feed/",
    "The Register Security|https://www.theregister.com/security/headlines.atom"
  ].join("\n");

  const state = {
    shortcuts: [],
    filterQuery: "",
    editingShortcutId: null,
    editingFolderId: null,
    activeFolderId: null,
    selectedBookmarkFolderId: null,
    bookmarkFolders: [],
    dashboardSettings: {
      newsSourcesText: "",
      serverEndpointsText: ""
    },
    newsRefreshTimerId: null,
    serverRefreshTimerId: null
  };

  const metaDateFormatter = new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const getStoredData = (keys, callback) => chrome.storage.sync.get(keys, callback);
  const saveStoredData = (payload, callback = () => {}) => chrome.storage.sync.set(payload, callback);
  const createId = () => typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  function normalizeUrl(rawValue) {
    const trimmed = (rawValue || "").trim();
    if (!trimmed) {
      return null;
    }
    const withProtocol = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(withProtocol);
      return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
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

  function createShortcut(rawUrl, rawName, pinned = false) {
    const url = normalizeUrl(rawUrl);
    if (!url) {
      return null;
    }
    return {
      type: "shortcut",
      id: createId(),
      url,
      name: (rawName || "").trim() || deriveLabelFromUrl(url),
      pinned: Boolean(pinned)
    };
  }

  function normalizeItems(items) {
    let changed = false;
    const normalized = (Array.isArray(items) ? items : []).map((item) => {
      if (item?.type === "folder") {
        changed = changed || !item.id;
        return {
          type: "folder",
          id: item.id || createId(),
          name: (item.name || "").trim() || "フォルダ",
          pinned: Boolean(item.pinned),
          children: Array.isArray(item.children)
            ? item.children.map((child) => {
                const next = createShortcut(child?.url, child?.name, false);
                if (!next) {
                  changed = true;
                  return null;
                }
                return { ...next, id: child?.id || next.id, pinned: false };
              }).filter(Boolean)
            : []
        };
      }
      const shortcut = createShortcut(item?.url, item?.name, item?.pinned);
      if (!shortcut) {
        changed = true;
        return null;
      }
      changed = changed || !item?.id || item?.type !== "shortcut";
      return { ...shortcut, id: item?.id || shortcut.id };
    }).filter(Boolean);
    return { items: normalized, changed };
  }

  function parseConfiguredLines(text) {
    return (text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [labelPart, urlPart] = line.includes("|") ? line.split("|", 2) : ["", line];
        const url = normalizeUrl(urlPart);
        if (!url) {
          return null;
        }
        return { label: (labelPart || "").trim() || deriveLabelFromUrl(url), url };
      })
      .filter(Boolean);
  }

  function applyBackground(background = {}) {
    const color = (background.color || "").trim();
    const imageUrl = normalizeUrl(background.imageUrl || "");
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
    els.backgroundColor.value = color || "#f6efe3";
    els.backgroundImage.value = imageUrl || "";
  }

  function loadSettingsAndBackground(callback = () => {}) {
    getStoredData(["background", "dashboardSettings"], (data) => {
      state.dashboardSettings = {
        newsSourcesText: data.dashboardSettings?.newsSourcesText || DEFAULT_NEWS_SOURCES,
        serverEndpointsText: data.dashboardSettings?.serverEndpointsText || ""
      };
      els.newsSources.value = state.dashboardSettings.newsSourcesText;
      els.serverEndpoints.value = state.dashboardSettings.serverEndpointsText;
      applyBackground(data.background || {});
      callback();
    });
  }

  function getFolderById(folderId) {
    return state.shortcuts.find((item) => item.type === "folder" && item.id === folderId) || null;
  }

  function getAllUrls(items = state.shortcuts) {
    const urls = new Set();
    items.forEach((item) => {
      if (item.type === "shortcut") {
        urls.add(item.url);
      } else {
        item.children.forEach((child) => urls.add(child.url));
      }
    });
    return urls;
  }

  function findShortcutLocation(shortcutId) {
    for (const item of state.shortcuts) {
      if (item.type === "shortcut" && item.id === shortcutId) {
        return { kind: "root", item };
      }
      if (item.type === "folder") {
        const child = item.children.find((entry) => entry.id === shortcutId);
        if (child) {
          return { kind: "folder", folder: item, item: child };
        }
      }
    }
    return null;
  }

  function fillShortcutParentOptions(selectedFolderId = "") {
    els.shortcutParent.innerHTML = "";
    const rootOption = document.createElement("option");
    rootOption.value = "";
    rootOption.textContent = "ルートに配置";
    els.shortcutParent.appendChild(rootOption);
    state.shortcuts.filter((item) => item.type === "folder").forEach((folder) => {
      const option = document.createElement("option");
      option.value = folder.id;
      option.textContent = folder.name;
      els.shortcutParent.appendChild(option);
    });
    els.shortcutParent.value = selectedFolderId || "";
  }

  function renderSummary(pinnedVisibleCount, regularVisibleCount) {
    const totalPinned = state.shortcuts.filter((item) => item.pinned).length;
    const totalRegular = state.shortcuts.length - totalPinned;
    els.pinnedCount.textContent = `${pinnedVisibleCount}/${totalPinned}`;
    els.regularCount.textContent = `${regularVisibleCount}/${totalRegular}`;
    els.count.textContent = `${pinnedVisibleCount + regularVisibleCount}/${state.shortcuts.length}`;
    els.sectionTitle.textContent = state.filterQuery ? "絞り込み結果" : "すべて";
    els.pinnedEmpty.hidden = pinnedVisibleCount > 0;
    els.empty.hidden = regularVisibleCount > 0;
    els.pinnedEmpty.textContent = state.filterQuery
      ? "条件に一致する固定項目がありません。"
      : "固定したショートカットやフォルダはここに表示されます。";
    els.empty.textContent = state.filterQuery
      ? "条件に一致する項目がありません。"
      : "まだショートカットがありません。「ショートカット追加」から登録できます。";
  }

  function createMenuButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "more-shortcut";
    button.textContent = "⋮";
    button.setAttribute("aria-label", label);
    button.addEventListener("click", onClick);
    return button;
  }

  function createShortcutCard(item) {
    const normalizedUrl = normalizeUrl(item.url);
    if (!normalizedUrl) {
      return null;
    }
    const url = new URL(normalizedUrl);
    const card = document.createElement("div");
    card.className = `shortcut${item.pinned ? " is-pinned" : ""}`;
    card.dataset.id = item.id;
    card.title = normalizedUrl;
    const content = document.createElement("div");
    content.className = "shortcut-content";
    const icon = document.createElement("img");
    icon.className = "shortcut-icon";
    icon.alt = "";
    icon.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(url.hostname)}&sz=64`;
    icon.addEventListener("error", () => {
      icon.style.display = "none";
    });
    const text = document.createElement("div");
    text.className = "shortcut-text";
    const name = document.createElement("span");
    name.className = "shortcut-name";
    name.textContent = item.name || url.hostname;
    const host = document.createElement("span");
    host.className = "shortcut-url";
    host.textContent = url.hostname;
    text.append(name, host);
    content.append(icon, text);
    card.append(content);
    card.append(createMenuButton(`${item.name} の操作を開く`, (event) => {
      event.stopPropagation();
      showRootItemOptions(item);
    }));
    card.addEventListener("click", () => {
      window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    });
    return card;
  }

  function createFolderCard(folder) {
    const card = document.createElement("div");
    card.className = `folder-card${folder.pinned ? " is-pinned" : ""}`;
    card.dataset.id = folder.id;
    const content = document.createElement("div");
    content.className = "folder-content";
    const icon = document.createElement("span");
    icon.className = "folder-icon";
    icon.textContent = "📁";
    const text = document.createElement("div");
    text.className = "folder-text";
    const name = document.createElement("span");
    name.className = "folder-name";
    name.textContent = folder.name;
    const meta = document.createElement("span");
    meta.className = "folder-meta";
    meta.textContent = `${folder.children.length} 件のショートカット`;
    const preview = document.createElement("span");
    preview.className = "folder-preview";
    preview.textContent = folder.children.length
      ? folder.children.slice(0, 3).map((child) => child.name).join(" / ")
      : "まだショートカットがありません";
    text.append(name, meta, preview);
    content.append(icon, text);
    card.append(content);
    card.append(createMenuButton(`${folder.name} の操作を開く`, (event) => {
      event.stopPropagation();
      showRootItemOptions(folder);
    }));
    card.addEventListener("click", () => openFolderView(folder.id));
    return card;
  }

  function buildFilteredItems() {
    const query = state.filterQuery.trim().toLowerCase();
    return state.shortcuts.filter((item) => {
      if (!query) {
        return true;
      }
      if ((item.name || "").toLowerCase().includes(query)) {
        return true;
      }
      if (item.type === "shortcut") {
        return item.url.toLowerCase().includes(query);
      }
      return item.children.some((child) =>
        (child.name || "").toLowerCase().includes(query) || child.url.toLowerCase().includes(query)
      );
    });
  }

  function renderShortcuts() {
    const filtered = buildFilteredItems();
    const pinned = filtered.filter((item) => item.pinned);
    const regular = filtered.filter((item) => !item.pinned);
    els.pinnedContainer.innerHTML = "";
    els.shortcutContainer.innerHTML = "";
    pinned.forEach((item) => {
      const card = item.type === "folder" ? createFolderCard(item) : createShortcutCard(item);
      if (card) {
        els.pinnedContainer.appendChild(card);
      }
    });
    regular.forEach((item) => {
      const card = item.type === "folder" ? createFolderCard(item) : createShortcutCard(item);
      if (card) {
        els.shortcutContainer.appendChild(card);
      }
    });
    renderSummary(pinned.length, regular.length);
    if (state.activeFolderId) {
      renderActiveFolder();
    }
  }

  function updateItems(nextItems, callback = () => {}) {
    state.shortcuts = nextItems;
    saveStoredData({ shortcuts: nextItems }, () => {
      fillShortcutParentOptions("");
      renderShortcuts();
      callback();
    });
  }

  function loadShortcuts() {
    getStoredData("shortcuts", (data) => {
      const { items, changed } = normalizeItems(data.shortcuts);
      state.shortcuts = items;
      fillShortcutParentOptions("");
      renderShortcuts();
      if (changed) {
        saveStoredData({ shortcuts: items });
      }
    });
  }

  function openShortcutModal(mode, shortcutId = null, preferredFolderId = "") {
    state.editingShortcutId = shortcutId;
    fillShortcutParentOptions(preferredFolderId);
    if (mode === "edit" && shortcutId) {
      const location = findShortcutLocation(shortcutId);
      if (!location) {
        return;
      }
      els.shortcutTitle.textContent = "ショートカットを編集";
      els.shortcutName.value = location.item.name || "";
      els.shortcutUrl.value = location.item.url || "";
      els.shortcutPinned.checked = location.kind === "root" ? Boolean(location.item.pinned) : false;
      els.shortcutParent.value = location.kind === "folder" ? location.folder.id : "";
    } else {
      els.shortcutTitle.textContent = "ショートカットを追加";
      els.shortcutForm.reset();
      els.shortcutPinned.checked = false;
      els.shortcutParent.value = preferredFolderId || "";
    }
    els.shortcutModal.hidden = false;
    els.shortcutUrl.focus();
  }

  function closeShortcutModal() {
    els.shortcutModal.hidden = true;
    state.editingShortcutId = null;
    els.shortcutForm.reset();
    els.shortcutPinned.checked = false;
  }

  function openFolderModal(folderId = null) {
    state.editingFolderId = folderId;
    if (folderId) {
      const folder = getFolderById(folderId);
      if (!folder) {
        return;
      }
      els.folderName.value = folder.name;
      els.folderPinned.checked = Boolean(folder.pinned);
    } else {
      els.folderForm.reset();
      els.folderPinned.checked = false;
    }
    els.folderModal.hidden = false;
    els.folderName.focus();
  }

  function closeFolderModal() {
    els.folderModal.hidden = true;
    state.editingFolderId = null;
    els.folderForm.reset();
    els.folderPinned.checked = false;
  }

  function openFolderView(folderId) {
    state.activeFolderId = folderId;
    renderActiveFolder();
    els.folderViewModal.hidden = false;
  }

  function closeFolderView() {
    els.folderViewModal.hidden = true;
    state.activeFolderId = null;
  }

  function renderActiveFolder() {
    const folder = getFolderById(state.activeFolderId);
    if (!folder) {
      closeFolderView();
      return;
    }
    els.folderViewTitle.textContent = folder.name;
    els.folderViewSubtitle.textContent = `${folder.children.length} 件のショートカットを管理できます。`;
    els.folderViewList.innerHTML = "";
    els.folderViewEmpty.hidden = folder.children.length > 0;
    folder.children.forEach((child) => {
      const item = document.createElement("div");
      item.className = "folder-view-item";
      const header = document.createElement("div");
      header.className = "folder-view-header";
      const titleRow = document.createElement("div");
      titleRow.className = "folder-view-title-row";
      const label = document.createElement("span");
      label.className = "folder-view-label";
      label.textContent = child.name;
      const url = document.createElement("span");
      url.className = "folder-view-url";
      url.textContent = child.url;
      titleRow.append(label, url);
      const actions = document.createElement("div");
      actions.className = "folder-view-actions";
      [
        ["開く", "button-primary", () => window.open(child.url, "_blank", "noopener,noreferrer")],
        ["編集", "button-neutral", () => openShortcutModal("edit", child.id)],
        ["削除", "button-danger", () => removeShortcut(child.id)]
      ].forEach(([text, className, handler]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = className;
        button.textContent = text;
        button.addEventListener("click", handler);
        actions.appendChild(button);
      });
      header.append(titleRow, actions);
      item.appendChild(header);
      els.folderViewList.appendChild(item);
    });
  }

  function closeBackgroundSettings() {
    els.backgroundPopup.hidden = true;
  }

  function openBackgroundSettings() {
    els.backgroundPopup.hidden = false;
  }

  function closeFeedSettings() {
    els.feedModal.hidden = true;
  }

  function openFeedSettings() {
    els.newsSources.value = state.dashboardSettings.newsSourcesText;
    els.serverEndpoints.value = state.dashboardSettings.serverEndpointsText;
    els.feedModal.hidden = false;
  }

  function closeBookmarkModal() {
    els.bookmarkModal.hidden = true;
    state.selectedBookmarkFolderId = null;
    els.bookmarkTree.innerHTML = "";
  }

  function closeTransientPopup() {
    const popup = document.querySelector('[data-transient-popup="true"]');
    if (popup) {
      document.body.removeChild(popup);
    }
  }

  function saveShortcutFromForm(event) {
    event.preventDefault();
    const normalizedUrl = normalizeUrl(els.shortcutUrl.value);
    if (!normalizedUrl) {
      alert("有効な http または https の URL を入力してください。");
      els.shortcutUrl.focus();
      return;
    }
    const nextShortcut = {
      type: "shortcut",
      id: state.editingShortcutId || createId(),
      url: normalizedUrl,
      name: (els.shortcutName.value || "").trim() || deriveLabelFromUrl(normalizedUrl),
      pinned: els.shortcutParent.value ? false : Boolean(els.shortcutPinned.checked)
    };
    const nextItems = state.shortcuts
      .map((item) => item.type !== "folder" ? item : {
        ...item,
        children: item.children.filter((child) => child.id !== nextShortcut.id)
      })
      .filter((item) => !(item.type === "shortcut" && item.id === nextShortcut.id));
    if (els.shortcutParent.value) {
      updateItems(nextItems.map((item) => item.type !== "folder" || item.id !== els.shortcutParent.value
        ? item
        : { ...item, children: [...item.children, { ...nextShortcut, pinned: false }] }), closeShortcutModal);
      return;
    }
    updateItems([...nextItems, nextShortcut], closeShortcutModal);
  }

  function saveFolderFromForm(event) {
    event.preventDefault();
    const folderName = els.folderName.value.trim();
    if (!folderName) {
      alert("フォルダ名を入力してください。");
      els.folderName.focus();
      return;
    }
    if (state.editingFolderId) {
      updateItems(state.shortcuts.map((item) => item.type !== "folder" || item.id !== state.editingFolderId
        ? item
        : { ...item, name: folderName, pinned: Boolean(els.folderPinned.checked) }), closeFolderModal);
      return;
    }
    updateItems([...state.shortcuts, {
      type: "folder",
      id: createId(),
      name: folderName,
      pinned: Boolean(els.folderPinned.checked),
      children: []
    }], closeFolderModal);
  }

  function removeShortcut(shortcutId) {
    updateItems(state.shortcuts
      .map((item) => item.type !== "folder" ? item : {
        ...item,
        children: item.children.filter((child) => child.id !== shortcutId)
      })
      .filter((item) => !(item.type === "shortcut" && item.id === shortcutId)));
  }

  function removeFolder(folderId) {
    updateItems(state.shortcuts.filter((item) => item.id !== folderId), () => {
      if (state.activeFolderId === folderId) {
        closeFolderView();
      }
    });
  }

  function togglePin(itemId) {
    updateItems(
      state.shortcuts.map((item) => item.id !== itemId ? item : { ...item, pinned: !item.pinned }),
      closeTransientPopup
    );
  }

  function showRootItemOptions(item) {
    closeTransientPopup();
    const popup = document.createElement("div");
    popup.className = "popup";
    popup.dataset.transientPopup = "true";
    popup.addEventListener("click", (event) => {
      if (event.target === popup) {
        closeTransientPopup();
      }
    });
    const content = document.createElement("div");
    content.className = "popup-content";
    const title = document.createElement("h2");
    title.textContent = "その他の操作";
    const desc = document.createElement("p");
    desc.textContent = item.name;
    content.append(title, desc);
    [
      ["編集", "button-primary", () => {
        closeTransientPopup();
        item.type === "folder" ? openFolderModal(item.id) : openShortcutModal("edit", item.id);
      }],
      [item.pinned ? "固定解除" : "固定", "button-neutral", () => togglePin(item.id)],
      ["削除", "button-danger", () => {
        if (confirm("この項目を削除しますか？")) {
          item.type === "folder" ? removeFolder(item.id) : removeShortcut(item.id);
          closeTransientPopup();
        }
      }],
      ["キャンセル", "button-neutral", closeTransientPopup]
    ].forEach(([text, className, handler]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.textContent = text;
      button.addEventListener("click", handler);
      content.appendChild(button);
    });
    popup.appendChild(content);
    document.body.appendChild(popup);
  }

  function addDroppedShortcut(text) {
    const shortcut = createShortcut(text, "", false);
    if (!shortcut || getAllUrls().has(shortcut.url)) {
      return;
    }
    updateItems([...state.shortcuts, shortcut]);
  }

  function createChip(text, className = "status-chip") {
    const chip = document.createElement("span");
    chip.className = className;
    chip.textContent = text;
    return chip;
  }

  function renderNews(items, emptyMessage) {
    els.newsList.innerHTML = "";
    els.newsEmpty.hidden = items.length > 0;
    els.newsEmpty.textContent = emptyMessage;
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
      meta.appendChild(createChip(item.source));
      if (item.publishedAt) {
        meta.appendChild(createChip(metaDateFormatter.format(item.publishedAt), "status-chip status-chip--soft"));
      }
      li.append(meta);
      els.newsList.appendChild(li);
    });
  }

  function renderServers(items, emptyMessage) {
    els.serverList.innerHTML = "";
    els.serverEmpty.hidden = items.length > 0;
    els.serverEmpty.textContent = emptyMessage;
    items.forEach((item) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.label;
      const desc = document.createElement("p");
      desc.textContent = item.detail;
      const meta = document.createElement("div");
      meta.className = "info-meta";
      meta.appendChild(createChip(item.status, `status-chip ${item.statusClass}`));
      if (item.latencyMs !== null) {
        meta.appendChild(createChip(`${item.latencyMs} ms`, "status-chip status-chip--soft"));
      }
      if (item.checkedAt) {
        meta.appendChild(createChip(metaDateFormatter.format(item.checkedAt), "status-chip status-chip--soft"));
      }
      li.append(title, desc, meta);
      els.serverList.appendChild(li);
    });
  }

  async function fetchTextWithTimeout(url) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
      return { response, text: await response.text() };
    } finally {
      window.clearTimeout(timer);
    }
  }

  function parseFeedItems(xmlText, sourceLabel) {
    const doc = new DOMParser().parseFromString(xmlText, "text/xml");
    if (doc.querySelector("parsererror")) {
      return [];
    }
    return Array.from(doc.querySelectorAll("item, entry")).slice(0, 4).map((node) => {
      const title = node.querySelector("title")?.textContent?.trim();
      const linkNode = node.querySelector("link");
      const link = linkNode?.getAttribute("href") || linkNode?.textContent?.trim() || "";
      if (!title || !link) {
        return null;
      }
      const publishedText = node.querySelector("pubDate, updated, published")?.textContent?.trim() || "";
      const publishedAt = publishedText ? new Date(publishedText) : null;
      return {
        source: sourceLabel,
        title,
        link,
        description: (node.querySelector("description, summary")?.textContent?.trim() || "").slice(0, 120),
        publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null
      };
    }).filter(Boolean);
  }

  async function refreshNewsPanel() {
    const sources = parseConfiguredLines(state.dashboardSettings.newsSourcesText);
    if (!sources.length) {
      renderNews([], "まだニュースソースがありません。「情報設定」から登録してください。");
      return;
    }
    const settled = await Promise.allSettled(sources.map(async (source) => {
      const { text } = await fetchTextWithTimeout(source.url);
      return parseFeedItems(text, source.label);
    }));
    const items = settled
      .filter((entry) => entry.status === "fulfilled")
      .flatMap((entry) => entry.value)
      .sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
      .slice(0, 8);
    renderNews(items, "表示できるITニュースがありません。フィードURLを見直してください。");
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
        detail = json.message || json.detail || json.version || endpoint.url;
        statusClass = /healthy|ok|up/i.test(status) ? "status-chip--healthy" : "status-chip--error";
      } catch {
        if (/healthy|ok|up/i.test(text)) {
          status = "HEALTHY";
          statusClass = "status-chip--healthy";
        }
      }
      return { label: endpoint.label, status, detail, latencyMs, checkedAt: new Date(), statusClass };
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
      renderServers([], "監視先がありません。「情報設定」から health endpoint を追加してください。");
      return;
    }
    renderServers(await Promise.all(endpoints.map((endpoint) => probeServer(endpoint))), "サーバー状態を取得できませんでした。");
  }

  function schedulePanelRefresh() {
    if (state.newsRefreshTimerId) {
      window.clearInterval(state.newsRefreshTimerId);
    }
    if (state.serverRefreshTimerId) {
      window.clearInterval(state.serverRefreshTimerId);
    }
    refreshNewsPanel();
    refreshServerPanel();
    state.newsRefreshTimerId = window.setInterval(refreshNewsPanel, NEWS_REFRESH_MS);
    state.serverRefreshTimerId = window.setInterval(refreshServerPanel, SERVER_REFRESH_MS);
  }

  function flattenBookmarkFolders(nodes, trail = []) {
    const folders = [];
    nodes.forEach((node) => {
      const nextTrail = node.title ? [...trail, node.title] : trail;
      if (Array.isArray(node.children) && node.children.length) {
        const children = node.children
          .filter((child) => child.url)
          .map((child) => createShortcut(child.url, child.title, false))
          .filter(Boolean);
        if (children.length) {
          folders.push({
            id: node.id,
            name: node.title || "ブックマーク",
            path: nextTrail.join(" / "),
            children
          });
        }
        folders.push(...flattenBookmarkFolders(node.children, nextTrail));
      }
    });
    return folders;
  }

  function renderBookmarkFolders() {
    els.bookmarkTree.innerHTML = "";
    els.bookmarkEmpty.hidden = state.bookmarkFolders.length > 0;
    state.bookmarkFolders.forEach((folder) => {
      const item = document.createElement("div");
      item.className = `bookmark-tree-item${state.selectedBookmarkFolderId === folder.id ? " is-selected" : ""}`;
      const title = document.createElement("strong");
      title.textContent = folder.name;
      const detail = document.createElement("p");
      detail.textContent = `${folder.children.length} 件 | ${folder.path}`;
      item.append(title, detail);
      item.addEventListener("click", () => {
        state.selectedBookmarkFolderId = folder.id;
        renderBookmarkFolders();
      });
      els.bookmarkTree.appendChild(item);
    });
  }

  function openBookmarkModal() {
    chrome.bookmarks.getTree((nodes) => {
      state.bookmarkFolders = flattenBookmarkFolders(nodes);
      state.selectedBookmarkFolderId = state.bookmarkFolders[0]?.id || null;
      renderBookmarkFolders();
      els.bookmarkModal.hidden = false;
    });
  }

  function importFolderBookmarks(folder) {
    if (!folder) {
      return false;
    }
    const existingUrls = getAllUrls();
    const children = folder.children.filter((child) => !existingUrls.has(child.url)).map((child) => ({
      ...child,
      id: createId(),
      pinned: false
    }));
    if (!children.length) {
      return false;
    }
    updateItems([...state.shortcuts, {
      type: "folder",
      id: createId(),
      name: folder.name,
      pinned: false,
      children
    }]);
    return true;
  }

  function importAllBookmarks() {
    const existingUrls = getAllUrls();
    const folders = state.bookmarkFolders.map((folder) => {
      const children = folder.children.filter((child) => !existingUrls.has(child.url)).map((child) => {
        existingUrls.add(child.url);
        return { ...child, id: createId(), pinned: false };
      });
      return children.length ? {
        type: "folder",
        id: createId(),
        name: folder.name,
        pinned: false,
        children
      } : null;
    }).filter(Boolean);
    if (!folders.length) {
      alert("取り込める新しいブックマークがありませんでした。");
      return;
    }
    updateItems([...state.shortcuts, ...folders], closeBookmarkModal);
  }

  function reorderSection(newOrder, pinned) {
    const ordered = newOrder.map((id) => state.shortcuts.find((item) => item.id === id)).filter(Boolean);
    const others = state.shortcuts.filter((item) => Boolean(item.pinned) !== pinned);
    updateItems(pinned ? [...ordered, ...others] : [...others, ...ordered]);
  }

  els.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && els.search.value.trim()) {
      window.location.href = `https://www.google.com/search?q=${encodeURIComponent(els.search.value.trim())}`;
    }
  });

  els.filter.addEventListener("input", (event) => {
    state.filterQuery = event.target.value;
    renderShortcuts();
  });

  els.addShortcut.addEventListener("click", () => openShortcutModal("create"));
  els.addFolder.addEventListener("click", () => openFolderModal());
  els.importBookmarks.addEventListener("click", openBookmarkModal);
  els.shortcutForm.addEventListener("submit", saveShortcutFromForm);
  els.shortcutCancel.addEventListener("click", closeShortcutModal);
  els.folderForm.addEventListener("submit", saveFolderFromForm);
  els.folderCancel.addEventListener("click", closeFolderModal);
  els.folderAddShortcut.addEventListener("click", () => state.activeFolderId && openShortcutModal("create", null, state.activeFolderId));
  els.folderClose.addEventListener("click", closeFolderView);
  els.bookmarkImportSelected.addEventListener("click", () => {
    const folder = state.bookmarkFolders.find((item) => item.id === state.selectedBookmarkFolderId);
    if (!folder) {
      alert("取り込むブックマークフォルダを選択してください。");
      return;
    }
    if (!importFolderBookmarks(folder)) {
      alert("取り込める新しいブックマークがありませんでした。");
      return;
    }
    closeBookmarkModal();
  });
  els.bookmarkImportAll.addEventListener("click", importAllBookmarks);
  els.bookmarkClose.addEventListener("click", closeBookmarkModal);

  [els.shortcutModal, els.folderModal, els.folderViewModal, els.bookmarkModal].forEach((modal) => {
    modal.addEventListener("click", (event) => {
      if (event.target !== modal) {
        return;
      }
      if (modal === els.shortcutModal) {
        closeShortcutModal();
      } else if (modal === els.folderModal) {
        closeFolderModal();
      } else if (modal === els.folderViewModal) {
        closeFolderView();
      } else {
        closeBookmarkModal();
      }
    });
  });

  [els.pinnedContainer, els.shortcutContainer].forEach((container) => {
    container.addEventListener("dragover", (event) => event.preventDefault());
    container.addEventListener("drop", (event) => {
      event.preventDefault();
      const text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
      if (text) {
        addDroppedShortcut(text.split("\n")[0]);
      }
    });
  });

  if (typeof Sortable !== "undefined") {
    new Sortable(els.pinnedContainer, {
      animation: 150,
      onEnd: () => {
        if (state.filterQuery) {
          renderShortcuts();
          return;
        }
        reorderSection(Array.from(els.pinnedContainer.children).map((el) => el.dataset.id), true);
      }
    });
    new Sortable(els.shortcutContainer, {
      animation: 150,
      onEnd: () => {
        if (state.filterQuery) {
          renderShortcuts();
          return;
        }
        reorderSection(Array.from(els.shortcutContainer.children).map((el) => el.dataset.id), false);
      }
    });
  }

  els.backgroundButton.addEventListener("click", openBackgroundSettings);
  els.closeBackground.addEventListener("click", closeBackgroundSettings);
  els.backgroundPopup.addEventListener("click", (event) => {
    if (event.target === els.backgroundPopup) {
      closeBackgroundSettings();
    }
  });
  els.applyBackground.addEventListener("click", () => {
    const nextBackground = { color: els.backgroundColor.value, imageUrl: els.backgroundImage.value.trim() };
    if (nextBackground.imageUrl && !normalizeUrl(nextBackground.imageUrl)) {
      alert("背景画像URLには有効な http または https の URL を入力してください。");
      return;
    }
    saveStoredData({ background: nextBackground }, () => {
      applyBackground(nextBackground);
      closeBackgroundSettings();
    });
  });
  els.resetBackground.addEventListener("click", () => {
    saveStoredData({ background: {} }, () => {
      applyBackground({});
      closeBackgroundSettings();
    });
  });

  els.feedButton.addEventListener("click", openFeedSettings);
  els.closeFeed.addEventListener("click", closeFeedSettings);
  els.feedModal.addEventListener("click", (event) => {
    if (event.target === els.feedModal) {
      closeFeedSettings();
    }
  });
  els.saveFeed.addEventListener("click", () => {
    state.dashboardSettings = {
      newsSourcesText: els.newsSources.value.trim() || DEFAULT_NEWS_SOURCES,
      serverEndpointsText: els.serverEndpoints.value.trim()
    };
    saveStoredData({ dashboardSettings: state.dashboardSettings }, () => {
      closeFeedSettings();
      schedulePanelRefresh();
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeTransientPopup();
      closeBackgroundSettings();
      closeFeedSettings();
      closeShortcutModal();
      closeFolderModal();
      closeFolderView();
      closeBookmarkModal();
    }
  });

  loadSettingsAndBackground(schedulePanelRefresh);
  loadShortcuts();
});
