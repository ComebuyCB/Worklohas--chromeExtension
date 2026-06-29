const FROM = 'popup.js';
const TO   = 'background.js';

function send(type, data = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ from: FROM, to: TO, type, data }, resolve);
  });
}

$(function () {

  // 初始化：檢查登入狀態
  send('checkAuth').then(res => {
    setAuthUI(res?.data?.authed === true);
  });

  // 登入
  $('#btn-login').on('click', async function () {
    $(this).prop('disabled', true).html('<i class="fab fa-google me-2"></i>登入中…');
    const res = await send('login');
    $(this).prop('disabled', false).html('<i class="fab fa-google me-2"></i>登入 Google');
    if (res?.data?.status === 'success') {
      setAuthUI(true);
      reloadClipboard();
    } else {
      alert('登入失敗：' + (res?.data?.error || ''));
    }
  });

  // 登出
  $('#btn-logout').on('click', async function () {
    if (!confirm('確定要登出？')) return;
    $(this).prop('disabled', true);
    await send('logout');
    $(this).prop('disabled', false);
    setAuthUI(false);
    reloadClipboard();
  });

});

function setAuthUI(authed) {
  if (authed) {
    $('#btn-login').hide();
    $('#btn-logout').show();
  } else {
    $('#btn-login').show();
    $('#btn-logout').hide();
  }
}

function reloadClipboard() {
  const iframe = document.getElementById('iframe-clipboard');
  iframe.src = iframe.src;
}
