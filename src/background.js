const SHEET_KEY = 'sheetId';
const SHEET_NAME = 'ClipBoard';

// ── Token ────────────────────────────────────────────────
function getToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError?.message || 'No token');
      } else {
        resolve(token);
      }
    });
  });
}

function authHeaders(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

// ── Sheet ID 快取 ─────────────────────────────────────────
function getSheetId() {
  return new Promise((resolve) => {
    chrome.storage.local.get(SHEET_KEY, (r) => resolve(r[SHEET_KEY] || null));
  });
}

function saveSheetId(id) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [SHEET_KEY]: id }, resolve);
  });
}

// ── 搜尋既有 Sheet（drive.file 範圍內）────────────────────
async function findExistingSheet(token) {
  const q = encodeURIComponent(`name='Chrome Extension For Worklohas' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&pageSize=1`,
    { headers: authHeaders(token) }
  );
  const data = await res.json();
  return data.files?.[0]?.id || null;
}

// ── 建立新 Sheet ──────────────────────────────────────────
async function createSheet(token) {
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      properties: { title: 'Chrome Extension For Worklohas' },
      sheets: [{
        properties: { title: SHEET_NAME },
        data: [{
          startRow: 0,
          startColumn: 0,
          rowData: [{
            values: [
              { userEnteredValue: { stringValue: '標題' } },
              { userEnteredValue: { stringValue: '內容' } },
              { userEnteredValue: { stringValue: '群組' } },
              { userEnteredValue: { stringValue: '排序' } }
            ]
          }]
        }]
      }]
    })
  });
  const data = await res.json();
  return data.spreadsheetId;
}

async function ensureHeaders(token, sheetId) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A1:D1?valueInputOption=RAW`;
  await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ values: [['標題', '內容', '群組', '排序']] })
  });
}

async function ensureSheet(token) {
  let id = await getSheetId();

  if (!id) {
    id = await findExistingSheet(token);
    if (id) {
      await saveSheetId(id);
      await ensureHeaders(token, id);
    } else {
      id = await createSheet(token);
      await saveSheetId(id);
    }
    return id;
  }

  const check = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=spreadsheetId`,
    { headers: authHeaders(token) }
  );
  if (check.status === 404) {
    const found = await findExistingSheet(token);
    id = found || await createSheet(token);
    await saveSheetId(id);
    if (found) await ensureHeaders(token, id);
  }

  return id;
}

// ── 取得 gid（batchUpdate 用）────────────────────────────
async function getGid(token, sheetId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: authHeaders(token) }
  );
  const data = await res.json();
  return data.sheets.find(s => s.properties.title === SHEET_NAME)?.properties?.sheetId;
}

// ── CRUD ──────────────────────────────────────────────────
// A:標題 B:內容 C:群組 D:排序
async function readItems(token, sheetId) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A2:D`;
  const res = await fetch(url, { headers: authHeaders(token) });
  const data = await res.json();
  const rows = data.values || [];
  return rows.map((r, i) => ({
    row: i + 2,
    title:   r[0] || '',
    content: r[1] || '',
    group:   r[2] || '',
    order:   parseInt(r[3]) || 0
  }));
}

async function appendItem(token, sheetId, title, content, group, order) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A:D:append?valueInputOption=RAW`;
  await fetch(url, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ values: [[title, content, group, order]] })
  });
}

