/*=== 任意網站 ===*/

// 監聽來自 popup 的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'POST_MESSAGE') {
    window.postMessage(request.message, '*');
  } else if (request.type === 'SET_TIME') {
    sendResponse({success: true});
  }
  return true; // 保持消息通道開啟
});

// 監聽來自頁面的消息
window.addEventListener('message', (event) => {
  const receivedData = event.data;
  if (receivedData.type === 'SAVE_SELECT_VALUES') {
    chrome.storage.local.set({ autoPunchSettings: receivedData.data.autoPunchSettings }, function() {
      console.log('Select values saved:', receivedData.data.autoPunchSettings);
    });
  }
});

// 注入腳本
function injectScript() {
  if (window.location.href.includes('cloud.nueip.com/attendance_record')) {
    // 先讀取儲存的值
    chrome.storage.local.get(['autoPunchSettings'], (result) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('inject/testExtension-inject.js');
      script.onload = function() {
        window.postMessage({
          type: 'INIT_SELECT_VALUES',
          data: {
            autoPunchSettings: result.autoPunchSettings
          }
        }, '*');
      };
      (document.head || document.documentElement).appendChild(script);
    });
  }
}
injectScript();