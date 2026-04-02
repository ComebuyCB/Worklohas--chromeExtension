/*=== NUEIP 登入頁面注入腳本 ===*/

// 注入腳本載入完成標記
console.log('NUEIP Login Script Loaded');

// 監聽來自 content.js 的初始化消息
window.addEventListener('message', (event) => {
  const message = event.data;
  
  // 檢查消息格式和目標
  if (!message?.from || !message?.type || message.to !== 'cloud.nueip.com/login') return;

  if (message.type === 'INIT') {
    console.log(`content.js: INIT → @[${message.to}]`);
    initializeLoginPage();
  }
});

// 初始化登入頁面功能
function initializeLoginPage() {
  console.log('NUEIP Login: 初始化登入頁面功能');
  
  // 可以在這裡添加登入頁面的特定功能
  // 例如：記住帳號、自動填入、登入狀態檢查等
  
  // 示例：添加登入頁面的輔助功能
  addLoginHelpers();
}

// 添加登入頁面輔助功能
function addLoginHelpers() {
  // 檢查是否已經登入
  checkLoginStatus();
  
  // 添加記住帳號功能
  addRememberAccountFeature();
}

// 檢查登入狀態
function checkLoginStatus() {
  // 如果已經登入，可能會自動跳轉
  console.log('NUEIP Login: 檢查登入狀態');
}

// 添加記住帳號功能
function addRememberAccountFeature() {
  console.log('NUEIP Login: 添加記住帳號功能');
  
  // 可以在這裡實作記住帳號的邏輯
  // 例如：從 chrome.storage 讀取之前儲存的帳號資訊
}