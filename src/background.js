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
        const items = await pmReadItems(token, sheetId);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { items } });

      } else if (message.type === 'pm_add') {
        await ensurePMSheet(token, sheetId);
        const { site, account, password } = message.data;
        await pmAddItem(token, sheetId, site, account, password);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });

      } else if (message.type === 'pm_delete') {
        await ensurePMSheet(token, sheetId);
        await pmDeleteItem(token, sheetId, message.data.row);
        sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'success' } });
      }

    } catch (e) {
      sendResponse({ from: 'background.js', to: message.from, type: 'RESPONSE', data: { status: 'error', error: e.toString() } });
    }
  })();

  return true;
});
