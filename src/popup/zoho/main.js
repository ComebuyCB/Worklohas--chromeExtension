const FROM = 'popup/zoho/main.js';
const TO = 'background.js';
const DRAFT_KEY = 'wl_report_draft'; // 與 screenshot.js 相同
const COMMAND_NAME = 'open-screenshot-editor'; // 與 manifest.json 的 commands 相同
const SHORTCUTS_URL = 'chrome://extensions/shortcuts';

$(function () {
  new ZohoPanel();
});

class ZohoPanel {
  constructor() {
    this.$btnAnnotate = $('.js-btn-annotate');
    this.$msg = $('.js-msg');
    this.$draft = $('.js-draft');
    this.$annotateLabel = $('.js-annotate-label');
    this.$shortcut = $('.js-shortcut');
    this.init();
  }

  init() {
    this.bindEvents();
    this._renderDraft();
    this._renderShortcut();
  }

  bindEvents() {
    this.$btnAnnotate.on('click', () => this._annotate());
    // Chrome 不開放擴充功能直接修改快捷鍵，只能開啟官方設定頁
    $('.js-btn-shortcut').on('click', () => chrome.tabs.create({ url: SHORTCUTS_URL }));
  }

  // 已有圖片時顯示張數，按鈕也改成繼續標註
  async _renderDraft() {
    const stored = await chrome.storage.local.get(DRAFT_KEY);
    const shots = stored[DRAFT_KEY]?.shots || [];
    if (!shots.length) return;

    this.$draft.text(`(${shots.length}張圖)`);
    this.$annotateLabel.text('繼續標註');
  }

  // 顯示實際生效的快捷鍵；和其他擴充功能衝突時 Chrome 不會指派，這裡會是空的
  async _renderShortcut() {
    const commands = await chrome.commands.getAll();
    const shortcut = commands.find(command => command.name === COMMAND_NAME)?.shortcut;
    this.$shortcut.text(shortcut ? `(${shortcut})` : '(未設定快捷鍵)');
  }

  async _annotate() {
    this.$btnAnnotate.prop('disabled', true);
    this.$msg.text('');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.runtime.sendMessage({ from: FROM, to: TO, type: 'openScreenshotEditor', data: { tabId: tab.id } });

    if (response?.data?.status === 'success') {
      // 此頁在 popup 的 iframe 內，要關閉的是外層 popup
      window.parent.close();
      return;
    }
    console.error('[popup/zoho]', response?.data?.error);
    this.$msg.text('此頁面無法截圖（瀏覽器內建頁或商店頁）');
    this.$btnAnnotate.prop('disabled', false);
  }
}
