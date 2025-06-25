# 消息通訊系統文件

這個文件記錄了擴充功能中各組件間的消息通訊模式和用途。

## 消息流程概覽

```
Popup → Background → Content.js → Inject Scripts
   ↑                              ↓
   └──────── Storage ←─────────────┘
```

## 消息類型與通訊路徑

### 1. Chrome Extension Messages (chrome.runtime.onMessage)

#### `POST_MESSAGE`
- **來源**: popup.js, background.js
- **目標**: content.js → inject scripts
- **用途**: 將消息從擴充功能組件轉發給注入腳本
- **資料結構**:
  ```javascript
  {
    type: 'POST_MESSAGE',
    siteName: '網站名稱', // 可選，用於多網站支援
    message: {
      // 實際要傳遞的消息內容
    }
  }
  ```
- **檔案位置**: content.js:43, content.js:51

#### `SET_TIME`
- **來源**: popup.js
- **目標**: content.js
- **用途**: 設定時間相關功能（目前僅回應成功確認）
- **資料結構**:
  ```javascript
  {
    type: 'SET_TIME',
    // 其他時間相關資料
  }
  ```
- **檔案位置**: content.js:54

### 2. Window Messages (window.postMessage)

#### `INIT_SELECT_VALUES` (NUEIP)
- **來源**: content.js
- **目標**: nueip-inject.js
- **用途**: 初始化 NUEIP 網站的打卡設定值
- **資料結構**:
  ```javascript
  {
    type: 'INIT_SELECT_VALUES',
    siteName: 'NUEIP 雲端出勤系統',
    data: {
      autoPunchSettings: {
        startTime: '10:00',
        endTime: '19:00',
        startRandom: '10',
        endRandom: '10'
      }
    }
  }
  ```
- **檔案位置**: content.js:106-116, nueip-inject.js:63

#### `INIT_YOUTUBE`
- **來源**: content.js
- **目標**: youtube-inject.js
- **用途**: 初始化 YouTube 功能增強
- **資料結構**:
  ```javascript
  {
    type: 'INIT_YOUTUBE',
    siteName: 'YouTube',
    data: {}
  }
  ```
- **檔案位置**: content.js:118-124, youtube-inject.js:25

#### `SAVE_SELECT_VALUES`
- **來源**: nueip-inject.js
- **目標**: content.js
- **用途**: 儲存 NUEIP 打卡設定到 chrome.storage.local
- **資料結構**:
  ```javascript
  {
    type: 'SAVE_SELECT_VALUES',
    data: {
      autoPunchSettings: {
        startTime: '10:00',
        endTime: '19:00',
        startRandom: '10',
        endRandom: '10'
      }
    }
  }
  ```
- **檔案位置**: nueip-inject.js:110-115, content.js:72

## 網站專用配置系統

Content.js 使用 `SITE_CONFIGS` 來管理不同網站的初始化消息：

```javascript
// content.js 中的配置示例
if (config.hostname === 'cloud.nueip.com') {
  // NUEIP 需要載入儲存的設定
  chrome.storage.local.get(['autoPunchSettings'], (result) => {
    window.postMessage({
      type: config.initMessage, // 'INIT_SELECT_VALUES'
      siteName: config.name,
      data: { autoPunchSettings: result.autoPunchSettings }
    }, '*');
  });
} else {
  // 其他網站發送簡單初始化消息
  window.postMessage({
    type: config.initMessage, // 'INIT_YOUTUBE' etc.
    siteName: config.name,
    data: {}
  }, '*');
}
```

## 消息過濾機制

### 網站名稱過濾
Content.js 實作了網站名稱過濾，確保消息只在對應的網站處理：

```javascript
// content.js:37-41
if (request.siteName && request.siteName !== currentSiteName) {
  console.log(`CB_Content: 忽略消息，目標網站: ${request.siteName}, 當前網站: ${currentSiteName}`);
  return true;
}

// content.js:67-70
if (receivedData.siteName && receivedData.siteName !== currentSiteName) {
  console.log(`CB_Content: 忽略來自 ${receivedData.siteName} 的消息，當前網站: ${currentSiteName}`);
  return;
}
```

## 資料持久化

使用 `chrome.storage.local` 進行設定儲存：

### 讀取設定
```javascript
// content.js:108
chrome.storage.local.get(['autoPunchSettings'], (result) => {
  // 使用 result.autoPunchSettings
});
```

### 儲存設定
```javascript
// content.js:73
chrome.storage.local.set({ autoPunchSettings: receivedData.data.autoPunchSettings }, function() {
  console.log(`CB_Content: 已儲存 ${currentSiteName} 的設定`);
});
```

## 除錯日誌

所有消息都有對應的控制台日誌，使用 `CB_Content:` 前綴：

- `CB_Content: 轉發消息給 ${siteName}:` - 消息轉發
- `CB_Content: 忽略消息` - 消息過濾
- `CB_Content: 已儲存 ${siteName} 的設定` - 設定儲存
- `CB_Content: 發送初始化消息 ${initMessage}` - 初始化

## 新增網站消息支援

要為新網站添加消息支援：

1. 在網站配置中定義 `initMessage`
2. 在 content.js 的初始化邏輯中添加網站特定處理
3. 在注入腳本中監聽對應的初始化消息
4. 定義網站特定的消息類型和處理邏輯

## 注意事項

- 所有 window.postMessage 都使用 `'*'` 作為 targetOrigin
- 消息監聽器會檢查 `event.source !== window` 來過濾外部消息
- Chrome extension 消息使用 `return true` 保持通道開啟
- 網站切換時會重新初始化，適用於 SPA 應用