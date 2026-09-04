const FROM = 'toggleInject/main.js';
const TO   = 'background.js';

function send(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ from: FROM, to: TO, type, data }, resolve);
  });
}

$(document).ready(() => {
  window.siteToggleManager = new SiteToggleManager();
});

function showToast(message = '設定已儲存') {
  $('#toast .toast-body').text(message);
  $('#toast').show();
  setTimeout(() => {
    $('#toast').hide();
  }, 1500);
}

// 網站開關管理器
class SiteToggleManager {
  constructor() {
    this.sites = [];
    this.siteToggles = {};
    this.loadSitesFromConfig();
  }

  loadSitesFromConfig() {
    // 從 sites.js 載入配置
    if (typeof inject_sites !== 'undefined') {
      Object.entries(inject_sites).forEach(([siteKey, siteConfig]) => {
        const toggleKey = siteConfig.toggleKey || siteKey;

        // 相同 toggleKey 只保留第一筆（共用開關去重）
        if (this.sites.some(s => s.toggleKey === toggleKey)) return;

        // 從第一個 path url 取得主網域，供 favicon fallback 使用
        const firstUrl = siteConfig.paths?.[0]?.url || '';
        const primaryHost = firstUrl.split('/')[0].replace(/^\*\./, '');

        const info = siteConfig.info || {};

        this.sites.push({
          siteKey,
          toggleKey,
          title: info.title,
          description: info.description,
          quickLink: info.quickLink || null,
          favicon: info.favicon,
          group: info.group,
          primaryHost,
        });
      });
    }
    this.init();
  }

  async init() {
    await this.loadToggles();
    this.renderToggles();
    this.bindEvents();
  }

  loadToggles() {
    // 舊版 toggleKey → 新版 toggleKey 對照表（key 重命名後的 storage migration）
    const KEY_MIGRATION = {
      "cloud.nueip.com":        "nueip",
      "projects.worklohas.com": "worklohas-portal",
      "rent.591.com.tw":        "591",
    };

    return new Promise((resolve) => {
      chrome.storage.local.get(['siteToggles'], (result) => {
        if (result.siteToggles) {
          this.siteToggles = result.siteToggles;

          // 將舊 key 搬移至新 key（只搬一次，搬後刪除舊 key）
          let needsSave = false;
          Object.entries(KEY_MIGRATION).forEach(([oldKey, newKey]) => {
            if (oldKey in this.siteToggles && !(newKey in this.siteToggles)) {
              this.siteToggles[newKey] = this.siteToggles[oldKey];
              delete this.siteToggles[oldKey];
              needsSave = true;
            }
          });
          if (needsSave) chrome.storage.local.set({ siteToggles: this.siteToggles });
        } else {
          this.sites.forEach(site => { // 預設全部啟用
            this.siteToggles[site.toggleKey] = true;
          });
        }
        resolve();
      });
    });
  }

  saveToggles() {
    chrome.storage.local.set({ siteToggles: this.siteToggles }, () => {
      showToast('網站開關已更新');
    });
  }

  renderToggles() {
    const container = $('#siteTogglesContainer');
    container.empty();

    // 依 group 分桶：未分組維持原順序排最前面，同 group 的項目一律歸在一起
    const ungrouped = [];
    const groupedMap = new Map(); // group 名稱 → 該群組的 site 陣列，key 依第一次出現順序排列

    this.sites.forEach(site => {
      if (!site.group) {
        ungrouped.push(site);
        return;
      }
      if (!groupedMap.has(site.group)) groupedMap.set(site.group, []);
      groupedMap.get(site.group).push(site);
    });

    const orderedSites = [...ungrouped];
    groupedMap.forEach((groupSites, groupName) => {
      orderedSites.push({ isGroupHeader: true, group: groupName });
      orderedSites.push(...groupSites);
    });

    orderedSites.forEach(site => {
      if (site.isGroupHeader) {
        container.append(`<div class="d-flex align-items-center gap-2 mt-1"><hr class="flex-grow-1 my-0"><span class="text-muted flex-shrink-0 site-group-label">${site.group}</span><hr class="flex-grow-1 my-0"></div>`);
        return;
      }

      const isEnabled = this.siteToggles[site.toggleKey] !== false;
      const faviconUrl = site.favicon ? site.favicon : `https://${site.primaryHost}/favicon.ico`;
      const nameHtml = site.quickLink
        ? `<a class="site-info-name" href="${site.quickLink}" target="_blank" rel="noopener noreferrer" title="${site.title}">${site.title}</a>`
        : `<span class="site-info-name" title="${site.title}">${site.title}</span>`;

      const toggleHtml = `
        <div class="site-item" data-toggle-key="${site.toggleKey}">
          <img class="site-item--img" alt="">
          <i class="fas fa-globe site-item--img" style="display: none;"></i>
          <div class="site-item--info">
            ${nameHtml}
            ${site.description ? `<div class="site-info-desc" title="${site.description}">${site.description}</div>` : ''}
          </div>
          <div class="site-item--toggle">
            <div class="form-check form-switch m-0">
              <input class="form-check-input site-toggle" type="checkbox" ${isEnabled ? 'checked' : ''}>
            </div>
          </div>
        </div>
      `;
      const $item = $(toggleHtml);
      container.append($item);
      this.loadFavicon($item.find('img.site-item--img'), faviconUrl);
    });
  }

  // 一律請 background.js 代抓 favicon 轉成 base64 再顯示，不直接用 <img src>
  // 打對方網域，是因為有些網站（例如 nueip）的 favicon.ico 帶了
  // Cross-Origin-Resource-Policy: same-site，直接跨網域載入會被瀏覽器擋掉
  async loadFavicon($img, faviconUrl) {
    const res = await send('getFavicon', { url: faviconUrl });
    if (res?.data?.dataUrl) {
      $img.attr('src', res.data.dataUrl);
    } else {
      $img.hide();
      $img.next().show();
    }
  }

  bindEvents() {
    $(document).on('change', '.site-toggle', (e) => {
      const toggleKey = $(e.currentTarget).closest('[data-toggle-key]').data('toggleKey');
      const isEnabled = $(e.currentTarget).prop('checked');
      this.siteToggles[toggleKey] = isEnabled;
      this.saveToggles();
    });
  }
}
