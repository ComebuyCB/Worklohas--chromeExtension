// YouTube 功能增強腳本
console.log('CB_YouTube: YouTube 注入腳本已載入');

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
  
  // 檢查消息格式和目標
  if (!message?.from || !message?.type || message.to !== 'www.youtube.com/watch') return;

  if (message.type === 'INIT') {
    console.log(`content.js: INIT → @[${message.to}]`);
    initYouTube();
  }
});

function initYouTube() {
  _skipAds();
  // createFloatingButton();
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initYouTube();
} else {
  document.addEventListener('DOMContentLoaded', ()=>{
    initYouTube();
  });
}

function _skipAds() {
  console.log('===偵測廣告中===');

  // Skip廣告
  const adSkip = document.querySelector('.ytp-ad-skip-button-modern');
  if (adSkip) {
    adSkip.click();
    console.log('關閉 Skip廣告!');
  }

  // 彈窗廣告
  const adBox = document.querySelector('.ytp-ad-overlay-close-button');
  if (adBox) {
    adBox.click();
    console.log('關閉 彈窗廣告!');
  }

  // 倒數廣告
  const skipAdButton = document.querySelector('.ytp-skip-ad-button');
  const video = document.querySelector('.html5-main-video');
  const adShowing = document.querySelector('.ad-showing');
  if (adShowing && video && video.currentTime < video.duration - 0.01) {
    // video.currentTime = video.duration - 0.01;
    console.log('關閉 倒數廣告!');
  }

  let sto = setTimeout(() => {
    clearTimeout(sto);
    _skipAds();
  }, 3000);
}