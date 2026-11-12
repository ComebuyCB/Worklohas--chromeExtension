const FROM = 'popup.js';
const TO   = 'background.js';
const CLIPBOARD_VISIBLE_KEY = 'popupClipboardVisible';

function send(type, data = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ from: FROM, to: TO, type, data }, resolve);
  });
}

$(function () {

  // 標題顯示 manifest 的名稱與版本
  const manifest = chrome.runtime.getManifest();
  $('#app-title').text(`${manifest.name} ${manifest.version}`);

  // 初始化：還原剪貼簿顯示狀態
  const $chkClipboard = $('#chk-clipboard');
  chrome.storage.local.get([CLIPBOARD_VISIBLE_KEY], result => {
    const isVisible = result[CLIPBOARD_VISIBLE_KEY] === true;
    $chkClipboard.prop('checked', isVisible);
    setClipboardVisible(isVisible);
  });

  // 切換剪貼簿顯示
  $chkClipboard.on('change', function () {
    const isVisible = $(this).prop('checked');
    setClipboardVisible(isVisible);
    chrome.storage.local.set({ [CLIPBOARD_VISIBLE_KEY]: isVisible });
  });

  // 點選項文字時不關閉選單，與點勾選框的行為一致
  $('#label-clipboard').on('click', e => e.stopPropagation());

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
  $('body').toggleClass('is_authed', authed);

  if (authed) {
    $('#btn-login').hide();
    $('#btn-logout').show();
  } else {
    $('#btn-login').show();
    $('#btn-logout').hide();
  }
}

function setClipboardVisible(isVisible) {
  $('#clipboard-wrap').prop('hidden', !isVisible);
}

function reloadClipboard() {
  const iframe = document.getElementById('iframe-clipboard');
  iframe.src = iframe.src;
}
