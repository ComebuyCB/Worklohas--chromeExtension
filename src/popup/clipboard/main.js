const FROM = 'clipboard/main.js';
const TO   = 'background.js';

function send(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ from: FROM, to: TO, type, data }, resolve);
  });
}

// ── 全域狀態 ──────────────────────────────────────────────
let allItems   = [];   // 所有資料
let activeGroup = '';  // '' = 一般

// ── Toast ─────────────────────────────────────────────────
function showToast(msg = '已複製！', bg = 'bg-success') {
  const $toast = $('#toast').removeClass('bg-success bg-danger').addClass(bg).show();
  $('#toast-msg').text(msg);
  new bootstrap.Toast($toast[0], { delay: 1500 }).show();
}

// ── 畫面切換 ──────────────────────────────────────────────
function showMain() {
  bootstrap.Modal.getInstance('#modal-edit-item')?.hide();
}

function showEdit({ row = '', title = '', content = '', group = '', order = 0 } = {}) {
  $('#edit-row').val(row);
  $('#edit-order').val(order);
  $('#edit-title').val(title);
  $('#edit-content').val(content);
  $('#edit-group').val(group);
  $('#edit-mode-label').text(row ? '編輯項目' : '新增項目');
  row ? $('#btn-delete').show() : $('#btn-delete').hide();

  // 更新 datalist
  const groups = [...new Set(allItems.map(i => i.group).filter(Boolean))];
  $('#group-list').empty();
  groups.forEach(g => $('#group-list').append(`<option value="${g}">`));

  const modal = new bootstrap.Modal('#modal-edit-item');
  $('#modal-edit-item').one('shown.bs.modal', () => $('#edit-title').focus());
  modal.show();
}

// ── Tab 渲染 ──────────────────────────────────────────────
function renderTabs() {
  const groups = [...new Set(allItems.map(i => i.group).filter(Boolean))];
  const $tabs = $('#group-tabs').empty();

  const makeTab = (label, groupVal) => {
    const isGeneral = groupVal === '';
    const delBtn = isGeneral ? '' : '<button class="wl-tab-del" type="button" title="管理群組"><i class="fas fa-pen"></i></button>';
    const $li = $(`<li class="nav-item${isGeneral ? '' : ' wl-tab-item'}"><a class="nav-link${groupVal === activeGroup ? ' active' : ''}" href="#">${label}</a>${delBtn}</li>`);

    $li.find('a').on('click', function (e) {
      e.preventDefault();
      activeGroup = groupVal;
      renderTabs();
      renderList();
    });

    if (!isGeneral) {
      $li.find('.wl-tab-del').on('click', function (e) {
        e.stopPropagation();
        $('#edit-group-original').val(groupVal);
        $('#edit-group-name').val(groupVal);
        $('#chk-del-data').prop('checked', false);
        new bootstrap.Modal('#modal-edit-group').show();
      });
    }

    return $li;
  };

  $tabs.append(makeTab('一般', ''));
  groups.forEach(g => $tabs.append(makeTab(g, g)));
}

// ── 清單渲染 ──────────────────────────────────────────────
function renderList() {
  const $ul = $('#wl-list').empty();
  const $empty = $('.wl-empty');

  const items = allItems
    .filter(i => i.group === activeGroup)
    .sort((a, b) => a.order - b.order);

  if (!items.length) {
    $empty.show();
    return;
  }

  $empty.hide();

  items.forEach((item) => {
    const $li = $(`
      <li class="list-group-item" data-row="${item.row}">
        <span class="wl-drag-handle"><i class="fas fa-grip-vertical"></i></span>
        <button class="wl-item-btn">
          ${$('<div>').text(item.title).html()}
        </button>
        <button class="btn btn-sm wl-btn-edit" title="編輯">
          <i class="fas fa-pen fa-xs"></i>
        </button>
      </li>
    `);

    $li.find('.wl-item-btn').on('click', async function () {
      await navigator.clipboard.writeText(item.content);
      showToast('已複製！');
    });

    $li.find('.wl-btn-edit').on('click', function () {
      showEdit(item);
    });

    $ul.append($li);
  });

  initDrag($ul);
}

// ── 拖曳排序 ──────────────────────────────────────────────
function initDrag($ul) {
  let dragSrc     = null;
  let dropBefore  = true;

  const clearLines = () => $ul.find('li').removeClass('drag-over-top drag-over-bottom');

  $ul.find('li').each(function () {
    const el = this;
    const handle = el.querySelector('.wl-drag-handle');

    handle.addEventListener('mousedown', () => { el.draggable = true; });
    el.addEventListener('mouseup', () => { el.draggable = false; });

    el.addEventListener('dragstart', function (e) {
      dragSrc = this;
      $(this).addClass('dragging');
      const rect = this.getBoundingClientRect();
      e.dataTransfer.setDragImage(this, e.clientX - rect.left, e.clientY - rect.top);
    });

    el.addEventListener('dragend', function () {
      this.draggable = false;
      $(this).removeClass('dragging');
      clearLines();
      saveDragOrder($ul);
    });

    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (this === dragSrc) return;
      clearLines();
      const rect = this.getBoundingClientRect();
      dropBefore = e.clientY < rect.top + rect.height / 2;
      $(this).addClass(dropBefore ? 'drag-over-top' : 'drag-over-bottom');
    });

    el.addEventListener('drop', function (e) {
      e.preventDefault();
      if (this === dragSrc) return;
      const $src = $(dragSrc);
      dropBefore ? $(this).before($src) : $(this).after($src);
    });
  });
}

