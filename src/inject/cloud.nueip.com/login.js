/*=== NUEIP 登入頁面注入腳本 ===*/

wlLog('NUEIP Login Script Loaded');

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!message?.from || !message?.type || message.to !== 'cloud.nueip.com/login') return;

  if (message.type === 'INIT') {
    initializeLoginPage();
  }
});

function initializeLoginPage() {
  // 可在此添加登入頁面功能，例如：記住帳號、自動填入
}