async function updateItem(token, sheetId, row, title, content, group, order) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${SHEET_NAME}!A${row}:D${row}?valueInputOption=RAW`;
  await fetch(url, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ values: [[title, content, group, order]] })
  });
}

async function deleteItem(token, sheetId, row) {
  const gid = await getGid(token, sheetId);
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: { sheetId: gid, dimension: 'ROWS', startIndex: row - 1, endIndex: row }
        }
      }]
    })
  });
}

async function updateOrders(token, sheetId, orders) {
  const data = orders.map(({ row, order }) => ({
    range: `${SHEET_NAME}!D${row}`,
    values: [[order]]
  }));
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ valueInputOption: 'RAW', data })
  });
}

async function renameGroup(token, sheetId, oldName, newName) {
  const items = await readItems(token, sheetId);
  const data = items
    .filter(item => item.group === oldName)
    .map(({ row }) => ({ range: `${SHEET_NAME}!C${row}`, values: [[newName]] }));
  if (data.length) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    });
  }
}

async function deleteGroup(token, sheetId, groupName, deleteData) {
  const items = await readItems(token, sheetId);
  const targets = items.filter(item => item.group === groupName);

  if (deleteData) {
    const gid = await getGid(token, sheetId);
    const rows = targets.map(t => t.row).sort((a, b) => b - a);
    const requests = rows.map(row => ({
      deleteDimension: {
        range: { sheetId: gid, dimension: 'ROWS', startIndex: row - 1, endIndex: row }
      }
    }));
    if (requests.length) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ requests })
      });
    }
  } else {
    const data = targets.map(({ row }) => ({
      range: `${SHEET_NAME}!C${row}`,
      values: [['']]
    }));
    if (data.length) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ valueInputOption: 'RAW', data })
      });
    }
  }
}

// ── Password Manager Sheet ────────────────────────────────
const PM_SHEET_NAME = 'Passwords';

async function ensurePMSheet(token, sheetId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: authHeaders(token) }
  );
  const data = await res.json();
  if (!data.sheets?.some(s => s.properties.title === PM_SHEET_NAME)) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: PM_SHEET_NAME } } }] })
    });
  }
  // 每次確保標題列正確（含 D1「時間」欄）
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${PM_SHEET_NAME}!A1:D1?valueInputOption=RAW`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ values: [['網站', '帳號', '密碼', '時間']] })
  });
}

async function pmReadItems(token, sheetId) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${PM_SHEET_NAME}!A2:D`,
    { headers: authHeaders(token) }
  );
  const data = await res.json();
  return (data.values || []).map((r, i) => ({
    row:       i + 2,
    site:      r[0] || '',
    account:   r[1] || '',
    password:  r[2] || '',
    timestamp: r[3] || ''
  }));
}

async function pmAddItem(token, sheetId, site, account, password) {
  const items = await pmReadItems(token, sheetId);
  if (items.some(i => i.site === site && i.account === account && i.password === password)) return;
  const timestamp = new Date().toISOString();
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${PM_SHEET_NAME}!A:D:append?valueInputOption=RAW`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ values: [[site, account, password, timestamp]] })
  });
}

// 帳密管理只開放給這些網域的分頁主框架
const PM_HOSTS = ['worklohas.com', 'worklohas.dev'];

// 由 sender.url 算出呼叫者所在的網站，格式與 inject/worklohas.com/index.js 的 site 相同
// 不採用網頁送來的 site，避免網頁讀取或改動其他網站的帳密
function getPMSite(sender) {
  if (!sender.tab || sender.frameId !== 0 || !sender.url) return null;
  const { protocol, hostname, pathname } = new URL(sender.url);
  if (protocol !== 'https:') return null;
  if (!PM_HOSTS.some(domain => hostname === domain || hostname.endsWith('.' + domain))) return null;
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  return hostname + (isAdmin ? '/admin' : '');
}

