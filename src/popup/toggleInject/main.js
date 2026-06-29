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
      Object.keys(inject_sites).forEach(hostname => {
        const siteConfig = inject_sites[hostname];
        const toggleKey = siteConfig.toggleKey || hostname;

        // 相同 toggleKey 只保留第一筆（共用開關去重）
        if (this.sites.some(s => s.toggleKey === toggleKey)) return;

        this.sites.push({
          hostname,
          toggleKey,
          quickLink: siteConfig.quickLink || null,
          description: siteConfig.description,
          favicon: siteConfig.favicon,
          group: siteConfig.group,
        });
      });
    }
    this.init();
  }

  getFaviconUrl(hostname) {
    return `https://${hostname}/favicon.ico`;
  }

  async init() {
    await this.loadToggles();
    this.renderToggles();
    this.bindEvents();
  }

  loadToggles() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['siteToggles'], (result) => {
        if (result.siteToggles) {
          this.siteToggles = result.siteToggles;
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

    let currentGroup = undefined;

    this.sites.forEach(site => {
      if (site.group !== currentGroup) {
        if (currentGroup !== undefined && site.group) {
          container.append(`<div class="d-flex align-items-center gap-2 mt-1"><hr class="flex-grow-1 my-0"><span class="text-muted flex-shrink-0 site-group-label">${site.group}</span><hr class="flex-grow-1 my-0"></div>`);
        }
        currentGroup = site.group;
      }

      const isEnabled = this.siteToggles[site.toggleKey] !== false;
      const faviconUrl = site.favicon ? site.favicon : this.getFaviconUrl(site.hostname);
      const nameHtml = site.quickLink
        ? `<a class="site-info-name" href="${site.quickLink}" target="_blank" rel="noopener noreferrer" title="${site.hostname}">${site.hostname}</a>`
        : `<span class="site-info-name" title="${site.hostname}">${site.hostname}</span>`;

      const toggleHtml = `
        <div class="site-item" data-toggle-key="${site.toggleKey}">
          <img class="site-item--img" src="${faviconUrl}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';">
          <i class="fas fa-globe site-item--img" style="display: none;"></i>
          <div class="site-item--info">
            ${nameHtml}
            <div class="site-info-desc" title="${site.description}">${site.description}</div>
          </div>
          <div class="site-item--toggle">
            <div class="form-check form-switch m-0">
              <input class="form-check-input site-toggle" type="checkbox" ${isEnabled ? 'checked' : ''}>
            </div>
          </div>
        </div>
      `;
      container.append(toggleHtml);
    });
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
