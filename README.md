# 家用物品提醒（網頁版 HOUSE_WEB）

免安裝的瀏覽器應用，功能對齊 Android 版 `house_app`。  
**iPad / iPhone / 電腦** 用 Safari 或 Chrome 開啟即可使用，資料存在裝置本機瀏覽器。

## 功能一覽

| 分頁 | 功能 |
|------|------|
| 主頁 | 左右雙欄（數量由少到多／到期由近到遠）；可篩選並自動記住 |
| 大廳／房間／廚房／廁所 | 新增、修改、刪除物品；警報門檻（紅字） |
| 全螢幕 | 隱藏底部導覽，放大雙欄檢視 |

其他：
- 到期日可留空（不參與到期警報）
- 選日期後自動計算剩餘天數
- 主頁／全螢幕：**雙擊**數量 -1；**長按**開啟編輯
- 主頁篩選與分類警報會自動儲存

## 在 iPad 上開啟（免安裝）

### 方法 A：OneDrive（建議）
1. 確認桌面資料夾 `HOUSE_WEB` 已同步到 OneDrive。
2. 在 iPad 開啟 **OneDrive App** → 找到 `HOUSE_WEB` → 點 `index.html`。
3. 若無法直接跑腳本，改用方法 B。

### 方法 B：上傳到免費空間後用連結開啟（最穩）
把整個 `HOUSE_WEB` 資料夾上傳到任一可公開的靜態網站，例如：
- GitHub Pages
- Netlify Drop
- Cloudflare Pages

然後在 iPad Safari 開啟網址。可選：**分享 → 加入主畫面**，之後像 App 一樣點開（仍不必到 App Store 安裝）。

### 方法 C：電腦本機預覽
用檔案總管雙擊 `index.html`，或在資料夾執行：

```bash
# 若有 Python
python -m http.server 8080
```

瀏覽器開啟 `http://localhost:8080`。

## 檔案結構

```
HOUSE_WEB/
├── index.html
├── manifest.json          # PWA 資訊（可加入主畫面）
├── css/styles.css
├── js/
│   ├── utils.js           # 日期／分類工具
│   ├── storage.js         # localStorage 資料層
│   └── app.js             # 畫面與互動
├── icons/
│   ├── icon-192.png
│   └── icon-512.png
└── README.md
```

## 注意事項

1. **資料存在瀏覽器**：清除網站資料會遺失物品清單。重要資料請自行備份（之後可再加匯出功能）。
2. **不同瀏覽器／裝置不同步**：iPad Safari 與電腦 Chrome 的資料是分開的。
3. 若要用「加入主畫面」，請以 **https** 網址開啟（方法 B）。

## 與 Android 版差異

| 項目 | Android | 網頁版 |
|------|---------|--------|
| 安裝 | 需安裝 APK | 瀏覽器開啟即可 |
| 儲存 | Room 資料庫 | localStorage |
| 平台 | 手機／模擬器 | iPad／手機／電腦瀏覽器 |

Android 專案仍保留在 `AndroidStudioProjects/house_app`，兩邊資料目前不相通。