async function pmDeleteItem(token, sheetId, row) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties`,
    { headers: authHeaders(token) }
  );
  const data = await res.json();
  const gid = data.sheets?.find(s => s.properties.title === PM_SHEET_NAME)?.properties?.sheetId;
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      requests: [{ deleteDimension: { range: { sheetId: gid, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }]
    })
  });
}

// ── Favicon 代抓（繞過跨網域 CORP/CORS 限制）─────────────────
async function blobToDataUrl(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);
  return `data:${blob.type || 'image/x-icon'};base64,${base64}`;
}

async function fetchFaviconAsDataUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return blobToDataUrl(blob);
}

// ── 截圖標註 ──────────────────────────────────────────────
const SCREENSHOT_COMMAND = 'open-screenshot-editor';
const SCREENSHOT_CSS = 'src/inject/_screenshot/screenshot.css';
const SCREENSHOT_TAB_KEY = 'wl_report_tab'; // 開著工具的分頁，換頁後要接回去；瀏覽器關閉就不需要了，存 session
const SCREENSHOT_FILES = [
  'static/plugins/jquery-3.6.4/jquery.min.js',
  'src/inject/_screenshot/screenshot.js'
];

// method：open 是使用者開啟，resume 是換頁後接回
async function injectScreenshotEditor(tabId, method) {
  const res = await fetch(chrome.runtime.getURL(SCREENSHOT_CSS));
  const cssText = await res.text();
  const commands = await chrome.commands.getAll();
  const shortcut = commands.find(command => command.name === SCREENSHOT_COMMAND)?.shortcut || '';
  const target = { tabId };

  await chrome.scripting.executeScript({ target, files: SCREENSHOT_FILES });
  await chrome.scripting.executeScript({
    target,
    func: (method, options) => window.wlScreenshot[method](options),
    args: [method, { cssText, shortcut }]
  });
}

async function openScreenshotEditor(tabId) {
  await injectScreenshotEditor(tabId, 'open');
  await chrome.storage.session.set({ [SCREENSHOT_TAB_KEY]: tabId });
}

// 整頁截圖：和 F12「Capture full size screenshot」相同，透過偵錯介面截取整個網頁（含捲動範圍）
// 做法也和 F12 相同：暫時把頁面尺寸設成整頁大小再截圖，截完還原；只靠 captureBeyondViewport 時，超出一個畫面的部分會重複第一個畫面
// 接上偵錯介面時 Chrome 會在分頁上方顯示提示列，截完立刻中斷連線，提示列就會消失
const FULL_PAGE_SETTLE_DELAY = 300; // 整頁截圖改尺寸後，等網頁重畫的毫秒數

async function captureFullPage(tabId) {
  const target = { tabId };
  await chrome.debugger.attach(target, '1.3');
  try {
    const metrics = await chrome.debugger.sendCommand(target, 'Page.getLayoutMetrics');
    // cssContentSize 是 CSS 像素；舊版 Chrome 只有 contentSize
    const size = metrics.cssContentSize || metrics.contentSize;
    const width = Math.ceil(size.width);
    const height = Math.ceil(size.height);
    const { result } = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', { expression: 'window.devicePixelRatio', returnByValue: true });
    const deviceScaleFactor = result?.value || 1;

    await chrome.debugger.sendCommand(target, 'Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
    try {
      // 改尺寸後要等網頁用新尺寸重畫，馬上截圖的話超出一個畫面的部分仍是舊畫面
      // 只等兩個畫格不夠（實測仍會重複），固定再等一段時間
      await new Promise(resolve => setTimeout(resolve, FULL_PAGE_SETTLE_DELAY));
      const { data } = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
        fromSurface: true,
        clip: { x: 0, y: 0, width, height, scale: 1 },
      });
      return { dataUrl: `data:image/png;base64,${data}`, width, height };
    } finally {
      await chrome.debugger.sendCommand(target, 'Emulation.clearDeviceMetricsOverride').catch(() => {});
    }
  } finally {
    await chrome.debugger.detach(target).catch(() => {});
  }
}

// 同一分頁換頁後，網頁內的工具會跟著消失，載入完成時接回去
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== 'complete') return;
  const stored = await chrome.storage.session.get(SCREENSHOT_TAB_KEY);
  if (stored[SCREENSHOT_TAB_KEY] !== tabId) return;
  // 瀏覽器內建頁、商店頁無法注入，回到一般網頁時會再接回
  injectScreenshotEditor(tabId, 'resume').catch(error => console.log('[截圖標註] 此頁無法接回工具', error.message));
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== SCREENSHOT_COMMAND || !tab?.id) return;
  openScreenshotEditor(tab.id).catch(error => console.error('[截圖標註] 無法開啟', error));
});

// ── 訊息監聽 ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message.from || message.to !== 'background.js' || !message.type) { return true; }

  (async () => {
    try {
      if (message.type === 'logout') {
        const token = await getToken(false).catch(() => null);
        if (token) {
          await new Promise(resolve => chrome.identity.removeCachedAuthToken({ token }, resolve));
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`).catch(() => {});
        }
        await saveSheetId(null);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });
        return;
      }

      if (message.type === 'checkAuth') {
        try {
          await getToken(false);
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { authed: true } });
        } catch (_) {
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { authed: false } });
        }
        return;
      }

      if (message.type === 'getFavicon') {
        try {
          const dataUrl = await fetchFaviconAsDataUrl(message.data.url);
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { dataUrl } });
        } catch (_) {
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { dataUrl: null } });
        }
        return;
      }

      // 截圖標註：不需要 Google 登入，必須放在下方取得 token 之前
      if (message.type === 'openScreenshotEditor') {
        try {
          // 只接受擴充功能自己的頁面（popup），網頁內的腳本不能指定要注入的分頁
          if (sender.tab) throw new Error('不允許的來源');
          await openScreenshotEditor(message.data.tabId);
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });
        } catch (e) {
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'error', error: e.message } });
        }
        return;
      }

      if (message.type === 'screenshotClosed') {
        // 被其他分頁接手時不會送這個訊息，這裡只處理使用者在目前記錄的分頁按結束
        const stored = await chrome.storage.session.get(SCREENSHOT_TAB_KEY);
        if (stored[SCREENSHOT_TAB_KEY] === sender.tab?.id) await chrome.storage.session.remove(SCREENSHOT_TAB_KEY);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });
        return;
      }

      if (message.type === 'captureVisibleTab') {
        try {
          // 只允許目前顯示中的分頁截自己的畫面，避免截到使用者已切換過去的其他分頁
          if (!sender.tab?.active) throw new Error('分頁未顯示');
          const dataUrl = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { dataUrl } });
        } catch (e) {
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { dataUrl: null, error: e.message } });
        }
        return;
      }

      if (message.type === 'captureFullPage') {
        try {
          // 只允許目前顯示中分頁的主框架截自己的整頁
          if (!sender.tab?.active || sender.frameId !== 0) throw new Error('分頁未顯示');
          const result = await captureFullPage(sender.tab.id);
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: result });
        } catch (e) {
          sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { dataUrl: null, error: e.message } });
        }
        return;
      }

      // 帳密管理：先確認來源網站，不符合就不取 token、不碰試算表
      const pmSite = message.type.startsWith('pm_') ? getPMSite(sender) : null;
      if (message.type.startsWith('pm_') && !pmSite) throw new Error('不允許的來源');

      const interactive = message.type === 'login';
      const token = await getToken(interactive);
      const sheetId = await ensureSheet(token);

      if (message.type === 'login') {
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'list') {
        const items = await readItems(token, sheetId);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { items } });

      } else if (message.type === 'add') {
        const { title, content, group, order } = message.data;
        await appendItem(token, sheetId, title, content, group || '', order || 0);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'update') {
        const { row, title, content, group, order } = message.data;
        await updateItem(token, sheetId, row, title, content, group || '', order ?? 0);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'delete') {
        await deleteItem(token, sheetId, message.data.row);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'reorder') {
        await updateOrders(token, sheetId, message.data.orders);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'renameGroup') {
        await renameGroup(token, sheetId, message.data.oldName, message.data.newName);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'deleteGroup') {
        await deleteGroup(token, sheetId, message.data.groupName, message.data.deleteData);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'pm_list') {
        await ensurePMSheet(token, sheetId);
        // 只回傳目前網站的帳密
        const items = (await pmReadItems(token, sheetId)).filter(i => i.site === pmSite);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { items } });

      } else if (message.type === 'pm_add') {
        await ensurePMSheet(token, sheetId);
        const { site, account, password } = message.data;
        // 帳密是在登入頁暫存、下一頁才送出，兩頁屬於同一網站才寫入
        if (site !== pmSite) throw new Error('網站不符');
        await pmAddItem(token, sheetId, pmSite, account, password);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'pm_delete') {
        await ensurePMSheet(token, sheetId);
        // 只能刪除目前網站的列
        const target = (await pmReadItems(token, sheetId)).find(i => i.row === message.data.row);
        if (target?.site !== pmSite) throw new Error('網站不符');
        await pmDeleteItem(token, sheetId, message.data.row);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });
      }

    } catch (e) {
      sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'error', error: e.toString() } });
    }
  })();

  return true;
});
