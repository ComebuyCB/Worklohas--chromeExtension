/*=== 通用多網站內容腳本 ===*/


// 獲取當前網站配置
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  const currentUrl = hostname + pathname; // 例如: "cloud.nueip.com/attendance_record"

  // 優先精確匹配，再找前綴萬用字元 (*.domain.com)
  let matchedKey = hostname;
  let siteConfig = SITE_CONFIGS[hostname];
  if (!siteConfig) {
    const wildcardKey = Object.keys(SITE_CONFIGS).find(key =>
      key.startsWith('*.') && hostname.endsWith('.' + key.slice(2))
    );
    if (wildcardKey) { siteConfig = SITE_CONFIGS[wildcardKey]; matchedKey = wildcardKey; }
  }
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
        hostname,
        matchedKey,
        toggleKey: siteConfig.toggleKey
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

  // PM UI state：直接在 content.js 存取 storage.local，不需轉發 background
  if (message.type === 'pm_save_state') {
    chrome.storage.local.set({ wl_pm_settings: message.data });
    return;
  }
  if (message.type === 'pm_get_state') {
    chrome.storage.local.get(['wl_pm_settings'], (result) => {
      window.postMessage({ from: 'content.js', to: 'password-manager.js', requestId: message.requestId, data: result.wl_pm_settings || {} }, '*');
    });
    return;
  }

  // PM bridge：帳密管理訊息中轉至 background.js（inject 腳本在 page world，無法直接呼叫 chrome API）
  if (message.type.startsWith('pm_')) {
    new Promise(resolve => {
      chrome.runtime.sendMessage(
        { from: 'password-manager.js', to: 'background.js', type: message.type, data: message.data || {} },
        resolve
      );
    }).then(response => {
      if (message.requestId === null) return; // fire and forget
      window.postMessage({
        from: 'content.js',
        to: 'password-manager.js',
        requestId: message.requestId,
        data: response?.data
      }, '*');
    });
    return;
  }

  const currentConfig = getCurrentSiteConfig();
  const currentSiteUrl = currentConfig ? currentConfig.url : null;

  // 檢查網站匹配 - message.from 現在應該是完整的 url
  if (!currentSiteUrl || message.from !== currentSiteUrl) {
    return;
  }

  if (message.type === 'SAVE_SELECT_VALUES') {
    console.log(`[content.js] ${message.from}: SAVE_SELECT_VALUES → @content.js`);
    chrome.storage.local.set({ nueip_punch_settings: message.data.nueip_punch_settings });
  }
});

// 注入腳本和樣式
function injectScript(config) {
  const commonScript = 'src/inject/_common/wl-common.js';
  const allScripts = [commonScript, ...(config.inject?.js || [])];

  // 若任一 JS 已存在於 DOM，代表已注入過，跳過（SPA 換頁保護）
  const alreadyInjected = allScripts.some(f =>
    document.querySelector(`script[src="${chrome.runtime.getURL(f)}"]`)
  );
  if (alreadyInjected) return;

  // 注入樣式 <link rel="stylesheet" href="...">
  config.inject?.css?.forEach(styleFile => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(styleFile);
    document.body.appendChild(link);
  });
  allScripts.forEach((scriptFile, index) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptFile);

    if (index === allScripts.length - 1) { // 最後一個腳本載入完成後發送初始化消息
      script.onload = function() {
        // 特殊處理
        if (config.url === 'cloud.nueip.com/attendance_record') {
          chrome.storage.local.get(['nueip_punch_settings'], (result) => {
            window.postMessage({
              from: 'content.js',
              to: config.url,
              type: 'INIT',
              data: {
                nueip_punch_settings: result.nueip_punch_settings
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
    
    document.body.appendChild(script);
  })
}

// 主要初始化函數
function initialize() {
  const config = getCurrentSiteConfig();
  if (config) {
    // 檢查網站開關狀態
    chrome.storage.local.get(['siteToggles'], (result) => {
      const siteToggles = result.siteToggles || {};
      const toggleKey = config.toggleKey || config.matchedKey || config.hostname;

      if (siteToggles[toggleKey] === false) {
        console.log(`[content.js] 網站 ${toggleKey} 的擴充功能已關閉 ❌，不注入腳本`);
        return;
      }
      console.log(`[content.js] 網站 ${toggleKey} 的擴充功能已啟用 ✅，開始注入腳本`);
      injectScript(config);
    });
  }
}
initialize();

// 監聽 URL 變化（適用於 SPA 應用）
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    setTimeout(() => {
      const config = getCurrentSiteConfig();
      if (!config) return;

      const commonScript = 'src/inject/_common/wl-common.js';
      const allScripts = [commonScript, ...(config.inject?.js || [])];
      const alreadyInjected = allScripts.some(f =>
        document.querySelector(`script[src="${chrome.runtime.getURL(f)}"]`)
      );

      if (alreadyInjected) {
        window.postMessage({ from: 'content.js', to: config.url, type: 'UPDATE', data: {} }, '*');
      } else {
        initialize();
      }
    }, 1000);
  }
}).observe(document, {subtree: true, childList: true});