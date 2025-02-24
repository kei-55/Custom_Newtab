document.addEventListener("DOMContentLoaded", () => {
  const shortcutContainer = document.getElementById("shortcut-container");
  const addShortcutButton = document.getElementById("add-shortcut");
  const googleSearch = document.getElementById("google-search");

  //---------------------------------------
  // 1. Google検索
  //---------------------------------------
  googleSearch.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const query = googleSearch.value.trim();
      if (query) {
        // EnterでGoogle検索
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });

  //---------------------------------------
  // 2. ショートカット関連
  //---------------------------------------
  // ショートカット一覧を読み込んで表示
  function loadShortcuts() {
    chrome.storage.sync.get("shortcuts", (data) => {
      console.log("ショートカット一覧:", data.shortcuts);

      shortcutContainer.innerHTML = "";
      const shortcuts = data.shortcuts || [];

      shortcuts.forEach((item, index) => {
        // item = { url, name? }
        const shortcutEl = createShortcutElement(item, index);
        shortcutContainer.appendChild(shortcutEl);
      });
    });
  }

  // ショートカット追加
  function addShortcut() {
    const url = prompt("ショートカットのURLを入力してください:");
    if (!url) return;

    let name = prompt("ショートカットの名前を入力してください:");
    if (!name) {
      name = url; // 名前が設定されない場合はURLを名前に設定
    }

    chrome.storage.sync.get("shortcuts", (data) => {
      const arr = data.shortcuts || [];
      arr.push({ url, name });
      chrome.storage.sync.set({ shortcuts: arr }, loadShortcuts);
    });
  }

  // ショートカット削除
  function removeShortcut(index) {
    chrome.storage.sync.get("shortcuts", (data) => {
      const arr = data.shortcuts || [];
      arr.splice(index, 1);
      chrome.storage.sync.set({ shortcuts: arr }, loadShortcuts);
    });
  }

  // ショートカット編集 (URL/名前)
  function editShortcut(item, index) {
    const newURL = prompt("ショートカットの新しいURL:", item.url);
    if (!newURL) return;

    let newName = prompt("ショートカットの新しい名前:", item.name || "");
    if (!newName) {
      newName = newURL; // 名前が設定されない場合はURLを名前に設定
    }

    chrome.storage.sync.get("shortcuts", (data) => {
      const arr = data.shortcuts || [];
      if (arr[index]) {
        arr[index].url = newURL;
        arr[index].name = newName;
      }
      chrome.storage.sync.set({ shortcuts: arr }, loadShortcuts);
    });
  }

  // ショートカット要素を生成
  function createShortcutElement(item, index) {
    const shortcutEl = document.createElement("div");
    shortcutEl.className = "shortcut";
    shortcutEl.dataset.index = index;
    shortcutEl.draggable = true;

    const displayName = item.name ? item.name : "(無名)";

    // アイコンとテキストを並行に表示するためのコンテナ
    const contentContainer = document.createElement("div");
    contentContainer.className = "shortcut-content";

    // アイコンを取得して設定
    const favicon = document.createElement("img");
    favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(item.url).hostname}`;
    favicon.className = "shortcut-icon";
    contentContainer.appendChild(favicon);

    // テキストを設定
    const textContainer = document.createElement("div");
    textContainer.className = "shortcut-text";
    textContainer.innerText = item.name ? displayName : `${displayName}\n${item.url}`;
    contentContainer.appendChild(textContainer);

    shortcutEl.appendChild(contentContainer);

    // その他の操作ボタン
    const moreBtn = document.createElement("button");
    moreBtn.className = "more-shortcut";
    moreBtn.innerText = "⋮";
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      showMoreOptions(item, index);
    });
    shortcutEl.appendChild(moreBtn);

    // ショートカットをクリックでURLを開く
    shortcutEl.addEventListener("click", () => {
      window.open(item.url, "_blank");
    });

    // ドラッグ開始
    shortcutEl.addEventListener("dragstart", (ev) => {
      const payload = {
        from: "global",
        index,
        url: item.url,
        name: item.name
      };
      ev.dataTransfer.setData("text/plain", JSON.stringify(payload));
    });

    return shortcutEl;
  }

  // その他の操作を表示
  function showMoreOptions(item, index) {
    const popup = document.createElement("div");
    popup.className = "popup";

    const popupContent = document.createElement("div");
    popupContent.className = "popup-content";

    const popupTitle = document.createElement("h2");
    popupTitle.innerText = "その他の操作";
    popupContent.appendChild(popupTitle);

    const editButton = document.createElement("button");
    editButton.innerText = "編集";
    editButton.addEventListener("click", () => {
      editShortcut(item, index);
      closePopup();
    });
    popupContent.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.innerText = "削除";
    deleteButton.addEventListener("click", () => {
      removeShortcut(index);
      closePopup();
    });
    popupContent.appendChild(deleteButton);

    const cancelButton = document.createElement("button");
    cancelButton.innerText = "キャンセル";
    cancelButton.addEventListener("click", () => {
      closePopup();
    });
    popupContent.appendChild(cancelButton);

    popup.appendChild(popupContent);
    document.body.appendChild(popup);
  }

  function closePopup() {
    const popup = document.querySelector(".popup");
    if (popup) {
      document.body.removeChild(popup);
    }
  }

  // ドラッグ＆ドロップでショートカットの並び替え
  if (typeof Sortable !== "undefined" && shortcutContainer) {
    new Sortable(shortcutContainer, {
      animation: 150,
      onEnd: () => {
        const newOrder = Array.from(shortcutContainer.children).map(el => el.dataset.index);
        reorderShortcuts(newOrder);
      }
    });
  }

  function reorderShortcuts(newOrder) {
    chrome.storage.sync.get("shortcuts", (data) => {
      const arr = data.shortcuts || [];
      const reordered = newOrder.map(idx => arr[parseInt(idx)]);
      chrome.storage.sync.set({ shortcuts: reordered }, loadShortcuts);
    });
  }

  // ショートカットをドロップ (フォルダ機能なし)
  shortcutContainer.addEventListener("dragover", (ev) => {
    ev.preventDefault();
  });
  shortcutContainer.addEventListener("drop", (ev) => {
    ev.preventDefault();
    const text = ev.dataTransfer.getData("text/plain");
    if (!text) return;
    try {
      const parsed = JSON.parse(text);
      console.log("ドロップされたデータ:", parsed);
      // フォルダ機能は削除しているため特に処理しない
      // ここで他のサイトからのURLを追加してもよい
    } catch {
      // 単純なURL文字列として追加
      if (text.startsWith("http")) {
        chrome.storage.sync.get("shortcuts", (data) => {
          const arr = data.shortcuts || [];
          arr.push({ url: text, name: text }); // 名前が設定されない場合はURLを名前に設定
          chrome.storage.sync.set({ shortcuts: arr }, loadShortcuts);
        });
      }
    }
  });

  //---------------------------------------
  // 背景カスタマイズ
  //---------------------------------------
  const backgroundColorInput = document.getElementById("background-color");
  const backgroundImageInput = document.getElementById("background-image");
  const applyBackgroundButton = document.getElementById("apply-background");
  const backgroundSettingsButton = document.getElementById("background-settings-button");
  const backgroundSettingsPopup = document.getElementById("background-settings-popup");
  const closeBackgroundSettingsButton = document.getElementById("close-background-settings");

  backgroundSettingsButton.addEventListener("click", () => {
    backgroundSettingsPopup.style.display = "flex";
  });

  closeBackgroundSettingsButton.addEventListener("click", () => {
    backgroundSettingsPopup.style.display = "none";
  });

  applyBackgroundButton.addEventListener("click", () => {
    const color = backgroundColorInput.value;
    const imageUrl = backgroundImageInput.value.trim();

    if (color) {
      document.body.style.backgroundColor = color;
      document.body.style.backgroundImage = "";
    }

    if (imageUrl) {
      document.body.style.backgroundImage = `url(${imageUrl})`;
      document.body.style.backgroundColor = "";
    }

    backgroundSettingsPopup.style.display = "none";
  });

  //---------------------------------------
  // 初期読み込み
  //---------------------------------------
  if (addShortcutButton) {
    addShortcutButton.addEventListener("click", () => {
      addShortcut();
    });
  }

  loadShortcuts();
});
