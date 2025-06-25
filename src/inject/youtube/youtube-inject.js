// YouTube 功能增強腳本
console.log('CB_YouTube: YouTube 注入腳本已載入');

// 初始化 YouTube 功能
function initYouTube() {
  createFloatingButton();
}

// 創建浮動按鈕
function createFloatingButton() {
  if (document.getElementById('cb-youtube-button')) return;
  const button = document.createElement('div');
  button.id = 'cb-youtube-button';
  button.textContent = '🎵 CB';
  button.addEventListener('click', function() {
    alert('YouTube 擴充功能運行中！');
  });
  document.body.appendChild(button);
  console.log('CB_YouTube: 浮動按鈕已創建');
}

// 監聽來自 content.js 的消息
window.addEventListener('message', (event) => {
  const message = event.data;
  if (event.source !== window) return;
  
  // 檢查消息格式
  if (!message.from || !message.to || !message.type) {
    return;
  }
  
  // 檢查是否為發送給 YOUTUBE 的消息
  if (message.to !== 'YOUTUBE') {
    return;
  }
  
  if (message.type === 'INIT_YOUTUBE') {
    console.log('content.js: INIT_YOUTUBE → @YOUTUBE');
    initYouTube();
  }
});

// 如果頁面已經載入完成，直接初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initYouTube();
} else {
  document.addEventListener('DOMContentLoaded', initYouTube);
}