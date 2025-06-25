# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案概述

這是一個通用的多網站 Chrome 擴充功能架構，採用模組化設計支援多個不同網站的功能。目前主要實作 NUEIP 雲端出勤系統的自動打卡功能，並可輕鬆擴展到其他網站如 YouTube 等。擴充功能包含提醒通知、自動打卡功能，並且每個網站都有獨立的注入腳本和配置。

## 架構說明

### 多網站支援設計

這個擴充功能採用通用架構，可以同時支援多個不同的網站：

- **網站配置系統**: 透過 `src/config/sites.js` 和 `content.js` 中的配置定義每個網站的行為
- **模組化注入**: 每個網站有獨立的注入腳本資料夾
- **動態載入**: content.js 根據當前網站自動載入對應的注入腳本
- **URL 模式匹配**: 支援特定 URL 路徑的條件載入

### 擴充功能組件

- **manifest.json**: Chrome 擴充功能清單 (v3)，支援多個網站域名
- **background.js**: 服務工作者，處理鬧鐘、通知和組件間通訊
- **content.js**: 通用內容腳本，根據網站配置動態載入對應的注入腳本
- **popup.html/popup.js**: 擴充功能彈出視窗 UI，用於設定提醒設定
- **inject/**: 各網站專用的注入腳本資料夾

### 資料流程

1. 使用者在彈出視窗設定提醒 → 儲存至 chrome.storage.local
2. 背景腳本根據設定建立 chrome.alarms
3. content.js 檢查當前網站並載入對應配置
4. 動態注入網站專用的腳本和樣式
5. 注入腳本透過 window.postMessage 與內容腳本通訊
6. 設定透過 chrome.storage.local 跨會話持續存在

### 支援的網站

#### NUEIP 雲端出勤系統 (cloud.nueip.com)
- **路徑**: `/attendance_record`
- **功能**: 自動打卡、提醒通知、UI 控制面板
- **檔案**: `src/inject/nueip/`

#### YouTube (youtube.com, www.youtube.com)
- **路徑**: `/watch`
- **功能**: 功能增強 (示例實作)
- **檔案**: `src/inject/youtube/`

## 檔案結構

```
src/
├── background.js              # 服務工作者腳本
├── content.js                 # 通用內容腳本 (多網站支援)
├── config/
│   └── sites.js              # 網站配置系統 (備用，主要配置在 content.js)
├── popup/                    # 彈出視窗相關檔案
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
└── inject/                   # 網站專用注入腳本
    ├── nueip/               # NUEIP 相關腳本
    │   ├── nueip-inject.js
    │   └── nueip-inject.css
    └── youtube/             # YouTube 相關腳本
        ├── youtube-inject.js
        └── youtube-inject.css

static/                       # 第三方程式庫和靜態資源
├── jquery-3.5.1/
├── bootstrap-5.3.2/
├── fontawesome-free-5.15.4-web/
└── icons/

manifest.json                 # 擴充功能配置檔
CLAUDE.md                    # 開發指引文件
```

## 新增網站支援

要為新網站添加支援，需要進行以下步驟：

### 1. 更新 manifest.json
在 `content_scripts.matches`、`host_permissions` 和 `web_accessible_resources.matches` 中添加新網站的域名。

### 2. 更新 content.js 配置
在 `SITE_CONFIGS` 物件中添加新網站的配置：

```javascript
'new-site.com': {
  name: '網站名稱',
  inject: {
    scripts: ['src/inject/newsite/newsite-inject.js'],
    styles: ['src/inject/newsite/newsite-inject.css']
  },
  urlPatterns: ['/specific-path'],
  initMessage: 'INIT_NEWSITE',
  description: '網站功能描述'
}
```

### 3. 創建注入腳本
創建 `src/inject/newsite/` 資料夾並添加對應的 JavaScript 和 CSS 檔案。

### 4. 實作注入邏輯
在注入腳本中監聽初始化消息：

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'INIT_NEWSITE') {
    // 初始化網站特定功能
  }
});
```

## 開發指令

這是一個純 JavaScript Chrome 擴充功能，無需建構過程。開發涉及：

- **測試**: 在 Chrome 的 `chrome://extensions/` 載入未封裝的擴充功能
- **除錯**: 使用瀏覽器開發者工具控制台 (日誌前綴為 BG_, POP_, CB_)
- **檔案變更**: 修改檔案後在 Chrome 中重新整理擴充功能
- **多網站測試**: 訪問不同的支援網站來測試對應功能

## 開發注意事項

- 擴充功能使用 jQuery 3.5.1 進行 DOM 操作
- Bootstrap 5.3.2 用於 UI 樣式，FontAwesome 5.15.4 用於圖示
- 無建構過程 - 純 vanilla JS 搭配程式庫依賴
- 大量控制台日誌記錄，使用前綴 (BG_, POP_, CB_) 進行除錯
- 每個網站的功能應該獨立開發，避免相互影響
- URL 變化監聽支援 SPA 應用 (如 YouTube)

## 關鍵技術細節

- **多網站架構**: 使用配置驅動的動態腳本載入系統
- **訊息傳遞**: 使用 chrome.runtime.onMessage 和 window.postMessage 進行組件通訊
- **儲存**: chrome.storage.local 用於持久化設定 (提醒、打卡時間)
- **鬧鐘**: chrome.alarms API 用於排程通知
- **動態腳本注入**: 使用 chrome.runtime.getURL() 根據網站配置注入腳本
- **URL 變化監聽**: MutationObserver 監聽 SPA 頁面變化
- **模組化設計**: 每個網站功能完全獨立，便於維護和擴展

## NUEIP 特定功能

- **多重提醒支援**: 支援多個時間基礎提醒，個別啟用/停用
- **自動打卡邏輯**: 在指定範圍內隨機化打卡時間以避免偵測
- **依序執行**: Ajax 請求按順序執行，避免伺服器負載過高
- **UI 注入**: 在 NUEIP 出勤頁面添加浮動控制面板