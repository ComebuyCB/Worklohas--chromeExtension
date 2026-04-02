/*=== 通用多網站內容腳本 ===*/


// 獲取當前網站配置
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const currentUrl = hostname + pathname; // 例如: "cloud.nueip.com/attendance_record"

  const siteConfig = SITE_CONFIGS[hostname];
  if (!siteConfig || !siteConfig.paths || !Array.isArray(siteConfig.paths)) {
    return null;
  }

  // 尋找匹配當前路徑的配置
  for (const config of siteConfig.paths) {
    const configUrl = config.url;
    let isMatch = false;

    if (configUrl.endsWith('*')) {
      // 前綴匹配，若後墜有*時。 (如: cloud.nueip.com/pathname*，那麼也會匹配: cloud.nueip.com/pathname/1。)
      const urlPrefix = configUrl.slice(0, -1);
      isMatch = currentUrl.startsWith(urlPrefix);
    } else {
      // 精確匹配 (只會匹配 cloud.nueip.com/pathname)
      isMatch = currentUrl === configUrl;
    }

    if (isMatch) {
      console.log(`[content.js] 找到網站配置: `, config);
      return {
        ...config,
        hostname
      };
    }
  }

  return null;
}

// 監聽來自其他組件的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message.from || message.to !== 'content.js' || !message.type) { return true; }

  const currentConfig = getCurrentSiteConfig();
  const currentSiteUrl = currentConfig ? currentConfig.url : null;
  // ...

  return true; // 保持消息通道開啟
});

// 監聽來自注入腳本(inject/*)的消息
window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message.from || message.to !== 'content.js' || !message.type) { return; }

  const currentConfig = getCurrentSiteConfig();
  const currentSiteUrl = currentConfig ? currentConfig.url : null;

  // 檢查網站匹配 - message.from 現在應該是完整的 url
  if (!currentSiteUrl || message.from !== currentSiteUrl) {
    return;
  }

  if (message.type === 'SAVE_SELECT_VALUES') {
    console.log(`[content.js] ${message.from}: SAVE_SELECT_VALUES → @content.js`);
    chrome.storage.local.set({ autoPunchSettings: message.data.autoPunchSettings });
  }
});

// 注入腳本和樣式
function injectScript(config) {
  // 注入樣式 <link rel="stylesheet" href="...">
  config.inject?.css?.forEach(styleFile => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(styleFile);
    document.head.appendChild(link);
  });

  // 注入腳本 <script src="..."></script>
  config.inject?.js?.forEach((scriptFile, index) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptFile);

    if (index === config.inject.js.length - 1) { // 最後一個腳本載入完成後發送初始化消息
      script.onload = function() {
        // 特殊處理
        if (config.url === 'cloud.nueip.com/attendance_record') {
          chrome.storage.local.get(['autoPunchSettings'], (result) => {
            window.postMessage({
              from: 'content.js',
              to: config.url,
              type: 'INIT',
              data: {
                autoPunchSettings: result.autoPunchSettings
              }
            }, '*');
          });
        } else {
          // 一般初始化消息
          window.postMessage({
            from: 'content.js',
            to: config.url,
            type: 'INIT',
            data: {}
          }, '*');
        }
      };
    }
    
    (document.head || document.documentElement).appendChild(script);
  });
}

// 主要初始化函數
function initialize() {
  const config = getCurrentSiteConfig();
  if (config) {
    // 檢查網站開關狀態
    chrome.storage.local.get(['siteToggles'], (result) => {
      const siteToggles = result.siteToggles || {};
      const hostname = config.hostname; // 使用 hostname (例如: cloud.nueip.com)

      if (siteToggles[hostname] === false) {
        console.log(`[content.js] 網站 ${hostname} 的擴充功能已關閉 ❌，不注入腳本`);
        return;
      }
      console.log(`[content.js] 網站 ${hostname} 的擴充功能已啟用 ✅，開始注入腳本`);
      injectScript(config);
    });
  }
}
initialize();

// 監聽 URL 變化（適用於 SPA 應用如 YouTube）
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(initialize, 1000); // 延遲一秒確保頁面載入完成
  }
}).observe(document, {subtree: true, childList: true});