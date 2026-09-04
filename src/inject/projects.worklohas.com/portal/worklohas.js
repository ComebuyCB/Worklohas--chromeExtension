class CustomWorklohasPortal {
	constructor() {
		this.observedNode = null
		this.debounceTimer = null
		this.settings = {}
		this.zpsDetailView = { minWidth: 480, maxWidth: 1920 }
		this.tabHeadersPanel = { minWidth: 100, maxWidth: 800 }

		this.init()
	}

	init() {
		this._bindEvents()
	}

	_bindEvents() {
		setInterval(() => this._poll(), 500)

		document.addEventListener('click', event => {
			const nav = document.getElementById('wl-quicklinks')
			if (nav && !nav.contains(event.target)) nav.classList.remove('is_active')
		})

		wlMessage({
			INIT: event => {
				this.settings = event.data.data.wl_portal_settings || {}
			}
		})
	}

	_savePortalSetting(key, value) {
		this.settings[key] = value
		window.postMessage({
			from: 'projects.worklohas.com/portal/worklohas',
			to: 'content.js',
			type: 'SAVE_PORTAL_SETTINGS',
			data: { wl_portal_settings: this.settings }
		}, '*')
	}

	_poll() {
		const frame = document.querySelector('#detail-rhs')
		if (frame) {
			this._buildScrollTopButton(frame)
			this._buildScrollBottomButton(frame)
			this._syncDetailMainHeaderHeight(frame)
		}

		const detailView = document.querySelector('#zpsDetailView')
		if (detailView) {
			this._buildResizeHandle(detailView, { handleId: 'wl-resize-handle', side: 'left', minWidth: this.zpsDetailView.minWidth, maxWidth: this.zpsDetailView.maxWidth, storageKey: 'zpsDetailViewWidth' })
			this._watchDetailView(detailView)
		}

		const tabHeadersPanel = document.querySelector('#tabheaders_panel')
		if (tabHeadersPanel) {
			this._buildResizeHandle(tabHeadersPanel, { handleId: 'wl-resize-handle-tabheaders', side: 'right', minWidth: this.tabHeadersPanel.minWidth, maxWidth: this.tabHeadersPanel.maxWidth, widthProperty: '--LHSWidth', widthPropertyEl: document.documentElement, storageKey: 'tabHeadersPanelWidth' })
		}
	}

	_syncDetailMainHeaderHeight(frame) {
		const mainHeader = frame.querySelector('.detail-main-header')
		if (!mainHeader) return

		document.documentElement.style.setProperty('--calc-detailMainHeaderHeight', `${mainHeader.getBoundingClientRect().height}px`)
	}

	_scrollToTarget(frame, el) {
		const headerHeight = frame.querySelector('.detail-main-header')?.getBoundingClientRect().height || 0
		const previousPosition = el.style.position

		el.style.position = 'static'
		const naturalTop = el.getBoundingClientRect().top - frame.getBoundingClientRect().top + frame.scrollTop
		el.style.position = previousPosition

		frame.scrollTo({ top: naturalTop - headerHeight, behavior: 'smooth' })
	}

	_watchDetailView(detailView) {
		if (detailView === this.observedNode) return

		this.observedNode = detailView
		new MutationObserver(() => {
			if (detailView.querySelector('#mainExtContainer')) this._onDetailViewChange()
		}).observe(detailView, { childList: true, subtree: true })
	}

	_onDetailViewChange() {
		clearTimeout(this.debounceTimer)
		this.debounceTimer = setTimeout(() => this._buildDetailQuickLinks(), 100)
	}

	_buildResizeHandle(target, { handleId, side, minWidth, maxWidth, widthProperty = 'max-width', widthPropertyEl = target, storageKey }) {
		if (document.getElementById(handleId)) return

		const storedWidth = storageKey && this.settings[storageKey]
		if (storedWidth) widthPropertyEl.style.setProperty(widthProperty, `${storedWidth}px`)

		const insertPosition = side === 'left' ? 'afterbegin' : 'beforeend'
		target.insertAdjacentHTML(insertPosition, `<div class="wl-resizeHandle wl-resizeHandle--${side}" id="${handleId}"></div>`)

		const handle = document.getElementById(handleId)

		handle.addEventListener('mousedown', event => {
			event.preventDefault()
			document.body.classList.add('is_resizing')

			let currentWidth = null

			const onMouseMove = moveEvent => {
				const width = side === 'left'
					? window.innerWidth - moveEvent.clientX
					: moveEvent.clientX - target.getBoundingClientRect().left
				currentWidth = Math.min(Math.max(width, minWidth), maxWidth)
				widthPropertyEl.style.setProperty(widthProperty, `${currentWidth}px`)
			}

			const onMouseUp = () => {
				document.body.classList.remove('is_resizing')
				document.removeEventListener('mousemove', onMouseMove)
				document.removeEventListener('mouseup', onMouseUp)

				if (storageKey && currentWidth !== null) this._savePortalSetting(storageKey, currentWidth)
			}

			document.addEventListener('mousemove', onMouseMove)
			document.addEventListener('mouseup', onMouseUp)
		})
	}

	_getDetailsGreyBarRight() {
		const wrapId = 'wl-detailsGreyBar-right'
		let wrap = document.getElementById(wrapId)
		if (!wrap) {
			wrap = document.createElement('div')
			wrap.id = wrapId
			wrap.className = 'wl-detailsGreyBar-right'
			document.querySelector('#detailsGreyBar').appendChild(wrap)
		}
		return wrap
	}

	_buildScrollTopButton(frame) {
		const scrollsId = 'wl-scrolls'
		if (document.getElementById(scrollsId)) return

		this._getDetailsGreyBarRight().insertAdjacentHTML('afterbegin', `
			<div id="${scrollsId}" class="wl-scrollBtnBox">
				<div class="wl-scrollBtn" id="wl-btn-top">
					<span class="_icon">↑</span>
					<span>至頂</span>
				</div>
			</div>
		`)

		const btnTop = document.getElementById('wl-btn-top')
		btnTop.addEventListener('click', () => frame.scrollTo({ top: 0 }))

		const updateVisibility = () => btnTop.classList.toggle('is-hidden', frame.scrollTop <= 0)
		frame.addEventListener('scroll', updateVisibility)
		updateVisibility()
	}

	_buildScrollBottomButton(frame) {
		const wrapId = 'wl-btn-bottom-fixed'
		const btnId = 'wl-btn-bottom-sticky'
		if (document.getElementById(wrapId)) return

		frame.insertAdjacentHTML('beforeend', `
			<div class="wl-footer-scrollBtn" id="${wrapId}">
				<div class="wl-footer-scrollBtn-abs">
					<div class="wl-scrollBtn" id="${btnId}">
						<span>至底</span>
						<span class="_icon">↓</span>
					</div>
				</div>
			</div>
		`)

		const btn = document.getElementById(btnId)
		btn.addEventListener('click', () => frame.scrollTo({ top: 999999 }))

		const updateVisibility = () => {
			const atBottom = frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1
			btn.classList.toggle('is-hidden', atBottom)
		}
		frame.addEventListener('scroll', updateVisibility)
		updateVisibility()
	}

	_buildDetailQuickLinks() {
		const frame = document.querySelector('#detail-rhs')
		if (!frame) return

		const titles = document.querySelectorAll('#zpsDetailView .module-content-area > .module-content-title')
		const links = []

		titles.forEach(title => {
			if (!title.id) return
			links.push({ id: title.id, text: title.textContent.trim() })
		})

		links.push({ id: 'detailTabMenu', text: '內容選單' })

		const navId = 'wl-quicklinks'
		const signature = links.map(item => item.id).join(',')
		const existingNav = document.getElementById(navId)

		if (existingNav && existingNav.dataset.signature === signature) return
		existingNav?.remove()
		if (!links.length) return

		const nav = document.createElement('nav')
		nav.id = navId
		nav.dataset.signature = signature

		const toggle = document.createElement('button')
		toggle.type = 'button'
		toggle.className = '_toggle'
		toggle.textContent = '☰'
		nav.appendChild(toggle)

		const menu = document.createElement('div')
		menu.className = '_menu'

		links.forEach(item => {
			const btn = document.createElement('button')
			btn.type = 'button'
			btn.dataset.targetId = item.id
			btn.textContent = item.text
			menu.appendChild(btn)
		})

		nav.appendChild(menu)

		toggle.addEventListener('click', () => nav.classList.toggle('is_active'))

		menu.addEventListener('click', event => {
			const btn = event.target.closest('button')
			if (!btn) return
			const el = document.getElementById(btn.dataset.targetId)
			if (el) this._scrollToTarget(frame, el)
		})

		const updateActiveLink = () => {
			const mainHeader = frame.querySelector('.detail-main-header')
			const frameTop = mainHeader ? mainHeader.getBoundingClientRect().bottom : frame.getBoundingClientRect().top
			let activeId = null

			links.forEach(item => {
				const el = document.getElementById(item.id)
				if (el && el.getBoundingClientRect().top - frameTop <= 8) activeId = item.id
			})

			menu.querySelectorAll('button').forEach(btn => {
				btn.classList.toggle('is_current', btn.dataset.targetId === activeId)
			})
		}

		if (frame._wlQuickLinksScrollHandler) frame.removeEventListener('scroll', frame._wlQuickLinksScrollHandler)
		frame.addEventListener('scroll', updateActiveLink)
		frame._wlQuickLinksScrollHandler = updateActiveLink

		updateActiveLink()

		this._getDetailsGreyBarRight().appendChild(nav)
	}
}

new CustomWorklohasPortal()
