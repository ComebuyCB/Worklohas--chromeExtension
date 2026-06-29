/*=== worklohas.com 帳密管理 ===*/

const SVG_EYE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const SVG_EYE_SLASH = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`

class PasswordManager {
  constructor() {
    const def = {
      accountSelectors: 'input[name="account"], input[name="acc"], input[name="email"], input[name="username"], input[name="user"], input[type="email"]',
      passwordSelectors: 'input[name="pwd"], input[name="password"], input[type="password"]',
    }

    Object.assign(this, def)

    this.site          = window.location.hostname
    this.panel         = null
    this.loadingEl     = null
    this.emptyEl       = null
    this.noauthEl      = null
    this.listEl        = null
    this.accountInput  = null
    this.passwordInput = null
    this.form          = null

    this.init()
  }

  async init() {
    this._checkPendingSave()
    if (!this._detect()) return
    this._injectPanel()
    await this._initState()
    this._bindEvents()
    this._loadCredentials()
  }

  async _initState() {
    const state = await this._send('pm_get_state', {})
    if (state?.collapsed) this._toggleCollapse()
  }

  _bindEvents() {
    this.panel.addEventListener('click', e => {
      if (e.target.closest('.js-wl-pm-toggle')) this._toggleCollapse()

      const fillBtn = e.target.closest('.js-wl-pm-fill')
      if (fillBtn) this._fill(fillBtn.dataset.account, fillBtn.dataset.password)

      const delBtn = e.target.closest('.js-wl-pm-del')
      if (delBtn) this._delete(parseInt(delBtn.dataset.row))

      const eyeBtn = e.target.closest('.js-wl-pm-eye')
      if (eyeBtn) this._togglePwd(eyeBtn)
    })

    if (this.form) {
      this.form.addEventListener('submit', () => this._capturePending())
    } else {
      document.addEventListener('click', e => {
        if (e.target.matches('button[type="submit"], input[type="submit"]')) this._capturePending()
      })
    }
  }

  _checkPendingSave() {
    const raw = sessionStorage.getItem('__wl_pm_pending__')
    if (!raw) return
    sessionStorage.removeItem('__wl_pm_pending__')
    try {
      const { site, account, password } = JSON.parse(raw)
      window.postMessage({ from: 'password-manager.js', to: 'content.js', type: 'pm_add', requestId: null, data: { site, account, password } }, '*')
    } catch (_) {}
  }

  _detect() {
    this.accountInput  = document.querySelector(this.accountSelectors)
    this.passwordInput = document.querySelector(this.passwordSelectors)
    if (!this.accountInput || !this.passwordInput) return false
    this.form = this.accountInput.closest('form')
    return true
  }

  _injectPanel() {
    const wrap = document.createElement('div')
    wrap.innerHTML = `
      <div class="wlPm" id="js-wl-pm">
        <div class="wlPm--head">
          <span>🔐 帳密管理</span>
          <button class="wlPm_collapseBtn js-wl-pm-toggle" type="button">−</button>
        </div>
        <div class="wlPm--body js-wl-pm-body">
          <div class="wlPm_loading js-wl-pm-loading">載入中…</div>
          <div class="wlPm_empty js-wl-pm-empty" style="display:none"></div>
          <div class="wlPm_noauth js-wl-pm-noauth" style="display:none"></div>
          <ul class="wlPm_list js-wl-pm-list" style="display:none"></ul>
        </div>
      </div>
    `
    document.body.appendChild(wrap.firstElementChild)

    this.panel     = document.getElementById('js-wl-pm')
    this.loadingEl = this.panel.querySelector('.js-wl-pm-loading')
    this.emptyEl   = this.panel.querySelector('.js-wl-pm-empty')
    this.noauthEl  = this.panel.querySelector('.js-wl-pm-noauth')
    this.listEl    = this.panel.querySelector('.js-wl-pm-list')
    this._initDrag()
  }

  _initDrag() {
    const head = this.panel.querySelector('.wlPm--head')
    let startX, startY, startLeft, startTop

    const onMove = (e) => {
      this.panel.style.left = (startLeft + e.clientX - startX) + 'px'
      this.panel.style.top  = (startTop  + e.clientY - startY) + 'px'
    }

    const onUp = () => {
      this.panel.classList.remove('is-dragging')
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    head.addEventListener('mousedown', (e) => {
      if (e.target.closest('.js-wl-pm-toggle')) return
      const rect = this.panel.getBoundingClientRect()
      startX    = e.clientX
      startY    = e.clientY
      startLeft = rect.left
      startTop  = rect.top
      // 第一次拖曳時從 bottom 定位轉為 top 定位，避免位置跳動
      this.panel.style.bottom = 'auto'
      this.panel.style.left   = startLeft + 'px'
      this.panel.style.top    = startTop  + 'px'
      this.panel.classList.add('is-dragging')
      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })
  }

  _capturePending() {
    const account  = this.accountInput.value
    const password = this.passwordInput.value
    if (!account || !password) return
    sessionStorage.setItem('__wl_pm_pending__', JSON.stringify({ site: this.site, account, password }))
  }

  _fill(account, password) {
    const setVal = (input, val) => {
      input.value = val
      input.dispatchEvent(new Event('input',  { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
    document.querySelectorAll(this.accountSelectors).forEach(el => setVal(el, account))
    document.querySelectorAll(this.passwordSelectors).forEach(el => setVal(el, password))
  }

  async _delete(row) {
    if (!confirm('確定刪除這筆帳密？')) return
    const res = await this._send('pm_delete', { row })
    if (res?.status === 'success') {
      this._loadCredentials()
    } else {
      alert('刪除失敗')
    }
  }

  async _loadCredentials() {
    this.loadingEl.style.display = ''
    this.emptyEl.style.display   = 'none'
    this.noauthEl.style.display  = 'none'
    this.listEl.style.display    = 'none'

    const res = await this._send('pm_list', {})
    this.loadingEl.style.display = 'none'

    if (!res || res.status === 'error') {
      this.noauthEl.textContent   = '請先在擴充功能中登入 Google'
      this.noauthEl.style.display = ''
      return
    }

    const items = (res.items || []).filter(i => i.site === this.site)
    if (!items.length) {
      this.emptyEl.textContent   = '尚無儲存的帳密'
      this.emptyEl.style.display = ''
      return
    }

    const fmtTs = iso => {
      if (!iso) return ''
      const d = new Date(iso)
      return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
    // 找每個帳號最後一次登入的時間戳（用於高亮）
    const latestTs = {}
    items.forEach(i => {
      if (!latestTs[i.account] || i.timestamp > latestTs[i.account]) latestTs[i.account] = i.timestamp
    })

    this.listEl.innerHTML = ''
    items.forEach(item => {
      const isLatest = item.timestamp && item.timestamp === latestTs[item.account]

      const delBtn = document.createElement('button')
      delBtn.className    = 'wlPm_delBtn js-wl-pm-del'
      delBtn.type         = 'button'
      delBtn.textContent  = '×'
      delBtn.dataset.row  = item.row

      const accName = document.createElement('span')
      accName.className   = 'wlPm_accName'
      accName.textContent = item.account

      const ts = document.createElement('span')
      ts.className   = 'wlPm_ts'
      ts.textContent = fmtTs(item.timestamp)

      const acc = document.createElement('span')
      acc.className = 'wlPm_item--acc'
      acc.append(accName, ts)

      const pwdText = document.createElement('span')
      pwdText.className   = 'wlPm_pwdText'
      pwdText.textContent = '••••••••'

      const eyeBtn = document.createElement('button')
      eyeBtn.className        = 'wlPm_eyeBtn js-wl-pm-eye'
      eyeBtn.type             = 'button'
      eyeBtn.dataset.password = item.password
      eyeBtn.dataset.visible  = 'false'
      eyeBtn.innerHTML        = SVG_EYE

      const fillBtn = document.createElement('button')
      fillBtn.className          = 'wlPm_btn js-wl-pm-fill'
      fillBtn.type               = 'button'
      fillBtn.textContent        = '填入→'
      fillBtn.dataset.account    = item.account
      fillBtn.dataset.password   = item.password

      const li = document.createElement('li')
      li.className = 'wlPm_item' + (isLatest ? ' wlPm_item--latest' : '')
      li.append(delBtn, acc, pwdText, eyeBtn, fillBtn)
      this.listEl.appendChild(li)
    })
    this.listEl.style.display = ''
  }

  _togglePwd(btn) {
    const pwdText  = btn.closest('.wlPm_item').querySelector('.wlPm_pwdText')
    const isVisible = btn.dataset.visible === 'true'
    pwdText.textContent = isVisible ? '••••••••' : btn.dataset.password
    btn.innerHTML       = isVisible ? SVG_EYE : SVG_EYE_SLASH
    btn.dataset.visible = isVisible ? 'false' : 'true'
  }

  _toggleCollapse() {
    const body = this.panel.querySelector('.js-wl-pm-body')
    const btn  = this.panel.querySelector('.js-wl-pm-toggle')
    const isHidden = body.style.display === 'none'
    body.style.display = isHidden ? '' : 'none'
    btn.textContent    = isHidden ? '−' : '+'
    this.panel.classList.toggle('is-collapsed', !isHidden)
    window.postMessage({ from: 'password-manager.js', to: 'content.js', type: 'pm_save_state', requestId: null, data: { collapsed: !isHidden } }, '*')
  }

  _send(type, data = {}) {
    return new Promise(resolve => {
      const requestId = `${Date.now()}_${Math.random()}`
      let settled = false

      const done = (val) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        window.removeEventListener('message', handler)
        resolve(val)
      }

      const timer = setTimeout(() => done(null), 10000)

      const handler = (event) => {
        const msg = event.data
        if (!msg?.from || msg.from !== 'content.js' || msg.to !== 'password-manager.js' || msg.requestId !== requestId) return
        done(msg.data)
      }
      window.addEventListener('message', handler)

      window.postMessage({ from: 'password-manager.js', to: 'content.js', type, requestId, data }, '*')
    })
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PasswordManager())
} else {
  new PasswordManager()
}
