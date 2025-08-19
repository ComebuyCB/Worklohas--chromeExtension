/*=== 通用多網站內容腳本 ===*/


// 獲取當前網站配置
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;
  
  const siteConfig = SITE_CONFIGS[hostname];
  if (!siteConfig) {
    return null;
  }

  // 處理陣列格式的配置（支援多個 URL 模式）
  if (Array.isArray(siteConfig)) {
    for (const config of siteConfig) {
      const matchesPattern = config.urlPatterns.some(pattern => pathname.includes(pattern));
      if (matchesPattern) {
        console.log(`CB_Content: 找到網站配置: `, config);
        return {
          ...config,
          hostname
        };
      }
    }
    return null;
  }

  // 處理單一配置格式（向後相容）
  const matchesPattern = siteConfig.urlPatterns.some(pattern => pathname.includes(pattern));
  if (!matchesPattern) {
    return null;
  }

  console.log(`CB_Content: 找到網站配置: `, siteConfig);
  return {
    ...siteConfig,
    hostname
  };
}

// 監聽來自其他組件的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // 獲取當前網站配置以確定網站名稱
  const currentConfig = getCurrentSiteConfig();
  const currentSiteName = currentConfig ? currentConfig.name : null;
  
  // 檢查消息格式
  if (!message.from || !message.to || !message.type) {
    return true;
  }
  
  // 檢查是否為發送給 content.js 的消息
  if (message.to !== 'content.js') {
    return true;
  }
  
  if (message.type === 'POST_MESSAGE') {
    // 轉發消息給注入腳本
    const forwardMessage = {
      from: 'content.js',
      to: currentSiteName, // 使用 sites.js 中的 name: "NUEIP" 或 "YOUTUBE"
      type: message.data.type,
      data: message.data.data
    };
    window.postMessage(forwardMessage, '*');
    console.log(`@content.js → ${currentSiteName}: ${message.data.type}`);
  } else if (message.type === 'SET_TIME') {
    sendResponse({from: 'content.js', to: message.from, type: 'RESPONSE', data: {success: true}});
  }
  return true; // 保持消息通道開啟
});

// 監聽來自注入腳本的消息
window.addEventListener('message', (event) => {
  const message = event.data;
  const currentConfig = getCurrentSiteConfig();
  const currentSiteName = currentConfig ? currentConfig.name : null;
  
  // 檢查消息格式
  if (!message.from || !message.to || !message.type) {
    return;
  }
  
  // 檢查是否為發送給 content.js 的消息
  if (message.to !== 'content.js') {
    return;
  }
  
  // 檢查網站匹配
  if (message.from !== 'NUEIP' && message.from !== 'YOUTUBE') {
    return;
  }
  
  if (message.type === 'SAVE_SELECT_VALUES') {
    console.log(`${message.from}: SAVE_SELECT_VALUES → @content.js`);
    chrome.storage.local.set({ autoPunchSettings: message.data.autoPunchSettings });
  }
});

// 注入腳本和樣式
function injectScript(config) {
  // 注入樣式
  if (config.inject.styles) {
    config.inject.styles.forEach(styleFile => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = chrome.runtime.getURL(styleFile);
      document.head.appendChild(link);
    });
  }
  
  // 注入腳本
  if (config.inject.scripts) {
    config.inject.scripts.forEach((scriptFile, index) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(scriptFile);
      
      // 最後一個腳本載入完成後發送初始化消息
      if (index === config.inject.scripts.length - 1) {
        script.onload = function() {
          
          // 根據網站類型和 URL 模式發送不同的初始化消息
          if (config.hostname === 'cloud.nueip.com') {
            if (config.initMessage === 'INIT_SELECT_VALUES') {
              // NUEIP 出勤頁面需要載入儲存的設定
              chrome.storage.local.get(['autoPunchSettings'], (result) => {
                console.log('@content.js → NUEIP: INIT_SELECT_VALUES');
                window.postMessage({
                  from: 'content.js',
                  to: 'NUEIP',
                  type: 'INIT_SELECT_VALUES',
                  data: {
                    autoPunchSettings: result.autoPunchSettings
                  }
                }, '*');
              });
            } else if (config.initMessage === 'INIT_LOGIN') {
              // NUEIP 登入頁面
              console.log('@content.js → NUEIP: INIT_LOGIN');
              window.postMessage({
                from: 'content.js',
                to: 'NUEIP',
                type: 'INIT_LOGIN',
                data: {}
              }, '*');
            }
          } else if (config.hostname === 'www.youtube.com') {
            if (config.initMessage === 'INIT_YOUTUBE_WATCH') {
              // YouTube 觀看頁面
              console.log('@content.js → YOUTUBE: INIT_YOUTUBE_WATCH');
              window.postMessage({
                from: 'content.js',
                to: 'YOUTUBE',
                type: 'INIT_YOUTUBE_WATCH',
                data: {}
              }, '*');
            }
          } else if (config.hostname === 'rent.591.com.tw') {
            if (config.initMessage === 'INIT_RENT_LIST') {
              // 591 租屋網列表頁面
              console.log('@content.js → RENT591: INIT_RENT_LIST');
              window.postMessage({
                from: 'content.js',
                to: 'RENT591',
                type: 'INIT_RENT_LIST',
                data: {}
              }, '*');
            }
          } else {
            // 其他網站的通用初始化
            console.log(`@content.js → ${config.name}: ${config.initMessage}`);
            window.postMessage({
              from: 'content.js',
              to: config.name,
              type: config.initMessage,
              data: {}
            }, '*');
          }
        };
      }
      
      (document.head || document.documentElement).appendChild(script);
    });
  }
}

// 主要初始化函數
function initialize() {
  const config = getCurrentSiteConfig();
  if (config) {
    injectScript(config);
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

// 初始化在 loadSiteConfigs() 中執行