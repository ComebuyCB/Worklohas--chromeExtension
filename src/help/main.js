const FROM = 'help/main.js';
const TO   = 'background.js';

function send(type, data = {}) {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ from: FROM, to: TO, type, data }, resolve);
  });
}

// 與 popup 相同：優先用設定的 favicon，沒有則抓主網域的 favicon.ico
function getFaviconUrl(siteKey) {
  const site = inject_sites[siteKey];
  const primaryHost = site.paths[0].url.split('/')[0].replace(/^\*\./, '');
  return site.info.favicon || `https://${primaryHost}/favicon.ico`;
}

// 由 background.js 代抓並轉成 base64；失敗時保留原本的地球圖示
async function loadSiteIcon($icon) {
  const res = await send('getFavicon', { url: getFaviconUrl($icon.data('siteKey')) });
  if (!res?.data?.dataUrl) return;
  $icon.replaceWith(`<img src="${res.data.dataUrl}" alt="">`);
}

// 登入後 background.js 會快取試算表 ID，有 ID 就直接連到該檔案；否則維持 HTML 預設的試算表列表
function loadSheetLink() {
  chrome.storage.local.get(['sheetId'], result => {
    if (!result.sheetId) return;
    $('#link-sheet').attr('href', `https://docs.google.com/spreadsheets/d/${result.sheetId}/edit`);
  });
}

$(function () {
  $('.js-site-icon').each(function () {
    loadSiteIcon($(this));
  });

  loadSheetLink();
});