async function saveDragOrder($ul) {
  const orders = [];
  $ul.find('li').each(function (idx) {
    const row = parseInt($(this).data('row'));
    orders.push({ row, order: idx });
    const item = allItems.find(i => i.row === row);
    if (item) item.order = idx;
  });
  await send('reorder', { orders });
}

// ── 載入清單 ──────────────────────────────────────────────
async function loadList() {
  $('#login-area').hide();
  $('#content-area').hide();
  $('#logged-area').show();
  $('#wl-list').empty();
  $('.wl-empty').hide();
  $('#group-tabs').empty();
  $('#loading-area').show();

  const res = await send('list');
  $('#loading-area').hide();

  if (!res || res.data?.status === 'error') {
    $('#logged-area').hide();
    $('#login-area').show();
    return;
  }

  $('#content-area').show();
  allItems = res.data.items || [];
  renderTabs();
  renderList();
}

// ── 初始化 ────────────────────────────────────────────────
$(function () {

  loadList();

  $('#btn-add').on('click', function () {
    showEdit({ group: activeGroup });
  });

  $('#btn-save').on('click', async function () {
    const row     = $('#edit-row').val();
    const order   = parseInt($('#edit-order').val()) || 0;
    const title   = $('#edit-title').val().trim();
    const content = $('#edit-content').val().trim();
    const group   = $('#edit-group').val().trim();

    if (!title || !content) { alert('請填寫標題與內容'); return; }

    $(this).prop('disabled', true).text('儲存中…');

    const type = row ? 'update' : 'add';
    const data = row
      ? { row: parseInt(row), title, content, group, order }
      : { title, content, group, order: allItems.filter(i => i.group === group).length };

    const res = await send(type, data);
    $(this).prop('disabled', false).html('<i class="fas fa-save me-1"></i>儲存');

    if (res?.data?.status === 'success') {
      activeGroup = group;
      showMain();
      loadList();
    } else {
      alert('儲存失敗：' + (res?.data?.error || '未知錯誤'));
    }
  });

  $('#btn-delete').on('click', async function () {
    if (!confirm('確定刪除這個項目？')) return;
    const row = parseInt($('#edit-row').val());
    $(this).prop('disabled', true);
    const res = await send('delete', { row });
    $(this).prop('disabled', false);
    if (res?.data?.status === 'success') {
      showMain();
      loadList();
    } else {
      alert('刪除失敗：' + (res?.data?.error || '未知錯誤'));
    }
  });

  $('#btn-rename-group').on('click', async function () {
    const oldName = $('#edit-group-original').val();
    const newName = $('#edit-group-name').val().trim();
    if (!newName || newName === oldName) return;
    $(this).prop('disabled', true);
    const res = await send('renameGroup', { oldName, newName });
    $(this).prop('disabled', false);
    if (res?.data?.status === 'success') {
      bootstrap.Modal.getInstance('#modal-edit-group').hide();
      if (activeGroup === oldName) activeGroup = newName;
      loadList();
    } else {
      alert('重新命名失敗：' + (res?.data?.error || '未知錯誤'));
    }
  });

  $('#btn-del-group-confirm').on('click', async function () {
    const deleteData = $('#chk-del-data').is(':checked');
    const groupName  = $('#edit-group-original').val();
    bootstrap.Modal.getInstance('#modal-edit-group').hide();
    $(this).prop('disabled', true);
    const res = await send('deleteGroup', { groupName, deleteData });
    $(this).prop('disabled', false);
    if (res?.data?.status === 'success') {
      if (activeGroup === groupName) activeGroup = '';
      loadList();
    } else {
      alert('刪除失敗：' + (res?.data?.error || '未知錯誤'));
    }
  });

  $('#btn-logout').on('click', async function () {
    if (!confirm('確定要登出？')) return;
    $(this).prop('disabled', true);
    await send('logout');
    $(this).prop('disabled', false);
    allItems = [];
    activeGroup = '';
    $('#logged-area').hide();
    $('#content-area').hide();
    $('#login-area').show();
  });

  $('#btn-login').on('click', async function () {
    $(this).prop('disabled', true).text('登入中…');
    const res = await send('login');
    $(this).prop('disabled', false).html('<i class="fab fa-google me-1"></i>登入 Google');
    if (res?.data?.status === 'success') {
      $('#login-area').hide();
      loadList();
    } else {
      alert('登入失敗：' + (res?.data?.error || ''));
    }
  });

});
