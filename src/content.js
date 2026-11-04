/*=== 通用多網站內容腳本 ===*/

const contentLog = console.log.bind(console, '%c[content.js]%c', 'color:#2196F3;font-weight:bold', '');

// 獲取當前網站配置
function getCurrentSiteConfig() {
  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  for (const [siteKey, siteConfig] of Object.entries(SITE_CONFIGS)) {
    if (!Array.isArray(siteConfig.paths)) continue;

    for (const pathConfig of siteConfig.paths) {
      if (_matchUrlPattern(hostname, pathname, pathConfig.url)) {
        contentLog(`找到網站配置: `, pathConfig);
        return {
          ...pathConfig,
          hostname,
          siteKey,
          toggleKey: siteConfig.toggleKey || siteKey,
        };
      }
    }
  }

  return null;
}

// 比對 hostname + pathname 是否符合 url pattern
// pattern 格式: "host/path"，host 支援 *.domain 萬用字元，path 支援結尾 * 前綴匹配
function _matchUrlPattern(hostname, pathname, pattern) {
  const slashIdx = pattern.indexOf('/');
  const hostPat = slashIdx === -1 ? pattern : pattern.slice(0, slashIdx);
  const hasPath = slashIdx !== -1;
  const pathPat = hasPath ? pattern.slice(slashIdx + 1) : '';

  // host 比對
  let hostMatch;
  if (hostPat.startsWith('*.')) {
    const domain = hostPat.slice(2);
    hostMatch = hostname === domain || hostname.endsWith('.' + domain);
  } else {
    hostMatch = hostname === hostPat;
  }
  if (!hostMatch) return false;

  // pattern 未帶 / 時，僅比對 host，不限制路徑
  if (!hasPath) return true;
  if (pathPat === '*') return true;

  // path 比對（pathPat 為 pattern 中 / 之後的部分，pathname 去掉開頭 /）
  // pathPat 為空字串（pattern 以 / 結尾）時，僅精確比對根路徑
  const path = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  if (pathPat.endsWith('*')) return path.startsWith(pathPat.slice(0, -1));
  return path === pathPat;
}

// 已注入檢查（供 injectScript 與 SPA observer 共用）
const JQUERY_SCRIPT = 'static/plugins/jquery-3.6.4/jquery.min.js';
const COMMON_SCRIPT = 'src/inject/_common/common.js';
const COMMON_CSS = 'src/inject/_common/common.css';

// 組出該 config 實際要注入的腳本清單，jQuery 需在 inject-config.js 該路徑的 features 加入 'jquery' 才會注入
function _getInjectScripts(config) {
  const scripts = [COMMON_SCRIPT, ...(config.inject?.js || [])];
  if (config.features?.includes('jquery')) scripts.unshift(JQUERY_SCRIPT);
  return scripts;
}

function _isAlreadyInjected(config) {
  const allScripts = _getInjectScripts(config);
  return allScripts.some(f => document.querySelector(`script[src="${chrome.runtime.getURL(f)}"]`));
}

// 監聽來自其他組件的消息
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (!message.from || message.to !== 'content.js' || !message.type) { return true; }
  return true; // 保持消息通道開啟
});

// 監聽來自注入腳本(inject/*)的消息
window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message?.from || message.to !== 'content.js' || !message?.type) { return; }

  // PM UI state：直接在 content.js 存取 storage.local，不需轉發 background
  if (message.type === 'pm_save_state') {
    chrome.storage.local.set({ wl_pm_settings: message.data });
    return;
  }
  if (message.type === 'pm_get_state') {
    chrome.storage.local.get(['wl_pm_settings'], (result) => {
      window.postMessage({ from: 'content.js', to: message.from, requestId: message.requestId, data: result.wl_pm_settings || {} }, '*');
    });
    return;
  }

  // PM bridge：帳密管理訊息中轉至 background.js（inject 腳本在 page world，無法直接呼叫 chrome API）
  if (message.type.startsWith('pm_')) {
    new Promise(resolve => {
      chrome.runtime.sendMessage(
        { from: message.from, to: 'background.js', type: message.type, data: message.data || {} },
        resolve
      );
    }).then(response => {
      if (message.requestId === null) return; // fire and forget
      window.postMessage({
        from: 'content.js',
        to: message.from,
        requestId: message.requestId,
        data: response?.data
      }, '*');
    });
    return;
  }

  // 通用 onMessage dispatch → 由 inject-config.js 的 path config 宣告處理邏輯
  const currentConfig = getCurrentSiteConfig();
  if (currentConfig?.onMessage?.[message.type]) {
    currentConfig.onMessage[message.type](message.data);
  }
});

// 注入腳本和樣式
function injectScript(config) {
  if (_isAlreadyInjected(config)) return;

  const allStyles = [COMMON_CSS, ...(config.inject?.css || [])];
  allStyles.forEach(styleFile => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL(styleFile);
    document.body.appendChild(link);
  });

  const allScripts = _getInjectScripts(config);

  allScripts.forEach((scriptFile, index) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(scriptFile);
    script.async = false; // 保證依插入順序依序執行（jQuery → common.js → 各站點腳本）

    if (index === allScripts.length - 1) {
      script.onload = function() {
        const send = (data = {}) => window.postMessage(
          { from: 'content.js', to: config.url, type: 'INIT', data }, '*'
        );
        config.init ? config.init(send) : send();
      };
    }

    document.body.appendChild(script);
  });
}

// 主要初始化函數
function initialize() {
  const config = getCurrentSiteConfig();
  if (config) {
    chrome.storage.local.get(['siteToggles'], (result) => {
      const siteToggles = result.siteToggles || {};
      const toggleKey = config.toggleKey;

      if (siteToggles[toggleKey] === false) {
        contentLog(`網站 ${toggleKey} 的擴充功能已關閉 ❌，不注入腳本`);
        return;
      }
      contentLog(`網站 ${toggleKey} 的擴充功能已啟用 ✅，開始注入腳本`);
      injectScript(config);
    });
  }
}
initialize();

// 判斷該 hostname 是否存在任何含 'spa' feature 的設定。
// 不依賴「目前路徑當下就符合設定」，因為 SPA 首次進入該頁前可能停留在完全不相關的路徑，
// 若監聽器只在「一開始就符合」時才掛上，會導致從非文章頁導覽進文章頁時永遠偵測不到、腳本也不會注入。
function _hostHasSpaFeature(hostname) {
  for (const siteConfig of Object.values(SITE_CONFIGS)) {
    if (!Array.isArray(siteConfig.paths)) continue;
    for (const pathConfig of siteConfig.paths) {
      if (!pathConfig.features?.includes('spa')) continue;
      const hostPat = pathConfig.url.split('/')[0];
      const hostMatch = hostPat.startsWith('*.')
        ? (hostname === hostPat.slice(2) || hostname.endsWith('.' + hostPat.slice(2)))
        : hostname === hostPat;
      if (hostMatch) return true;
    }
  }
  return false;
}

if (_hostHasSpaFeature(window.location.hostname)) {
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(() => {
        const config = getCurrentSiteConfig();
        if (!config) {
          // 網址離開了符合的設定範圍（例如 SPA 導到非文章頁），通知已注入的腳本自行收起 UI
          window.postMessage({ from: 'content.js', to: 'spa-watch', type: 'LEAVE', data: {} }, '*');
          return;
        }

        if (_isAlreadyInjected(config)) {
          window.postMessage({ from: 'content.js', to: config.url, type: 'UPDATE', data: {} }, '*');
        } else {
          initialize();
        }
      }, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
}
