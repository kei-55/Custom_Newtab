document.addEventListener("DOMContentLoaded", () => {
    console.log("content.js が実行されました");

    setTimeout(() => {
        if (!document.getElementById("add-folder")) {
            console.log("フォルダ追加ボタンを作成");

            const addButton = document.createElement("button");
            addButton.id = "add-folder";
            addButton.innerText = "フォルダ追加";
            addButton.style.position = "fixed";
            addButton.style.bottom = "20px";
            addButton.style.left = "20px";
            addButton.style.backgroundColor = "#6200ea";
            addButton.style.color = "white";
            addButton.style.border = "none";
            addButton.style.padding = "12px 24px";
            addButton.style.borderRadius = "6px";
            addButton.style.cursor = "pointer";
            addButton.style.fontSize = "16px";
            addButton.style.boxShadow = "0 3px 6px rgba(0, 0, 0, 0.2)";
            addButton.style.zIndex = "10000";

            addButton.addEventListener("click", () => {
                alert("フォルダ追加ボタンがクリックされました！");
            });

            document.documentElement.appendChild(addButton);
            console.log("フォルダ追加ボタンがページに追加されました");
        } else {
            console.log("フォルダ追加ボタンはすでに存在しています");
        }
    }, 2000);
});
