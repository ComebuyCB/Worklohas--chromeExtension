/*=== 截圖標註：由 popup/zoho 以 chrome.scripting 注入 isolated world，可在任何網站使用 ===*/
(() => {
	// 重複點擊時此檔會再次執行，已載入就不重複定義
	if (window.wlScreenshot) return

	const MIN_BOX_SIZE = 8 // 拖曳小於此 px 視為誤觸
	const MIN_SHOT_SIZE = 100 // 藍框寬高都要至少此 px 才截圖；調整藍框大小也不能小於此
	const STATUS_TOO_SMALL = `範圍太小，至少 ${MIN_SHOT_SIZE} × ${MIN_SHOT_SIZE}`
	const MIN_LINE_LENGTH = 4 // 直線短於此 px 視為誤觸
	const SAVE_DELAY = 300 // 打字時延遲儲存的毫秒數
	const SYNC_DELAY = 500 // 畫圖或調整藍框後，延遲更新右側欄圖片的毫秒數，避免太常重繪
	const DOUBLE_CLICK_DELAY = 300 // 空白處左鍵連按兩下的間隔
	const LONG_PRESS_DELAY = 300 // 一般模式按住右鍵多久進入截圖模式
	const LONG_PRESS_TOLERANCE = 6 // 按住右鍵時滑鼠移動超過此 px 就不算長按（可能是滑鼠手勢）
	const SCROLL_KEYS = [' ', 'PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'] // 截圖模式不讓這些按鍵捲動網頁
	const HELP_GAP = 8 // 操作說明和工具列的距離，要等於 CSS
	const SNAPSHOT_DELAY = 2500 // 複製或下載圖片後，快照提示顯示的毫秒數
	const PANEL_WIDTH = 400 // 右側欄預設寬度
	const PANEL_MIN_WIDTH = 280 // 拖曳左邊界調整寬度的下限
	const PANEL_MAX_WIDTH = 900 // 上限；另外至少留 PANEL_PAGE_GAP 給網頁
	const PANEL_PAGE_GAP = 80
	const CARD_FADE_DELAY = 200 // 刪除卡片時淡出的毫秒數，要等於 CSS .screenshot_image.is_removing 的 transition
	const HINT_DELAY = 3500 // 從 popup 開啟時的提示：顯示 3 秒後淡出，要等於 CSS 動畫長度
	const HINT_TEXT = '長按右鍵開始截圖'
	const TOOLS_WIDTH = 32 // 複製、下載按鈕的寬度；框靠近視窗右緣時改放框內
	const REMOVE_OFFSET = 13 // × 超出框線的距離；框貼齊視窗邊緣時改放框內
	const CONTROL_MARGIN = 9 // 畫的內容貼齊視窗邊緣時，控制點離邊緣的距離，才按得到
	const DRAW_BAR_WIDTH = 240 // 畫圖工具列的寬高，框下方或右方放不下時調整位置，要等於 CSS（6 顆 32px 按鈕 + 48px 粗細）
	const DRAW_BAR_HEIGHT = 38
	const COLOR_MARK = '#e11d2e'
	const COLOR_DIM = 'rgba(15, 23, 42, .45)' // 截圖模式、放大時凍結底圖上的半透明黑底
	const GALLERY_SCROLL_STEP = 80 // 放大整頁截圖時，方向鍵每次捲動的距離
	const LINE_WIDTH = 3 // 線條預設粗細
	const MIN_LINE_WIDTH = 1
	const MAX_LINE_WIDTH = 20
	const ARROW_SIZE_RATIO = 4 // 箭頭三角形的長度 = 線條粗細 × 此倍數
	const ARROW_MIN_SIZE = 12 // 線條很細時箭頭仍要看得出來
	const ARROW_ANGLE = Math.PI / 7 // 箭頭兩側和線的夾角
	const HIT_TOLERANCE = 6 // 按在線條附近多少 px 內算按到，線條細的時候才點得到
	const TEXT_FRAME_INSET = 3 // 文字框往內多少 px 算按到虛框；要小於 TEXT_PADDING，才點得到第一個字
	// 文字一律粗體；字級 24px 以下每次跳 2px，以上每次跳 4px
	const TEXT_SIZE = 16
	const MIN_TEXT_SIZE = 12
	const MAX_TEXT_SIZE = 64
	const TEXT_SIZE_BREAK = 24
	const TEXT_LINE_RATIO = 1.375
	const TEXT_PADDING = 4 // 要等於 CSS 的 .screenshot_item > ._text
	const WHEEL_STEP = 40 // 累積到這個滾動量才跳一階，觸控板的滾動量很小，不能每次事件都跳
	const MIN_TEXT_WIDTH = 40
	const MIN_TEXT_HEIGHT = 30
	const FONT_FAMILY = 'system-ui, "Microsoft JhengHei", "PingFang TC", sans-serif'
	const STATUS_CAPTURE_FAILED = '截圖失敗，請再試一次'
	const STATUS_IDLE = '' // 一般模式不顯示狀態文字
	const STATUS_CAPTURE = '截圖中'
	// 草稿分開存：文字資料常常更新，圖片很大且只寫一次（popup/zoho/main.js 也讀 DRAFT_KEY）
	const DRAFT_KEY = 'wl_report_draft'
	const IMAGE_KEY_PREFIX = 'wl_report_image_'

	// 網站沒有載入 icon 字型，Shadow DOM 內直接用 SVG
	const SVG_ATTRS = 'viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
	const ICON_COPY = `<svg ${SVG_ATTRS}><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>`
	const ICON_DOWNLOAD = `<svg ${SVG_ATTRS}><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>`
	const ICON_EYE = `<svg ${SVG_ATTRS}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`
	const ICON_TRASH =`<svg ${SVG_ATTRS}><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>`
	const ICON_PEN = `<svg ${SVG_ATTRS}><path d="M3 17c3-6 5-9 7-8s-1 6 1 7 5-6 10-10"/></svg>`
	const ICON_LINE = `<svg ${SVG_ATTRS}><path d="M5 19L19 5"/></svg>`
	const ICON_ARROW = `<svg ${SVG_ATTRS}><path d="M5 19L19 5M10 5h9v9"/></svg>`
	const ICON_RECT = `<svg ${SVG_ATTRS}><rect x="4" y="6" width="16" height="12"/></svg>`
	const ICON_TEXT = `<svg ${SVG_ATTRS}><path d="M5 7V5h14v2M12 5v14M9 19h6"/></svg>`
	// 工具列的圖示，尺寸由 CSS 放大
	const ICON_CLOSE =`<svg ${SVG_ATTRS}><path d="M6 6l12 12M18 6L6 18"/></svg>`
	const ICON_CROP = `<svg ${SVG_ATTRS}><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>`
	// 截圖清單的開關：方框右側一條側欄、箭頭朝右；展開、收合用同一個圖示，像開關一樣切換
	const ICON_PANEL = `<svg ${SVG_ATTRS}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18M8 9l3 3-3 3"/></svg>`
	const ICON_COLS_1 = `<svg ${SVG_ATTRS}><rect x="4" y="4" width="16" height="16" rx="2"/></svg>`
	const ICON_COLS_2 = `<svg ${SVG_ATTRS}><rect x="3" y="6" width="8" height="12" rx="1.5"/><rect x="13" y="6" width="8" height="12" rx="1.5"/></svg>`
	const ICON_HELP = `<svg ${SVG_ATTRS}><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`
	const DRAW_TOOLS = `
		<span class="screenshot_draw">
			<button class="_tool js-draw-tool" type="button" data-tool="pen" title="自由劃線" aria-label="自由劃線">${ICON_PEN}</button>
			<button class="_tool js-draw-tool" type="button" data-tool="line" title="直線" aria-label="直線">${ICON_LINE}</button>
			<button class="_tool js-draw-tool" type="button" data-tool="arrow" title="箭頭" aria-label="箭頭">${ICON_ARROW}</button>
			<button class="_tool js-draw-tool" type="button" data-tool="rect" title="方框" aria-label="方框">${ICON_RECT}</button>
			<button class="_tool js-draw-tool" type="button" data-tool="text" title="文字" aria-label="文字">${ICON_TEXT}</button>
			<span class="_size js-draw-size" title="滾輪調整"></span>
			<button class="_tool js-draw-help-toggle" type="button" title="編輯說明" aria-label="編輯說明" aria-expanded="false">${ICON_HELP}</button>
		</span>
	`
	const SHOT_TOOLS = `
		<span class="screenshot_tools">
			<button class="_tool js-shot-copy" type="button" title="複製圖片" aria-label="複製圖片">${ICON_COPY}</button>
			<button class="_tool js-shot-download" type="button" title="下載圖片" aria-label="下載圖片">${ICON_DOWNLOAD}</button>
		</span>
	`

	const log = console.log.bind(console, '%c[截圖標註]%c', `color:${COLOR_MARK};font-weight:bold`, '')

	class ScreenshotEditor {
		constructor(options) {
			const def = {
				cssText: '',
				shortcut: '', // 目前的快捷鍵文字，content script 無法讀取 chrome.commands，由 background.js 傳入
				isResume: false, // 同一分頁換頁後接回，右側欄維持換頁前的狀態
				isHint: false, // 從 popup 開啟：不進入截圖模式，只提示長按右鍵
				onClose: null,
			}

			Object.keys(def).forEach(k => {
				if (options?.[k] !== undefined) def[k] = options[k]
			})

			Object.assign(this, def)

			this.editorId = `${Date.now()}-${Math.random()}` // 辨識草稿目前由哪個分頁編輯
			this.shots = [] // 每個頁面、捲動位置一張圖：{ id, bitmap, url, scale, scrollX, scrollY, crop, items: [] ... }
			this.screen = null // 截圖模式的凍結畫面：進入時截一次，這次框的藍框都從這張圖裁切；離開時清空
			this.backdropSource = null // 目前畫在底圖上的是哪一張（凍結畫面或放大中的圖），相同就不重畫
			this.focusedShot = null // focus 中的藍框所屬的圖：左鍵只在這個藍框內畫圖
			this.galleryIndex = 0 // 放大瀏覽中的第幾張
			this.frozenShot = null // 放大中的圖：用它的截圖當底圖，同一張截圖上的藍框都一起顯示
			this.isGalleryFromIdle = false // 從一般模式放大的，關閉時要回到一般模式
			this.galleryScrollY = 0 // 放大整頁截圖時往下捲的距離（圖比畫面高）
			this.panelTab = 'block' // 截圖清單目前的分頁：block 區塊、page 整頁
			this.lineWidth = LINE_WIDTH // 下一筆線條的粗細
			this.panelWidth = PANEL_WIDTH // 右側欄寬度，拖曳左邊界調整
			this.panelCols = 2 // 截圖清單一排幾張：1 是一排一張（16:9），2 是一排多張（1:1，CSS 依寬度增加欄數）
			this.textSize = TEXT_SIZE // 下一個文字框的字級
			this.wheelDelta = 0 // 累積的滾動量
			this.activeTool = 'line' // 目前的畫圖工具：pen、line、arrow、rect、text；預設直線
			this.isCapture = false // 截圖模式才能框選；一般模式網頁可正常操作
			this.shouldOpenPanel = false // 接回時，換頁前右側欄是展開的
			this.nextItemId = 1
			this.nextShotId = 1
			this.nextZ = 1 // 遞增的 z-index，最後操作的藍框在最上層
			this.dragStart = null
			this.moving = null // 按住點點移動或調整大小中的藍框
			this.drawing = null // 畫到一半的內容：{ shot, item, anchor }
			this.adjusting = null // 調整中的直線、方框、文字：{ shot, item, part, x, y, origin, hasMoved }
			this.editingItem = null // 輸入中的文字框
			this.selectedItem = null // 選取中的直線或方框：滾輪立刻改它的粗細
			this.isRendering = false // 重繪移除文字框時會觸發失焦，這時不處理
			this.inks = new Map() // 每張圖在畫面上的畫布
			this.lastBlankClick = 0 // 上次在空白處左鍵單擊的時間，用來判斷雙擊
			this.lastMiddleClick = 0 // 上次在空白處中鍵單擊的時間，雙擊截整頁
			this.scrollLock = null // 截圖模式鎖住的捲動位置：{ x, y }
			this.toolbarDrag = null // 拖曳工具列時，游標與工具列左上角的距離
			this.toolbarPos = null // 展開右側欄前拖曳到的位置 { left, top }，收合時放回去；沒拖曳過是 null
			this.lastPointer = null
			this.isBusy = true // 截圖或還原草稿時不接受框選
			this.isClearPending = false
			this.snapshotTimer = null
			this.statusTimer = null
			this.countdown = null // 一般模式按數字鍵的倒數：{ remain, timer }，倒數完凍結畫面進入截圖/編輯模式
			this.saveTimer = null
			this.clearTimer = null
			this.syncTimer = null
			this.pendingShots = new Set() // 畫過或調整過、等待更新圖片的截圖
			this.redoStacks = new Map() // 每個藍框被復原拿掉的內容，Ctrl+Y 依序放回；只存在記憶體，不存進草稿

			this.init()
		}

		async init() {
			this._build()
			this.bindEvents()
			await this._restoreDraft()
			this.isBusy = false
			// 快捷鍵開啟時直接進入截圖模式（凍結畫面）；換頁接回時維持一般模式，不擋住使用者正在操作的網頁
			// 從 popup 開啟時也維持一般模式，提示長按右鍵開始截圖
			if (this.isResume) {
				this._renderMarks()
			} else if (this.isHint) {
				this._renderMarks()
				this.showHint()
			} else {
				await this.toggleCapture()
			}
			if (this.shouldOpenPanel) this._openPanel()
			await this._saveDraft() // 接手草稿，其他分頁開著的標註畫面會自動關閉
			log('開啟標註模式', { 網址: location.href, 視窗: `${window.innerWidth} × ${window.innerHeight}`, 草稿: this._summary() })
		}

		bindEvents() {
			this.$stage.on('pointerdown', e => this._onPointerDown(e))
			this.$stage.on('pointermove', e => this._onPointerMove(e))
			this.$stage.on('pointerup pointercancel', e => this._onPointerUp(e))
			this.$stage.on('pointerleave', () => this._hideBrush())
			this.$panelResize.on('pointerdown', e => this._startPanelResize(e))
			this.$panelCols.on('click', () => this._setPanelCols(this.panelCols === 2 ? 1 : 2))
			// 只有標題列能拖曳
			this.$toolbarHead.on('pointerdown', e => this._onToolbarDown(e))
			this.$toolbarHead.on('pointermove', e => this._onToolbarMove(e))
			this.$toolbarHead.on('pointerup pointercancel', () => this._onToolbarUp())
			window.addEventListener('resize', this._onResize)
			// 網頁在遮罩底下收不到滾輪，由此轉給實際可捲動的元素；jQuery 無法設定 passive: false
			this.$stage[0].addEventListener('wheel', this._onWheel, { passive: false })
			window.addEventListener('scroll', this._onScroll, true)
			window.addEventListener('pagehide', this._flushSave)
			// 一般模式點網頁其他地方時，收起右側欄點選顯示的標記
			document.addEventListener('pointerdown', this._onPagePointerDown, true)
			window.addEventListener('contextmenu', this._onPageContextMenu, true)
			window.addEventListener('pointerdown', this._onLongPressStart, true)
			window.addEventListener('pointermove', this._onLongPressMove, true)
			window.addEventListener('pointerup', this._cancelLongPress, true)
			window.addEventListener('blur', this._cancelLongPress)
			// Esc 掛在 window，一般模式焦點在網頁上時也收得到
			window.addEventListener('keydown', this._onWindowKeydown, true)
			chrome.storage.onChanged.addListener(this._onStorageChanged)

			// × 會隨重繪消失，焦點要拉回工具，之後的 Ctrl+Z 才收得到
			this.$marks.on('click', '.js-crop-remove', e => {
				this._removeShot($(e.currentTarget).closest('.js-shot').data('shot').id)
				this._focusEditor()
			})
			this.$marks.on('click', '.js-item-remove', e => {
				this._removeItem($(e.currentTarget).closest('.js-shot').data('shot'), $(e.currentTarget).closest('.js-item').data('id'))
				this._focusEditor()
			})
			this.$marks.on('click', '.js-draw-tool', e => this._setTool(e.currentTarget.dataset.tool))
			this.$marks.on('click', '.js-draw-help-toggle', e => this._toggleDrawHelp(e.currentTarget))
			this.$marks.on('input', '.js-item-text', e => this._onTextInput(e))
			// jQuery 的 focusout 是掛在 document 上模擬的，進不了 Shadow DOM，要用原生事件
			this.$marks[0].addEventListener('focusout', this._onTextBlur)

			// 舞台蓋著凍結的截圖，不顯示瀏覽器選單，避免以為是在操作網頁；右側欄、工具列保留瀏覽器選單（可在縮圖上複製、另存圖片）
			this.$stage.on('contextmenu', e => this._onContextMenu(e))
			// 中鍵按下預設會進入自動捲動，舞台上不需要
			this.$stage.on('mousedown', e => { if (e.button === 1) e.preventDefault() })

			this.$editor.on('click', '.js-help-toggle', () => this._toggleHelp())
			this.$editor.on('click', '.js-gallery-help-toggle', () => this._toggleGalleryHelp())
			// 按說明以外的地方就收起來
			this.$editor.on('pointerdown', e => {
				if (!$(e.target).closest('.js-help, .js-help-toggle, .js-gallery-help, .js-gallery-help-toggle, .js-draw-help, .js-draw-help-toggle').length) this._closeHelp()
			})
			this.$editor.on('click', '.js-capture-toggle', () => this.toggleCapture())
			this.$editor.on('click', '.js-image-zoom', e => this._openGallery(this._shotOfTool(e)))
			this.$editor.on('click', '.js-gallery-close', () => this._closeGallery())
			this.$editor.on('click', '.js-gallery-prev', () => this._moveGallery(-1))
			this.$editor.on('click', '.js-gallery-next', () => this._moveGallery(1))
			// 放大時不讓底下的網頁跟著捲動；jQuery 無法設定 passive: false
			this.$gallery[0].addEventListener('wheel', e => e.preventDefault(), { passive: false })
			this.$editor.on('click', '.js-shot-goto', e => this._viewShot(this._shotOfTool(e)))
			this.$editor.on('click', '.js-dialog-cancel', () => this._closeDialog())
			this.$editor.on('click', '.js-shot-copy', e => this._copy(this._shotOfTool(e)))
			this.$editor.on('click', '.js-shot-download', e => this._download(this._shotOfTool(e)))
			this.$editor.on('click', '.js-panel-toggle', () => this._togglePanel())
			this.$editor.on('click', '.js-close', () => this.close())
			this.$editor.on('click', '.js-panel-clear', () => this._requestClearDraft())
			this.$editor.on('click', '.js-image-remove', e => this._removeCard(e.currentTarget))
			this.$editor.on('click', '.js-image-copy-url', e => this._copyUrl(this._shotOfTool(e)))
			this.$editor.on('click', '.js-countdown-cancel', () => this._cancelCountdown())
			this.$editor.on('click', '.js-panel-tab', e => this._setPanelTab(e.currentTarget.dataset.tab))

			this.$editor.on('keydown', e => this._onKeydown(e))
			// 不讓網站的快捷鍵收到標註時的按鍵
			this.$editor.on('keyup keypress', e => e.stopPropagation())
		}

		// 內容已自動儲存，關閉不會遺失；isTakenOver 表示草稿已被其他分頁接手，不可再寫入
		close({ isTakenOver = false } = {}) {
			clearTimeout(this.statusTimer)
			clearTimeout(this.clearTimer)
			clearTimeout(this.syncTimer)
			clearTimeout(this.snapshotTimer)
			clearTimeout(this.countdown?.timer)
			clearTimeout(this.hintTimer)
			window.removeEventListener('keydown', this._onWindowKeydown, true)
			window.removeEventListener('scroll', this._onScroll, true)
			window.removeEventListener('resize', this._onResize)
			window.removeEventListener('pagehide', this._flushSave)
			document.removeEventListener('pointerdown', this._onPagePointerDown, true)
			window.removeEventListener('contextmenu', this._onPageContextMenu, true)
			window.removeEventListener('pointerdown', this._onLongPressStart, true)
			window.removeEventListener('pointermove', this._onLongPressMove, true)
			window.removeEventListener('pointerup', this._cancelLongPress, true)
			window.removeEventListener('blur', this._cancelLongPress)
			this._cancelLongPress()
			chrome.storage.onChanged.removeListener(this._onStorageChanged)
			if (isTakenOver) {
				clearTimeout(this.saveTimer)
			} else {
				this._flushSave()
			}
			this.shots.forEach(shot => shot.bitmap.close())
			this._dropScreen()
			this.host?.remove()
			this.onClose?.()
			if (!isTakenOver) this._notifyClosed()
			log(isTakenOver ? '草稿已由其他分頁接手，關閉此標註畫面' : '關閉標註模式（草稿已儲存）')
		}

		// 告訴 background.js 換頁後不用再接回；擴充功能剛重新載入時會丟錯，不影響關閉
		async _notifyClosed() {
			try {
				await chrome.runtime.sendMessage({ from: 'screenshot.js', to: 'background.js', type: 'screenshotClosed', data: {} })
			} catch (error) {
				log('無法通知背景程式', error)
			}
		}

		// 進入或離開截圖模式。進入時把網頁當下的畫面凍結當底圖，像 Windows 截圖工具；
		// isFreeze 為 false 用在放大編輯，底圖改用該張圖，不用另外截圖
		async toggleCapture({ isFreeze = true } = {}) {
			if (this.frozenShot || this.isBusy) return
			// 倒數中手動切換就取消倒數
			this._cancelCountdown()

			// 進入時先截圖，再切換模式蓋上遮罩：遮罩一蓋上就會接收滑鼠，網頁收到滑鼠離開，hover 的選單、提示會消失
			// 截圖期間工具是透明的，舞台也還不接收滑鼠，網頁的 hover 狀態會保留到截完
			let captured = null
			if (!this.isCapture && isFreeze) {
				try {
					captured = await this._captureViewport()
				} catch (error) {
					log('凍結畫面失敗', error)
					this._setStatus(STATUS_CAPTURE_FAILED)
					return
				}
			}

			this.isCapture = !this.isCapture
			this.scrollLock = this.isCapture ? { x: window.scrollX, y: window.scrollY } : null
			this._dropScreen()
			if (captured) this.screen = this._createScreen(captured)
			this.focusedShot = null
			this.dragStart = null
			this.moving = null
			this.drawing = null
			this.adjusting = null
			this.$draft.prop('hidden', true)
			this.$editor.toggleClass('is_capture', this.isCapture).removeClass('is_drawing')
			// 文字固定，用按下的狀態表示是否在模式中
			this.$captureToggle.toggleClass('is_active', this.isCapture).attr({ 'title': this.isCapture ? '離開截圖/編輯模式' : '進入截圖/編輯模式', 'aria-pressed': String(this.isCapture) })
			this.$modeLabel.text(this.isCapture ? '(編輯模式)' : '(一般模式)')
			this._setStatus()

			if (this.isCapture) {
				this._focusEditor()
			} else {
				this.$editor[0].getRootNode().activeElement?.blur()
			}
			this._renderMarks()
			log(this.isCapture ? '進入截圖模式' : '離開截圖模式')
		}

		// 凍結畫面：這次框的藍框都從這張圖裁切
		_createScreen({ bitmap, dataUrl }) {
			log('凍結畫面', { 圖片尺寸: `${bitmap.width} × ${bitmap.height}`, 網址: location.href, 捲動位置: window.scrollY })
			return {
				id: `${Date.now()}-${this.nextShotId++}`,
				bitmap,
				dataUrl, // 這次框的每個藍框都存一份
				url: location.href,
				scale: bitmap.width / window.innerWidth,
				viewportWidth: window.innerWidth,
				viewportHeight: window.innerHeight,
				scrollX: window.scrollX,
				scrollY: window.scrollY,
			}
		}

		_dropScreen() {
			this.screen?.bitmap.close()
			this.screen = null
		}

		// 同一張截圖框出的藍框共用 screenId；舊草稿沒有這個欄位，視為各自獨立
		_screenIdOf(source) {
			return source.screenId || source.id
		}

		// 工具列的操作說明：依一般模式、截圖模式分組；使用者沒有設定快捷鍵時不顯示那一列
		_mainHelp() {
			return [
				{
					name: '通用',
					rows: [
						...(this.shortcut ? [[this.shortcut, '切換一般/截圖模式']] : []),
					],
				},
				{
					name: '一般模式',
					rows: [
						['右鍵長按', '進入截圖模式'],
						['0~9', '倒數後進入截圖模式'],
						['Esc', '取消倒數'],
					],
				},
				{
					name: '截圖模式',
					rows: [
						['左鍵', `框起截圖`],
						['左鍵雙擊', '框起整個畫面'],
						['中鍵雙擊', '截取整個網頁 (含捲動範圍)'],
						['右鍵', '取消編輯 / 離開截圖模式'],
					],
				},
			]
		}

		// 畫圖工具列 (?) 的說明：藍框內的編輯操作都寫在這裡，菜單和放大列不重複
		_drawHelp() {
			return [
				{
					name: '編輯截圖',
					rows: [
						['滾輪', '調整線條粗細或文字大小'],
						['Ctrl+Z', '復原'],
						['Ctrl+Y', '重做'],
					],
				},
			]
		}

		// 放大列的操作說明：只說明放大編輯內的操作，分通用、區塊、整頁
		_galleryHelp() {
			return [
				{
					name: '畫廊編輯',
					rows: [
						['← →', '切換上一張、下一張'],
						['左鍵', '選取編輯 / 框起截圖'],
						['左鍵雙擊', '空白處整張截圖'],
						['右鍵', '取消編輯 / 離開畫廊'],
					],
				},
			]
		}

		// 內容都是程式內的固定文字和 chrome.commands 的快捷鍵，不含使用者輸入
		_helpTable(groups) {
			const body = groups.map(({ name, rows }) => `
				<tbody>
					<tr><th class="_group" colspan="2" scope="colgroup">${name}</th></tr>
					${rows.map(([key, desc]) => `<tr><th scope="row">${key}</th><td>${desc}</td></tr>`).join('')}
				</tbody>
			`).join('')
			return `<table class="screenshot_helpTable">${body}</table>`
		}

		// jQuery 的 trigger('focus') 無法把焦點移到 Shadow DOM 內的容器，需用原生 focus；一般模式不搶走網頁的焦點
		_focusEditor() {
			if (this.isCapture) this.$editor[0].focus({ preventScroll: true })
		}

		_build() {
			this.host = document.createElement('div')
			const shadow = this.host.attachShadow({ mode: 'open' })

			// adoptedStyleSheets 不受網站 CSP 的 style-src 限制
			const sheet = new CSSStyleSheet()
			sheet.replaceSync(this.cssText)
			shadow.adoptedStyleSheets = [sheet]

			this.$editor = $(`
				<div class="screenshot_editor" tabindex="-1">
					<div class="screenshot_editor--stage js-stage">
						<div class="screenshot_backdrop js-backdrop" hidden></div>
						<canvas class="screenshot_dim js-dim" hidden></canvas>
						<div class="screenshot_marks js-marks"></div>
						<div class="screenshot_draft js-draft" hidden></div>
						<!-- 自由畫線時跟著滑鼠的紅點，直徑等於線寬 -->
						<span class="screenshot_brush js-brush" hidden></span>
					</div>
					<button class="screenshot_panel_edge js-panel-edge js-panel-toggle" type="button" aria-label="展開截圖清單"><span class="_hint">← 點一下展開截圖清單</span></button>
					<!-- 展開時工具列會移進來，放在最上方當標題列 -->
					<aside class="screenshot_panel js-panel" aria-label="截圖清單" hidden>
						<!-- 左邊界：按住拖曳調整寬度 -->
						<div class="screenshot_panel_resize js-panel-resize" role="separator" aria-orientation="vertical" aria-label="拖曳調整截圖清單寬度" title="拖曳調整寬度"></div>
						<div class="screenshot_panel--head">
							<h2 class="screenshot_panel_title">截圖清單<span class="_count js-panel-title-count"></span></h2>
							<button class="screenshot_link is_danger js-panel-clear" type="button">全部移除</button>
						</div>
						<div class="screenshot_panel--tabs" role="tablist" aria-label="截圖分類">
							<button class="screenshot_tab js-panel-tab" type="button" role="tab" data-tab="block" aria-selected="true">區塊<span class="_count js-tab-count"></span></button>
							<button class="screenshot_tab js-panel-tab" type="button" role="tab" data-tab="page" aria-selected="false">整頁<span class="_count js-tab-count"></span></button>
							<!-- 一排 1 張／2 張；圖示是目前的排法 -->
							<button class="screenshot_colsBtn js-panel-cols" type="button"></button>
						</div>
						<!-- 外層留上方 8px 不捲動，捲動時內容不會貼著分頁底線 -->
						<div class="screenshot_panel--body" role="tabpanel">
							<div class="screenshot_panel--scroll">
								<p class="screenshot_panel_empty js-panel-empty"></p>
								<div class="screenshot_images js-panel-images"></div>
							</div>
						</div>
					</aside>
					<!-- 收合時的位置：放在右側欄後面，不會被蓋住 -->
					<div class="screenshot_toolbar js-toolbar">
						<div class="screenshot_toolbar--head js-toolbar-head">
							<span class="screenshot_toolbar_title">截圖工具 <span class="_mode js-mode-label">(一般模式)</span></span>
							<button class="screenshot_iconBtn js-help-toggle" type="button" title="操作說明" aria-label="操作說明" aria-expanded="false">${ICON_HELP}</button>
							<button class="screenshot_iconBtn is_danger js-close" type="button" title="結束" aria-label="結束">${ICON_CLOSE}</button>
						</div>
						<div class="screenshot_toolbar--body">
							<button class="screenshot_captureBtn js-capture-toggle" type="button" title="進入截圖/編輯模式" aria-pressed="false">${ICON_CROP}截圖/編輯</button>
							<span class="screenshot_status js-status" role="status">${STATUS_IDLE}</span>
							<button class="screenshot_iconBtn js-panel-toggle" type="button" title="截圖清單" aria-label="截圖清單" aria-expanded="false">${ICON_PANEL}<span class="_count js-panel-count"></span></button>
						</div>
						<div class="screenshot_help js-help" role="note" hidden>${this._helpTable(this._mainHelp())}</div>
					</div>
					<div class="screenshot_dialog js-dialog" role="dialog" aria-label="圖片不在目前頁面" hidden>
						<p class="_text">這張圖不在目前頁面，是否前往？</p>
						<a class="_url js-dialog-url"></a>
						<div class="screenshot_dialog--foot">
							<button class="screenshot_btn is_light js-dialog-cancel" type="button">取消</button>
							<a class="screenshot_btn is_primary js-dialog-go">前往</a>
						</div>
					</div>
					<!-- 左上頁數、右上說明／關閉、左右兩側上下頁；選取藍框編輯時整組隱藏 -->
					<div class="screenshot_gallery js-gallery" role="toolbar" aria-label="放大編輯" hidden>
						<button class="_nav _nav_prev js-gallery-nav js-gallery-prev" type="button" title="上一張 (←)" aria-label="上一張">‹</button>
						<span class="_count js-gallery-count"></span>
						<button class="_nav _nav_next js-gallery-nav js-gallery-next" type="button" title="下一張 (→)" aria-label="下一張">›</button>
						<div class="_actions">
							<button class="_tool _help js-gallery-help-toggle" type="button" title="操作說明" aria-label="操作說明" aria-expanded="false">${ICON_HELP}</button>
							<button class="_tool js-gallery-close" type="button" title="關閉 (Esc)" aria-label="關閉">×</button>
							<div class="screenshot_help js-gallery-help" role="note" hidden>${this._helpTable(this._galleryHelp())}</div>
						</div>
					</div>
					<!-- 畫圖工具列 (?) 的說明：工具列會隨重繪重建，說明放在外層，位置由 JS 依按鈕算出 -->
					<div class="screenshot_help screenshot_drawHelp js-draw-help" role="note" hidden>${this._helpTable(this._drawHelp())}</div>
				</div>
			`)
			this.$stage = this.$editor.find('.js-stage')
			this.$toolbar = this.$editor.find('.js-toolbar')
			this.$toolbarHead = this.$editor.find('.js-toolbar-head')
			this.$help = this.$editor.find('.js-help')
			this.$helpToggle = this.$editor.find('.js-help-toggle')
			this.$galleryHelp = this.$editor.find('.js-gallery-help')
			this.$galleryHelpToggle = this.$editor.find('.js-gallery-help-toggle')
			this.$drawHelp = this.$editor.find('.js-draw-help')
			this.$backdrop = this.$editor.find('.js-backdrop')
			this.$dim = this.$editor.find('.js-dim')
			this.$marks = this.$editor.find('.js-marks')
			this.$brush = this.$editor.find('.js-brush')
			this.$draft = this.$editor.find('.js-draft')
			this.$status = this.$editor.find('.js-status')
			this.$captureToggle = this.$editor.find('.js-capture-toggle')
			this.$modeLabel = this.$editor.find('.js-mode-label')
			this.$dialog = this.$editor.find('.js-dialog')
			this.$dialogLinks = this.$editor.find('.js-dialog-url, .js-dialog-go')
			this.$dialogUrl = this.$editor.find('.js-dialog-url')
			this.$toggle = this.$editor.find('.screenshot_toolbar .js-panel-toggle')
			this.$panelCount = this.$editor.find('.js-panel-count')
			this.$panelEdge = this.$editor.find('.js-panel-edge')
			this.$panel = this.$editor.find('.js-panel')
			this.$panelResize = this.$editor.find('.js-panel-resize')
			this.$panelCols = this.$editor.find('.js-panel-cols')
			this.$panelTitleCount = this.$editor.find('.js-panel-title-count')
			this.$panelEmpty = this.$editor.find('.js-panel-empty')
			this.$panelImages = this.$editor.find('.js-panel-images')
			this.$gallery = this.$editor.find('.js-gallery')
			this.$galleryCount = this.$editor.find('.js-gallery-count')
			this.$galleryNav = this.$editor.find('.js-gallery-nav')
			this.$panelClear = this.$editor.find('.js-panel-clear')
			this.$panelTabs = this.$editor.find('.js-panel-tab')

			shadow.append(this.$editor[0])
			document.documentElement.append(this.host)
		}

		_onPointerDown(e) {
			if (this.isBusy) return

			const $target = $(e.target)
			// 按工具列不影響 focus，也不開始框選
			if ($target.closest('.screenshot_tools, .screenshot_draw').length) return
			if ($target.is('.js-item-text')) {
				this._onTextPress(e, $target)
				return
			}

			// 截圖模式（非放大）在空白處雙擊中鍵：整頁截圖
			if (e.button === 1) {
				e.preventDefault()
				if (!this.frozenShot && !this._shotsAt(e).length) this._onBlankMiddleClick()
				return
			}
			// 右鍵在 contextmenu 處理（_onContextMenu），按下時不做事
			if (e.button === 2) return
			if (e.button !== 0 || $target.closest('.js-crop-remove, .js-item-remove').length) return

			if ($target.is('.js-crop-move, .js-crop-handle')) {
				const $shot = $target.closest('.js-shot')
				const shot = $shot.data('shot')
				this._setFocus(shot)
				this._startMove(e, { box: shot.crop, $el: $shot.find('.js-crop-box'), shot, isResize: $target.is('.js-crop-handle') })
				return
			}
			if ($target.is('.js-item-grip')) {
				this._startAdjust(e, $target)
				return
			}
			this._onCanvasPress(e)
		}

		// 按文字框邊緣的虛框是移動，按裡面才是打字
		_onTextPress(e, $text) {
			const shot = $text.closest('.js-shot').data('shot')
			const item = e.button === 0 ? this._hitItem(shot, e) : null
			if (item) this._beginAdjust(e, shot, item, 'move')
		}

		// 藍框內才畫圖；按到其他藍框只切換 focus，按到外面就結束畫圖
		_onCanvasPress(e) {
			const focused = this.focusedShot
			const shots = this._visibleShots()
			if (shots.includes(focused) && this._isInCrop(focused, e)) {
				const hit = this._hitItem(focused, e)
				if (hit) {
					this._beginAdjust(e, focused, hit, 'move')
				} else {
					this.selectedItem = null
					this._syncShots()
					this._startDrawing(e, focused)
				}
				return
			}
			// 藍框內不能再框新的藍框，只切換 focus；空白處拖曳才框新的範圍
			const shot = this._shotsAt(e).sort((a, b) => b.z - a.z)[0]
			if (shot) {
				this._setFocus(shot)
				this._focusEditor()
			} else {
				this._clearFocus()
				// 整頁截圖只能畫圖，不能再框藍框
				if (!this.frozenShot?.isFullPage) this._startDrag(e)
			}
		}

		_startMove(e, target) {
			e.preventDefault()
			this._focusEditor()
			e.currentTarget.setPointerCapture(e.pointerId)
			clearTimeout(this.syncTimer) // 又開始拖曳，等放開後再更新圖片
			const { x, y, w, h } = target.box
			this.moving = { ...target, x: e.clientX, y: e.clientY, origin: { x, y, w, h }, hasMoved: false }
			this.$editor.addClass('is_drawing')
		}

		// 在空白處按住左鍵框截圖範圍
		_startDrag(e) {
			e.preventDefault()
			this._focusEditor()
			e.currentTarget.setPointerCapture(e.pointerId)
			this.dragStart = { x: e.clientX, y: e.clientY, scrollX: window.scrollX, scrollY: window.scrollY }
			this.lastPointer = { x: e.clientX, y: e.clientY }
			this.$editor.addClass('is_drawing')
			this._updateDraft()
			this.$draft.prop('hidden', false)
		}

		_onPointerMove(e) {
			if (this.drawing) {
				this._updateDrawing(e)
			} else if (this.adjusting) {
				this._applyAdjust(e)
			} else if (this.moving) {
				this._applyMove(e)
			} else if (this.dragStart) {
				this.lastPointer = { x: e.clientX, y: e.clientY }
				this._updateDraft()
			} else {
				const shot = this.focusedShot
				this.$stage.toggleClass('is_over_item', Boolean(shot && this._visibleShots().includes(shot) && this._isInCrop(shot, e) && this._hitItem(shot, e)))
			}
			this.brushPoint = { clientX: e.clientX, clientY: e.clientY, target: e.target }
			this._syncBrush()
		}

		// 自由畫線：滑鼠在選取中的藍框內才顯示紅點，移到按鈕、控制點上，或正在調整、移動時隱藏
		_syncBrush() {
			const point = this.brushPoint
			const shot = this.focusedShot
			const isControl = point && $(point.target).closest('button, ._grip, ._handle, ._move, .screenshot_draw, .screenshot_tools, .js-item-text').length
			const isOn = Boolean(point && shot && this.activeTool === 'pen' && !isControl && !this.adjusting && !this.moving && !this.dragStart
				&& (this.isCapture || this.frozenShot) && this._visibleShots().includes(shot) && (this.drawing || this._isInCrop(shot, point)))
			this.$brush.prop('hidden', !isOn)
			this.$stage.toggleClass('is_brush', isOn)
			if (!isOn) return

			const size = this.drawing?.item?.width ?? this.lineWidth
			this.$brush.css({ left: point.clientX, top: point.clientY, width: size, height: size })
		}

		_hideBrush() {
			this.brushPoint = null
			this._syncBrush()
		}

		async _onPointerUp(e) {
			if (this.drawing) {
				this._finishDrawing(e.type === 'pointerup')
				return
			}
			if (this.adjusting) {
				const { shot, hasMoved } = this.adjusting
				this.adjusting = null
				this.$editor.removeClass('is_drawing')
				if (hasMoved) this._markChanged(shot)
				return
			}
			if (this.moving) {
				const { box, shot, isResize, hasMoved } = this.moving
				this.moving = null
				this.$editor.removeClass('is_drawing')
				if (hasMoved) {
					// 底圖是凍結的，只換裁切範圍，不重新截圖
					log(`${isResize ? '調整大小' : '移動'}截圖範圍`, { x: box.x, y: box.y, w: box.w, h: box.h })
					this._markChanged(shot)
				} else if (this.pendingShots.size) {
					this._syncSoon()
				}
				return
			}
			if (!this.dragStart) return

			this.lastPointer = { x: e.clientX, y: e.clientY }
			const rect = this._dragRect()
			this.dragStart = null
			this.$draft.prop('hidden', true)
			this.$editor.removeClass('is_drawing')
			this._paintDim() // 框選範圍的挖空收回；框成藍框的話，重繪時會再挖空

			if (e.type !== 'pointerup') return
			if (rect.width < MIN_BOX_SIZE || rect.height < MIN_BOX_SIZE) {
				this._onBlankClick()
				return
			}
			if (rect.width < MIN_SHOT_SIZE || rect.height < MIN_SHOT_SIZE) {
				this._setStatus(STATUS_TOO_SMALL)
				return
			}
			await this._setCrop(rect)
		}

		// 按住標題列拖曳；位置只留在這個頁面，換頁後回到預設。移進右側欄時固定不動
		_onToolbarDown(e) {
			if (this._isPanelOpen()) return
			if (e.button !== 0 || $(e.target).closest('button').length) return

			e.preventDefault()
			e.currentTarget.setPointerCapture(e.pointerId)
			const { left, top } = this.$toolbar[0].getBoundingClientRect()
			this.toolbarDrag = { x: e.clientX - left, y: e.clientY - top }
			this.$toolbar.addClass('is_moved')
			this._placeToolbar(left, top)
		}

		_onToolbarMove(e) {
			if (this.toolbarDrag) this._placeToolbar(e.clientX - this.toolbarDrag.x, e.clientY - this.toolbarDrag.y)
		}

		_onToolbarUp() {
			this.toolbarDrag = null
		}

		_toggleHelp() {
			const isOpen = this.$help.prop('hidden')
			this.$help.prop('hidden', !isOpen)
			this.$helpToggle.attr('aria-expanded', String(isOpen))
			if (!isOpen) return

			// 預設在 (?) 正下方、水平置中對齊按鈕，放不下且上方空間較大時改往上；高度限制在該側的空間內，超過就捲動；左右超出視窗時往內推
			// 說明放在工具列內，位置換算成相對工具列的座標
			const help = this.$help[0]
			const editor = this.$editor[0]
			const toolbar = this.$toolbar[0].getBoundingClientRect()
			const button = this.$helpToggle[0].getBoundingClientRect()
			const below = editor.clientHeight - button.bottom - HELP_GAP * 2
			const above = button.top - HELP_GAP * 2
			this.$help.css({
				'--help-shift': '0px',
				'--help-max': 'none',
				'--help-x': `${button.left + button.width / 2 - toolbar.left}px`,
				'--help-top': `${button.bottom - toolbar.top + HELP_GAP}px`,
				'--help-bottom': `${toolbar.bottom - button.top + HELP_GAP}px`,
			})
			const isUp = help.offsetHeight > below && above > below
			this.$help.toggleClass('is_up', isUp).css('--help-max', `${isUp ? above : below}px`)
			const { left, right } = help.getBoundingClientRect()
			const shift = Math.max(0, HELP_GAP - left) - Math.max(0, right - (editor.clientWidth - HELP_GAP))
			this.$help.css('--help-shift', `${shift}px`)
		}

		// 放大的工具列在上方，說明固定往下開
		_toggleGalleryHelp() {
			const isOpen = this.$galleryHelp.prop('hidden')
			this.$galleryHelp.prop('hidden', !isOpen)
			this.$galleryHelpToggle.attr('aria-expanded', String(isOpen))
		}

		// 預設在按鈕下方、右緣對齊；下方放不下且上方空間較大時改往上；左右不超出視窗
		_toggleDrawHelp(button) {
			const isOpen = this.$drawHelp.prop('hidden')
			this._closeHelp()
			if (!isOpen) return

			this.$drawHelp.prop('hidden', false).css('--help-max', 'none')
			$(button).attr('aria-expanded', 'true')
			const help = this.$drawHelp[0]
			const editor = this.$editor[0]
			const rect = button.getBoundingClientRect()
			const below = editor.clientHeight - rect.bottom - HELP_GAP * 2
			const above = rect.top - HELP_GAP * 2
			const isUp = help.offsetHeight > below && above > below
			this.$drawHelp.css('--help-max', `${isUp ? above : below}px`)
			const left = Math.min(Math.max(rect.right - help.offsetWidth, HELP_GAP), editor.clientWidth - help.offsetWidth - HELP_GAP)
			const top = isUp ? rect.top - HELP_GAP - help.offsetHeight : rect.bottom + HELP_GAP
			this.$drawHelp.css({ left, top })
		}

		_isHelpOpen() {
			return !this.$help.prop('hidden') || !this.$galleryHelp.prop('hidden') || !this.$drawHelp.prop('hidden')
		}

		_closeHelp() {
			this.$help.prop('hidden', true)
			this.$helpToggle.attr('aria-expanded', 'false')
			this.$galleryHelp.prop('hidden', true)
			this.$galleryHelpToggle.attr('aria-expanded', 'false')
			this.$drawHelp.prop('hidden', true)
			this.$marks.find('.js-draw-help-toggle').attr('aria-expanded', 'false')
		}

		// 不能拖出視窗，否則按不到工具列
		_placeToolbar(left, top) {
			const toolbar = this.$toolbar[0]
			const editor = this.$editor[0]
			this.$toolbar.css({
				left: Math.max(0, Math.min(left, editor.clientWidth - toolbar.offsetWidth)),
				top: Math.max(0, Math.min(top, editor.clientHeight - toolbar.offsetHeight)),
			})
		}

		_onResize = () => {
			if (this.$toolbar.hasClass('is_moved')) this._placeToolbar(this.$toolbar[0].offsetLeft, this.$toolbar[0].offsetTop)
			this._paintDim()
		}

		// 空白處左鍵雙擊截全螢幕。單擊只取消 focus：藍框是整張圖的畫板，不能一滑手就連畫的內容一起消失
		_onBlankClick() {
			const now = Date.now()
			if (now - this.lastBlankClick <= DOUBLE_CLICK_DELAY) {
				this.lastBlankClick = 0
				this._captureFull()
				return
			}
			this.lastBlankClick = now
		}

		// 右鍵：有選取藍框時取消選取；沒有選取時，放大中關閉放大，截圖模式時離開截圖模式（長按右鍵再進來）；畫圖、拖曳到一半時不處理
		// 在 contextmenu 才處理並擋掉：若在按下時就離開，舞台不再接收滑鼠，放開時的右鍵選單會落到網頁上，觸發網站自己的右鍵效果
		_onContextMenu(e) {
			// 也不冒泡到網頁：網站的自訂右鍵選單常掛在 document 上
			e.preventDefault()
			e.stopPropagation()
			if (this.isBusy || this.drawing || this.adjusting || this.moving || this.dragStart) return
			// 分兩段：有選取藍框時（不論點在框內或空白處）先取消選取；沒有選取時，放大中關閉放大、截圖模式回到一般模式
			if (this.focusedShot) {
				this._clearFocus()
			} else if (this.frozenShot) {
				this._closeGallery()
			} else if (this.isCapture) {
				this.toggleCapture()
			}
		}

		// 空白處中鍵雙擊：整頁截圖
		_onBlankMiddleClick() {
			const now = Date.now()
			if (now - this.lastMiddleClick <= DOUBLE_CLICK_DELAY) {
				this.lastMiddleClick = 0
				this._captureFullPage()
				return
			}
			this.lastMiddleClick = now
		}

		// 整頁截圖（含捲動範圍），和 F12 的「Capture full size screenshot」相同，由 background.js 透過偵錯介面截取
		// 結果直接加入截圖清單，可以複製、下載；圖比畫面大很多，第一版不支援放大編輯和畫圖
		async _captureFullPage() {
			if (this.isBusy) return

			// 工具是網頁裡的元素，截圖前先設為透明，圖上才不會有工具
			this.isBusy = true
			this.$editor[0].style.opacity = '0'
			let result
			try {
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
				const response = await chrome.runtime.sendMessage({ from: 'screenshot.js', to: 'background.js', type: 'captureFullPage', data: {} })
				result = response?.data
				if (!result?.dataUrl) throw new Error(result?.error || '沒有回傳圖片')
			} catch (error) {
				log('整頁截圖失敗', error)
				this._setStatus('整頁截圖失敗')
				return
			} finally {
				this.$editor[0].style.opacity = ''
				this.isBusy = false
			}

			const bitmap = await createImageBitmap(this._dataUrlToBlob(result.dataUrl))
			const shot = {
				id: `${Date.now()}-${this.nextShotId++}`,
				isFullPage: true,
				bitmap,
				dataUrl: result.dataUrl, // 存進草稿後就清掉
				url: location.href,
				scale: bitmap.width / result.width,
				viewportWidth: result.width, // 整個網頁的 CSS 尺寸
				viewportHeight: result.height,
				scrollX: 0,
				scrollY: 0,
				isDetached: false,
				z: 0,
				crop: { x: 0, y: 0, w: 1, h: 1 },
				items: [],
			}
			await this._commitShot(shot)
			this.panelTab = 'page'
			this._syncPanel()
			this._syncPanelToggle()
			this._saveDraft()
			const index = this._shotNumber(shot)
			this._showSnapshot(this._renderShot(shot), `已加入整頁截圖（第 ${index} 張）`)
			log('整頁截圖', { 第幾張: index, 網頁尺寸: `${result.width} × ${result.height}`, 圖片尺寸: `${bitmap.width} × ${bitmap.height}` })
		}

		// 截圖模式一律不捲動網頁；focus 藍框時滾輪調粗細或字級
		_onWheel = e => {
			e.preventDefault()
			const unit = e.deltaMode === 1 ? 16 : 1 // deltaMode 1 表示以行為單位
			// 放大整頁截圖：瀏覽（沒有選取）時滾輪捲動圖片；選取編輯時和區塊一樣調粗細
			if (this.frozenShot?.isFullPage && !this.focusedShot) {
				this._scrollGallery(e.deltaY * unit)
				return
			}
			if (this._visibleShots().includes(this.focusedShot)) this._onSizeWheel(e, e.deltaY * unit)
		}

		_onSizeWheel(e, delta) {
			// 換方向就重新累積，才不會反應慢一拍
			if (delta * this.wheelDelta < 0) this.wheelDelta = 0
			this.wheelDelta += delta
			if (Math.abs(this.wheelDelta) < WHEEL_STEP) return

			const direction = this.wheelDelta < 0 ? 1 : -1 // 往上滾變大
			this.wheelDelta = 0
			const shot = this.focusedShot
			const item = this._sizeTarget(e, shot)

			if (item) {
				this._changeItemSize(shot, item, direction)
				this._setNextSize(item) // 下一筆也沿用
				this._setStatus(this._sizeText(item))
			} else {
				const isText = this.activeTool === 'text'
				if (isText) {
					this.textSize = this._nextTextSize(this.textSize, direction)
				} else {
					this.lineWidth = this._nextLineWidth(this.lineWidth, direction)
				}
				this._setStatus(isText ? `文字 ${this.textSize}px` : `線條 ${this.lineWidth}px`)
			}
			this._syncShots()
		}

		// 畫到一半的、打字中的、游標底下的（控制點或文字框）、選取中的直線或方框，都沒有就只改下一筆
		_sizeTarget(e, shot) {
			if (this.drawing?.item) return this.drawing.item
			if (this.editingItem) return this.editingItem
			const id = $(e.target).closest('.js-item').data('id')
			return shot.items.find(item => item.id === id) || this._selectedOf(shot)
		}

		_selectedOf(shot) {
			return shot?.items.includes(this.selectedItem) ? this.selectedItem : null
		}

		_changeItemSize(shot, item, direction) {
			if (item.type === 'text') {
				item.size = this._nextTextSize(item.size ?? TEXT_SIZE, direction)
				this._placeItem(item)
				this._growTextBox(shot, item)
			} else {
				item.width = this._nextLineWidth(item.width ?? LINE_WIDTH, direction)
			}
			this._paintInk(shot)
			if (!this.drawing) this._markChanged(shot)
		}

		_setNextSize(item) {
			if (item.type === 'text') {
				this.textSize = item.size
			} else {
				this.lineWidth = item.width
			}
		}

		_sizeText(item) {
			return item.type === 'text' ? `文字 ${item.size}px` : `線條 ${item.width}px`
		}

		_nextTextSize(size, direction) {
			const step = direction > 0 ? (size < TEXT_SIZE_BREAK ? 2 : 4) : (size > TEXT_SIZE_BREAK ? 4 : 2)
			return Math.min(Math.max(size + step * direction, MIN_TEXT_SIZE), MAX_TEXT_SIZE)
		}

		_nextLineWidth(width, direction) {
			return Math.min(Math.max(width + direction, MIN_LINE_WIDTH), MAX_LINE_WIDTH)
		}

		_onScroll = e => {
			// 截圖模式鎖住網頁：拖捲軸、網頁自己捲動時拉回原位
			const lock = this.scrollLock
			if (lock && e.target === document && (window.scrollX !== lock.x || window.scrollY !== lock.y)) {
				window.scrollTo({ left: lock.x, top: lock.y, behavior: 'instant' })
				return
			}
			// 截圖模式蓋著凍結畫面，底下網頁的內層捲動不影響藍框位置
			if (this.isCapture) return

			if (e.target === document) {
				this._syncShots()
			} else if (this.shots.some(shot => !shot.isDetached)) {
				// 內層區塊捲動時無法追蹤藍框位置，舊內容改為只留在圖片中，不顯示在畫面上
				this.shots.forEach(shot => { shot.isDetached = true })
				this._renderMarks()
			}
			if (this.dragStart) this._updateDraft()
		}

		_onWindowKeydown = e => {
			if (e.isComposing) return

			if (e.key === 'Escape' && this._isHelpOpen()) {
				e.preventDefault()
				e.stopPropagation()
				this._closeHelp()
				return
			}
			// 倒數中的 Esc 只取消倒數，不結束工具
			if (e.key === 'Escape' && this.countdown) {
				e.preventDefault()
				e.stopPropagation()
				this._cancelCountdown()
				return
			}
			if (this._isCountdownKey(e)) {
				e.preventDefault()
				e.stopPropagation()
				this._startCountdown(Number(e.key))
				return
			}
			if ($(this.$editor[0].getRootNode().activeElement).is('.js-item-text')) {
				if (e.key === 'Escape') this._endTextInput(e)
			} else if (this.frozenShot) {
				this._onGalleryKeydown(e)
			} else if (e.key === 'Escape' && !e.repeat) {
				this._onEscape(e)
			}
		}

		// 一般模式按 0~9 開始倒數（0 為立即進入）；在網頁的輸入框打字、或搭配 Ctrl、Alt、⌘ 時不攔截
		_isCountdownKey(e) {
			if (this.isCapture || this.frozenShot || this.isBusy) return false
			if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.altKey || e.metaKey) return false
			const target = e.composedPath()[0]
			return !(target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
		}

		// 倒數期間網頁照常可操作，可以先打開選單；倒數中再按數字就以新的秒數重新開始
		_startCountdown(seconds) {
			this._cancelCountdown()
			this.countdown = { remain: seconds, timer: null }
			log('開始倒數', { 秒數: seconds })
			this._tickCountdown()
		}

		_tickCountdown() {
			const countdown = this.countdown
			if (countdown.remain <= 0) {
				this.countdown = null
				this._setStatus()
				log('倒數結束，凍結畫面')
				this.toggleCapture()
				return
			}
			this._setStatus()
			countdown.timer = setTimeout(() => {
				countdown.remain--
				this._tickCountdown()
			}, 1000)
		}

		_cancelCountdown() {
			if (!this.countdown) return
			clearTimeout(this.countdown.timer)
			this.countdown = null
			this._setStatus()
			log('取消倒數')
		}

		_onGalleryKeydown(e) {
			const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key]
			const page = this.$stage[0].clientHeight
			const scroll = { ArrowUp: -GALLERY_SCROLL_STEP, ArrowDown: GALLERY_SCROLL_STEP, PageUp: -page, PageDown: page, Home: -Infinity, End: Infinity }[e.key]
			if (e.key === 'Escape') {
				this._closeGallery()
			} else if (step) {
				// 選取藍框編輯時隱藏了上下頁，← → 也不換頁
				if (this.focusedShot) return
				this._moveGallery(step)
			} else if (scroll && this.frozenShot.isFullPage) {
				this._scrollGallery(scroll)
			} else {
				return
			}
			e.preventDefault()
			e.stopPropagation()
		}

		// 輸入文字時 Esc 只結束輸入，不離開截圖模式，也不關閉放大
		_endTextInput(e) {
			e.preventDefault()
			e.stopPropagation()
			this.$editor[0].getRootNode().activeElement.blur()
			this._focusEditor()
		}

		// Esc 不會結束工具（結束要按 ✕）；一般模式不攔截，網頁自己的對話框等功能仍可正常關閉
		_onEscape(e) {
			if (!this.$dialog.prop('hidden')) {
				e.preventDefault()
				e.stopPropagation()
				this._closeDialog()
			} else if (this.isCapture) {
				e.preventDefault()
				e.stopPropagation()
				this.toggleCapture()
			}
		}

		// 工具本身的點擊會被重新導向到 host，不算點網頁
		_onPagePointerDown = e => {
			if (e.target !== this.host) this._closeHelp()
			if (!this._isLocating() || !this.focusedShot || e.target === this.host) return
			this._clearFocus()
		}

		// 一般模式在網頁上按住右鍵：計時，時間到就進入截圖模式
		// Windows 的右鍵選單在放開時才出現，放開時再擋掉這一次；macOS、Linux 按下就出現選單，選單出現時取消計時
		_onLongPressStart = e => {
			this.isMenuSuppressed = false
			if (e.button !== 2 || this.isCapture || this.frozenShot || this.isBusy || e.composedPath().includes(this.host)) return
			this._cancelLongPress()
			this.longPress = { x: e.clientX, y: e.clientY, timer: setTimeout(() => this._onLongPress(), LONG_PRESS_DELAY) }
		}

		_onLongPressMove = e => {
			if (this.longPress && Math.hypot(e.clientX - this.longPress.x, e.clientY - this.longPress.y) > LONG_PRESS_TOLERANCE) this._cancelLongPress()
		}

		_cancelLongPress = () => {
			clearTimeout(this.longPress?.timer)
			this.longPress = null
		}

		_onLongPress() {
			this.longPress = null
			// 放開右鍵時的選單、以及截圖模式裡「右鍵離開」都不要觸發
			this.isMenuSuppressed = true
			this.toggleCapture()
			log('長按右鍵，進入截圖模式')
		}

		// 長按右鍵進入截圖模式後，放開時的這一次右鍵選單擋掉
		_onPageContextMenu = e => {
			// 選單已經出現（macOS、Linux 按下就出現），不再進入截圖模式
			this._cancelLongPress()
			if (!this.isMenuSuppressed) return
			this.isMenuSuppressed = false
			e.preventDefault()
			e.stopPropagation()
		}

		// 其他分頁開啟標註時會接手草稿，這裡就要收起來，避免舊內容蓋掉新內容
		_onStorageChanged = (changes, area) => {
			if (area !== 'local' || !changes[DRAFT_KEY]) return
			if (changes[DRAFT_KEY].newValue?.editorId !== this.editorId) this.close({ isTakenOver: true })
		}

		_onKeydown(e) {
			e.stopPropagation()

			// 文字框內的 Ctrl+Z 是復原打字
			if ($(e.target).is('.js-item-text')) return
			if (this.isCapture && SCROLL_KEYS.includes(e.key)) e.preventDefault()
			if (this.isCapture && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
				e.preventDefault()
				this._undo()
			}
			if (this.isCapture && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
				e.preventDefault()
				this._redo()
			}
		}

		// 起點換算成目前視窗座標，按住時捲動網頁，框才會跟著延伸；超出視窗的部分不在截圖內
		_dragRect() {
			const startX = this.dragStart.x - (window.scrollX - this.dragStart.scrollX)
			const startY = this.dragStart.y - (window.scrollY - this.dragStart.scrollY)
			const clampX = v => Math.min(Math.max(v, 0), window.innerWidth)
			const clampY = v => Math.min(Math.max(v, 0), window.innerHeight)
			const x1 = clampX(startX)
			const y1 = clampY(startY)
			const x2 = clampX(this.lastPointer.x)
			const y2 = clampY(this.lastPointer.y)

			return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
		}

		_updateDraft() {
			const rect = this._dragRect()
			// 還不到最小尺寸時框線變紅，放開也不會截圖
			this.$draft.css(rect).toggleClass('is_small', rect.width < MIN_SHOT_SIZE || rect.height < MIN_SHOT_SIZE)
			this._paintDim()
		}

		// 每個藍框是一張圖：從凍結畫面或放大中的圖複製一份截圖，刪掉其中一張不影響其他藍框
		async _createShot(source) {
			const bitmap = await createImageBitmap(source.bitmap)
			return {
				id: `${Date.now()}-${this.nextShotId++}`,
				screenId: this._screenIdOf(source),
				bitmap,
				dataUrl: source.dataUrl || this._bitmapToDataUrl(source.bitmap), // 存進草稿後就清掉，不佔記憶體
				url: source.url,
				scale: source.scale,
				viewportWidth: source.viewportWidth,
				viewportHeight: source.viewportHeight,
				scrollX: source.scrollX,
				scrollY: source.scrollY,
				isDetached: false,
				z: 0,
				crop: null, // 藍框（0~1 比例）
				items: [], // 畫的內容：視窗像素座標，不跟著藍框或視窗變動
			}
		}

		// 放大中的圖存進草稿後已沒有 dataUrl，從截圖轉回來
		_bitmapToDataUrl(bitmap) {
			const canvas = document.createElement('canvas')
			canvas.width = bitmap.width
			canvas.height = bitmap.height
			canvas.getContext('2d').drawImage(bitmap, 0, 0)
			return canvas.toDataURL('image/png')
		}

		// 截圖前先把介面設為透明，圖上才不會有擴充功能的畫面；用透明而非隱藏，網頁才不會誤觸 hover
		// 改在內層設定：host 的樣式在 CSS 鎖死了，inline style 改不動
		async _captureViewport() {
			this.isBusy = true
			this.$editor[0].style.opacity = '0'
			try {
				await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
				let dataUrl = await this._requestCapture()
				// Chrome 限制每秒截圖次數，太快時等一下重試一次
				if (!dataUrl) {
					await new Promise(resolve => setTimeout(resolve, 600))
					dataUrl = await this._requestCapture()
				}
				if (!dataUrl) throw new Error('截圖失敗')
				return { bitmap: await createImageBitmap(this._dataUrlToBlob(dataUrl)), dataUrl }
			} finally {
				this.$editor[0].style.opacity = ''
				this.isBusy = false
			}
		}

		async _requestCapture() {
			const response = await chrome.runtime.sendMessage({ from: 'screenshot.js', to: 'background.js', type: 'captureVisibleTab', data: {} })
			if (response?.data?.error) log('截圖請求失敗', response.data.error)
			return response?.data?.dataUrl || null
		}

		// after：插在這張後面（放大中新增時，新圖排在目前這張的下一號）；沒有就加在最後
		async _commitShot(shot, { after = null } = {}) {
			const index = after ? this.shots.indexOf(after) : -1
			if (index < 0) {
				this.shots.push(shot)
			} else {
				this.shots.splice(index + 1, 0, shot)
			}
			await this._saveImage(shot)
		}

		// 藍框框住整個可見範圍；扣掉捲軸，右側和下方的框線才看得到
		async _captureFull() {
			const { clientWidth, clientHeight } = this.$stage[0]
			await this._setCrop({ left: 0, top: 0, width: clientWidth, height: clientHeight })
		}

		// 每框一次就新增一個藍框（一張圖），底圖用凍結畫面；放大時用放大中的圖
		async _setCrop(rect) {
			const source = this.frozenShot || this.screen
			if (!source || source.isFullPage) return

			const shot = await this._createShot(source)
			shot.crop = {
				x: rect.left / shot.viewportWidth,
				y: rect.top / shot.viewportHeight,
				w: rect.width / shot.viewportWidth,
				h: rect.height / shot.viewportHeight,
			}
			await this._commitShot(shot, { after: this.frozenShot })
			shot.z = this.nextZ++
			this.focusedShot = shot
			this.panelTab = 'block'
			this._renderMarks()
			this._syncPanel()
			this._saveDraft()
			log('設定截圖範圍', { 位於第幾張圖: this.shots.indexOf(shot) + 1, 範圍: rect })
		}

		// ── 畫圖 ──────────────────────────────────────────
		_setTool(tool) {
			this.activeTool = tool
			this.selectedItem = null // 接下來要畫新的，滾輪只改下一筆
			this._syncShots()
			this._focusEditor()
		}

		// 內容記錄的是截圖當下的視窗座標，所以要扣掉之後捲動的距離
		_toShotPoint(shot, e) {
			const { x, y } = this._shotOffset(shot)
			return { x: Math.round(e.clientX - x), y: Math.round(e.clientY - y) }
		}

		// 放大時底圖固定不動（整頁截圖例外，跟著放大中的捲動），其他時候跟著網頁捲動
		_shotOffset(shot) {
			if (this.frozenShot) return { x: 0, y: this._isScrollShot(shot) ? -this.galleryScrollY : 0 }
			return { x: shot.scrollX - window.scrollX, y: shot.scrollY - window.scrollY }
		}

		// 放大時顯示同一張截圖框出的所有藍框；截圖模式只顯示這次凍結畫面框的藍框，畫面才乾淨；
		// 一般模式只顯示「在網頁上顯示位置」的那一張
		_visibleShots() {
			if (this._isLocating()) return this._pageShots().filter(shot => shot === this.focusedShot)
			const screenId = this.frozenShot ? this._screenIdOf(this.frozenShot) : this.screen?.id
			return this.shots.filter(shot => this._screenIdOf(shot) === screenId)
		}

		// 一般模式沒有凍結底圖，藍框只用來顯示位置，不能編輯
		_isLocating() {
			return !this.frozenShot && !this.isCapture
		}

		_cropRect(shot) {
			const { crop } = shot
			return {
				left: crop.x * shot.viewportWidth,
				top: crop.y * shot.viewportHeight,
				right: (crop.x + crop.w) * shot.viewportWidth,
				bottom: (crop.y + crop.h) * shot.viewportHeight,
			}
		}

		// 游標底下有哪些藍框；內層捲動後位置已不準的不算
		_shotsAt(e) {
			return this._visibleShots().filter(shot => (!shot.isDetached || this.frozenShot) && this._isInCrop(shot, e))
		}

		_isInCrop(shot, e) {
			const { x, y } = this._toShotPoint(shot, e)
			const { left, top, right, bottom } = this._cropRect(shot)
			return x >= left && x <= right && y >= top && y <= bottom
		}

		// 只在藍框內作畫，拖到外面就停在框線上
		_clampToCrop(shot, point) {
			const { left, top, right, bottom } = this._cropRect(shot)
			return { x: Math.min(Math.max(point.x, left), right), y: Math.min(Math.max(point.y, top), bottom) }
		}

		_startDrawing(e, shot) {
			e.preventDefault()
			this._focusEditor()
			e.currentTarget.setPointerCapture(e.pointerId)
			clearTimeout(this.syncTimer)

			const anchor = this._clampToCrop(shot, this._toShotPoint(shot, e))
			const id = this.nextItemId++
			const { x, y } = anchor
			const item = {
				pen: { id, type: 'pen', width: this.lineWidth, points: [[x, y]] },
				line: { id, type: 'line', width: this.lineWidth, x1: x, y1: y, x2: x, y2: y },
				arrow: { id, type: 'arrow', width: this.lineWidth, x1: x, y1: y, x2: x, y2: y },
				rect: { id, type: 'rect', width: this.lineWidth, x, y, w: 0, h: 0 },
				text: { id, type: 'text', size: this.textSize, x, y, w: 0, h: 0, text: '' },
			}[this.activeTool]
			shot.items.push(item)
			this.drawing = { shot, item, anchor }
			this.$editor.addClass('is_drawing')
			this._paintInk(shot)
		}

		_updateDrawing(e) {
			const { shot, item, anchor } = this.drawing
			const { x, y } = this._clampToCrop(shot, this._toShotPoint(shot, e))

			if (item.type === 'pen') {
				item.points.push([x, y])
			} else if (this._isLineLike(item)) {
				item.x2 = x
				item.y2 = y
			} else {
				item.x = Math.min(anchor.x, x)
				item.y = Math.min(anchor.y, y)
				item.w = Math.abs(x - anchor.x)
				item.h = Math.abs(y - anchor.y)
			}
			this._paintInk(shot)
		}

		_finishDrawing(isCommit) {
			const { shot, item } = this.drawing
			this.drawing = null
			this.$editor.removeClass('is_drawing')

			if (!isCommit || this._isMisclick(item)) {
				shot.items.splice(shot.items.indexOf(item), 1)
				this._renderMarks()
				if (this.pendingShots.size) this._syncSoon()
				return
			}
			if (item.type === 'text') {
				this._fitTextBox(shot, item)
				this.editingItem = item
			}
			// 剛畫好的直線、方框直接選取，滾輪就能馬上調粗細
			this.selectedItem = this._isLineLike(item) || item.type === 'rect' ? item : null
			this._renderMarks()
			this._markChanged(shot)
			log('畫圖', { 工具: item.type, 位於第幾張圖: this.shots.indexOf(shot) + 1 })
		}

		// 自由劃線點一下是一個點；方框和文字框都要拖曳出範圍才建立，只點一下不算
		_isMisclick(item) {
			if (this._isLineLike(item)) return Math.hypot(item.x2 - item.x1, item.y2 - item.y1) < MIN_LINE_LENGTH
			if (item.type === 'rect' || item.type === 'text') return item.w < MIN_BOX_SIZE || item.h < MIN_BOX_SIZE
			return false
		}

		// 拖得太小時放大到最小尺寸，仍限制在藍框內
		_fitTextBox(shot, item) {
			const { left, top, right, bottom } = this._cropRect(shot)
			item.w = Math.min(Math.max(item.w, MIN_TEXT_WIDTH), right - left)
			item.h = Math.min(Math.max(item.h, MIN_TEXT_HEIGHT), bottom - top)
			item.x = Math.max(Math.min(item.x, right - item.w), left)
			item.y = Math.max(Math.min(item.y, bottom - item.h), top)
		}

		_onTextInput(e) {
			const shot = $(e.currentTarget).closest('.js-shot').data('shot')
			const item = shot.items.find(entry => entry.id === $(e.currentTarget).closest('.js-item').data('id'))
			if (!item) return
			item.text = e.currentTarget.value
			this._growTextBox(shot, item)
			this._markChanged(shot)
		}

		// 字變多或變大時往下長，超出藍框就不再長；只改位置不重建元素，輸入法選字才不會被打斷
		_growTextBox(shot, item) {
			const textarea = this.$marks.find(`.js-item[data-id="${item.id}"] .js-item-text`)[0]
			if (!textarea) return

			const height = Math.min(textarea.scrollHeight, this._cropRect(shot).bottom - item.y)
			if (height <= item.h) return
			item.h = height
			this._placeItem(item)
		}

		_textLineHeight(item) {
			return Math.round((item.size ?? TEXT_SIZE) * TEXT_LINE_RATIO)
		}

		// 沒打字的文字框不留下來
		_onTextBlur = e => {
			if (this.isRendering || !$(e.target).is('.js-item-text')) return

			this.editingItem = null
			const shot = $(e.target).closest('.js-shot').data('shot')
			const item = shot.items.find(entry => entry.id === $(e.target).closest('.js-item').data('id'))
			if (item && !item.text.trim()) this._removeItem(shot, item.id)
		}

		// 直線拖兩端；方框、文字框拖左上角移動、拖右下角調整大小
		_startAdjust(e, $grip) {
			const shot = $grip.closest('.js-shot').data('shot')
			const item = shot.items.find(entry => entry.id === $grip.closest('.js-item').data('id'))
			this._beginAdjust(e, shot, item, $grip[0].dataset.part)
		}

		// 按到控制點或線條本身都會選取；part 為 move 時直線整條移動
		_beginAdjust(e, shot, item, part) {
			e.preventDefault()
			// 抓住正在輸入的文字框時不要失焦，否則還沒打字的框會被移除，移動完也能繼續打字
			if (this.$editor[0].getRootNode().activeElement !== e.target) this._focusEditor()
			e.currentTarget.setPointerCapture(e.pointerId)
			clearTimeout(this.syncTimer)

			this.selectedItem = item.type === 'text' ? null : item
			this.adjusting = { shot, item, part, x: e.clientX, y: e.clientY, origin: { ...item }, hasMoved: false }
			this.$editor.addClass('is_drawing')
			this._syncShots()
		}

		// 找出游標底下的直線、方框或文字框，後畫的在上面；框只有框線算數，框內才能再畫東西或打字
		_hitItem(shot, e) {
			const { x, y } = this._toShotPoint(shot, e)
			return [...shot.items].reverse().find(item => {
				const range = Math.max(HIT_TOLERANCE, (item.width ?? LINE_WIDTH) / 2 + 2)
				if (this._isLineLike(item)) return this._distanceToSegment(x, y, item) <= range
				if (item.type !== 'rect' && item.type !== 'text') return false
				const inset = item.type === 'text' ? TEXT_FRAME_INSET : range
				const isOutside = x < item.x - range || x > item.x + item.w + range || y < item.y - range || y > item.y + item.h + range
				const isInside = x > item.x + inset && x < item.x + item.w - inset && y > item.y + inset && y < item.y + item.h - inset
				return !isOutside && !isInside
			})
		}

		_distanceToSegment(x, y, { x1, y1, x2, y2 }) {
			const dx = x2 - x1
			const dy = y2 - y1
			const ratio = Math.min(Math.max(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy), 0), 1)
			return Math.hypot(x - (x1 + ratio * dx), y - (y1 + ratio * dy))
		}

		_applyAdjust(e) {
			const { shot, item, part, origin } = this.adjusting
			const dx = e.clientX - this.adjusting.x
			const dy = e.clientY - this.adjusting.y
			const { left, top, right, bottom } = this._cropRect(shot)

			if (part === 'end1' || part === 'end2') {
				const key = part === 'end1' ? 1 : 2
				const point = this._clampToCrop(shot, { x: origin[`x${key}`] + dx, y: origin[`y${key}`] + dy })
				item[`x${key}`] = point.x
				item[`y${key}`] = point.y
			} else if (part === 'move' && this._isLineLike(item)) {
				// 整條一起移動，兩端都要留在藍框內
				const moveX = Math.min(Math.max(dx, left - Math.min(origin.x1, origin.x2)), right - Math.max(origin.x1, origin.x2))
				const moveY = Math.min(Math.max(dy, top - Math.min(origin.y1, origin.y2)), bottom - Math.max(origin.y1, origin.y2))
				item.x1 = origin.x1 + moveX
				item.y1 = origin.y1 + moveY
				item.x2 = origin.x2 + moveX
				item.y2 = origin.y2 + moveY
			} else if (part === 'move') {
				item.x = Math.max(Math.min(origin.x + dx, right - item.w), left)
				item.y = Math.max(Math.min(origin.y + dy, bottom - item.h), top)
			} else {
				const isText = item.type === 'text'
				item.w = Math.min(Math.max(origin.w + dx, isText ? MIN_TEXT_WIDTH : MIN_BOX_SIZE), right - item.x)
				item.h = Math.min(Math.max(origin.h + dy, isText ? MIN_TEXT_HEIGHT : MIN_BOX_SIZE), bottom - item.y)
			}
			this.adjusting.hasMoved = true
			this._placeItem(item)
			this._paintInk(shot)
		}

		_removeItem(shot, id, { keepRedo = false } = {}) {
			const index = shot.items.findIndex(item => item.id === Number(id))
			if (index < 0) return

			shot.items.splice(index, 1)
			this._renderMarks()
			this._markChanged(shot, { keepRedo })
		}

		// 內容有變動：存草稿，等一下再更新右側欄圖片
		// 除了復原、重做本身，任何編輯都會清掉這個藍框的重做紀錄，和一般編輯軟體一樣
		_markChanged(shot, { keepRedo = false } = {}) {
			if (!keepRedo) this.redoStacks.delete(shot)
			this._saveSoon()
			this.pendingShots.add(shot)
			this._syncSoon()
		}

		// 按住藍框左上角的點移動，按住右下角的點調整大小；畫的內容不跟著動
		_applyMove(e) {
			const { box, $el, isResize, origin, shot } = this.moving
			const dx = (e.clientX - this.moving.x) / shot.viewportWidth
			const dy = (e.clientY - this.moving.y) / shot.viewportHeight

			if (isResize) {
				box.w = Math.min(Math.max(origin.w + dx, MIN_SHOT_SIZE / shot.viewportWidth), 1 - origin.x)
				box.h = Math.min(Math.max(origin.h + dy, MIN_SHOT_SIZE / shot.viewportHeight), 1 - origin.y)
			} else {
				// 只能在所屬截圖的範圍內移動，超出就不在圖上了
				box.x = Math.min(Math.max(origin.x + dx, 0), 1 - box.w)
				box.y = Math.min(Math.max(origin.y + dy, 0), 1 - box.h)
			}
			this.moving.hasMoved = true
			$el.css(this._boxStyle(box))
			this._syncCropLayout($el.filter('.js-box'), shot)
			this._paintDim()
		}

		// 移動或調整後等一下才更新，連續拖曳時不會一直重繪
		_syncSoon() {
			clearTimeout(this.syncTimer)
			this.syncTimer = setTimeout(() => this._syncPendingShots(), SYNC_DELAY)
		}

		async _syncPendingShots() {
			// 正在框選、畫圖或截圖時先不動，避免畫面閃爍打斷操作
			if (this.dragStart || this.moving || this.drawing || this.adjusting || this.isBusy) {
				this._syncSoon()
				return
			}

			const shots = [...this.pendingShots].filter(shot => this.shots.includes(shot))
			this.pendingShots.clear()
			shots.forEach(shot => this._refreshPanelImage(shot))
			log('同步右側欄圖片', { 更新張數: shots.length })
		}

		_boxStyle(box) {
			return { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }
		}

		// 只復原畫的內容，不動藍框（藍框用 × 移除）。沒有 focus 時復原最上層、有畫內容的藍框；其他頁的看不到，不會被復原到
		_undo() {
			// 顯示位置時不能編輯
			if (this._isLocating()) return
			const shots = this._visibleShots()
			const shot = shots.includes(this.focusedShot) ? this.focusedShot : shots.filter(item => item.items.length).sort((a, b) => b.z - a.z)[0]
			const last = shot?.items[shot.items.length - 1]
			if (!last) return

			// 拿掉的內容先記下來，Ctrl+Y 可以放回去
			this._removeItem(shot, last.id, { keepRedo: true })
			const stack = this.redoStacks.get(shot) || []
			stack.push(last)
			this.redoStacks.set(shot, stack)
		}

		// 重做：把最後一次復原拿掉的內容放回去。沒有 focus 時重做最上層、有重做紀錄的藍框
		_redo() {
			if (this._isLocating()) return
			const shots = this._visibleShots()
			const shot = shots.includes(this.focusedShot) ? this.focusedShot : shots.filter(item => this.redoStacks.has(item)).sort((a, b) => b.z - a.z)[0]
			const stack = this.redoStacks.get(shot)
			if (!stack) return

			const item = stack.pop()
			if (!stack.length) this.redoStacks.delete(shot)
			shot.items.push(item)
			// 放回的直線、方框直接選取，和剛畫好時一樣
			this.selectedItem = this._isLineLike(item) || item.type === 'rect' ? item : null
			this._renderMarks()
			this._markChanged(shot, { keepRedo: true })
		}

		// 卡片先淡出再刪除；淡出中不能再按，避免重複刪除
		_removeCard(button) {
			const $card = $(button).closest('.js-image')
			if ($card.hasClass('is_removing')) return
			$card.addClass('is_removing')
			setTimeout(() => this._removeShot($(button).data('id')), CARD_FADE_DELAY)
		}

		_removeShot(id) {
			const shot = this.shots.find(item => item.id === String(id))
			if (!shot) return

			const isFrozen = shot === this.frozenShot
			// 放大中的圖被刪掉：同一張截圖還有其他藍框就留在這張截圖，否則換同一組（區塊或整頁）的下一張，沒有了就關閉
			const sibling = isFrozen ? this._visibleShots().find(item => item !== shot) : null
			const group = this._groupOf(shot)
			this._dropShot(shot)
			const next = isFrozen && !sibling ? this.shots.slice(this.galleryIndex).concat(this.shots).find(item => this._groupOf(item) === group) : null
			if (sibling) {
				this._showGalleryShot(this.shots.indexOf(sibling))
			} else if (next) {
				this._showGalleryShot(this.shots.indexOf(next))
			} else if (isFrozen) {
				this._closeGallery()
			}
			this._renderMarks()
			this._syncPanel()
			this._saveDraft()
			log('移除圖片', { 網址: shot.url, 目前總計: this._summary() })
		}

		_dropShot(shot) {
			this.shots.splice(this.shots.indexOf(shot), 1)
			this.redoStacks.delete(shot)
			if (this.focusedShot === shot) this.focusedShot = null
			if (this.frozenShot === shot) this.frozenShot = null
			this.pendingShots.delete(shot)
			shot.bitmap.close()
			this._removeStored([`${IMAGE_KEY_PREFIX}${shot.id}`])
		}

		// 整頁截圖不疊在網頁上顯示，只在截圖清單裡
		_pageShots() {
			return this.shots.filter(shot => shot.url === location.href && !shot.isFullPage)
		}

		_summary() {
			return { 畫的內容: this.shots.reduce((total, shot) => total + shot.items.length, 0), 圖片數: this.shots.length, 本頁圖片數: this._pageShots().length }
		}

		// 只畫這一頁的內容，其他頁的在圖片庫查看
		_renderMarks() {
			// 沒打字就離開的文字框不留下來
			this.shots.forEach(shot => {
				shot.items = shot.items.filter(item => item.type !== 'text' || item.text.trim() || item === this.editingItem)
			})
			this.isRendering = true
			this.$marks.empty()
			this.isRendering = false
			this.inks.clear()

			this._renderBackdrop()
			this.$editor.toggleClass('is_locate', this._isLocating())
			this._visibleShots().forEach(shot => {
				if (shot.isDetached && shot !== this.focusedShot && !this.frozenShot) return

				// 尺寸要等於截圖時的視窗（含捲軸），遮罩不含捲軸，用 100% 會讓藍框和截圖對不上
				const $shot = $('<div class="screenshot_shot js-shot"></div>').data('shot', shot).css({ width: shot.viewportWidth, height: shot.viewportHeight, zIndex: shot.z }).toggleClass('is_fullPage', Boolean(shot.isFullPage))
				const ink = document.createElement('canvas')
				ink.className = 'screenshot_ink'
				ink.width = Math.round(shot.viewportWidth * window.devicePixelRatio)
				ink.height = Math.round(shot.viewportHeight * window.devicePixelRatio)
				this.inks.set(shot, ink)
				$shot.append(this._cropMask(shot), ink, shot.items.filter(item => item.type !== 'pen').map(item => this._itemElement(item)), this._cropElement(shot))
				this.$marks.append($shot)
				this._paintInk(shot)
			})
			this._syncShots()
			this._syncFocusUI()
			this._syncPanelToggle()
			this._syncGalleryNav()
			this._setStatus()
			if (this.editingItem) this.$marks.find(`.js-item[data-id="${this.editingItem.id}"] .js-item-text`)[0]?.focus({ preventScroll: true })
		}

		// 凍結的底圖：放大時用放大中的圖，截圖模式用凍結畫面；同一張就不重畫
		// 直接用 canvas，避免被網站 CSP 的 img-src 擋下
		_renderBackdrop() {
			const source = this.frozenShot || (this.isCapture ? this.screen : null)
			// 放大中換到同一張截圖的另一個藍框，底圖相同不用重畫
			const key = source ? this._screenIdOf(source) : null
			if (key === this.backdropSource) return

			this.backdropSource = key
			this.$backdrop.empty().prop('hidden', !source)
			if (!source) return

			const canvas = document.createElement('canvas')
			canvas.width = source.bitmap.width
			canvas.height = source.bitmap.height
			// 尺寸要等於截圖時的視窗，才會和藍框對齊
			$(canvas).css({ width: source.viewportWidth, height: source.viewportHeight })
			canvas.getContext('2d').drawImage(source.bitmap, 0, 0)
			this.$backdrop.append(canvas)
		}

		_paintInk(shot) {
			const ink = this.inks.get(shot)
			if (!ink) return

			const ratio = ink.width / shot.viewportWidth
			const ctx = ink.getContext('2d')
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
			ctx.clearRect(0, 0, shot.viewportWidth, shot.viewportHeight)
			this._paintItems(ctx, shot, false)
		}

		// 畫面和輸出共用，兩邊才會一致。文字在畫面上是文字框，輸出時才畫上去
		_paintItems(ctx, shot, isOutput) {
			ctx.strokeStyle = COLOR_MARK
			ctx.fillStyle = COLOR_MARK
			ctx.lineCap = 'round'
			ctx.lineJoin = 'round'

			shot.items.forEach(item => {
				ctx.lineWidth = item.width ?? LINE_WIDTH
				if (item.type === 'pen') {
					const [first, ...rest] = item.points
					ctx.beginPath()
					ctx.moveTo(first[0], first[1])
					// 只有一個點時也要畫得出來
					ctx.lineTo(first[0], first[1])
					rest.forEach(point => ctx.lineTo(point[0], point[1]))
					ctx.stroke()
				} else if (item.type === 'arrow') {
					this._paintArrow(ctx, item)
				} else if (item.type === 'line') {
					ctx.beginPath()
					ctx.moveTo(item.x1, item.y1)
					ctx.lineTo(item.x2, item.y2)
					ctx.stroke()
				} else if (item.type === 'rect') {
					ctx.strokeRect(item.x, item.y, item.w, item.h)
				} else if (isOutput) {
					this._paintText(ctx, item)
				} else if (item === this.drawing?.item) {
					// 拖曳文字框的範圍時，放開才會有輸入框，先畫虛線預覽
					ctx.save()
					ctx.lineWidth = 1
					ctx.setLineDash([4, 4])
					ctx.strokeRect(item.x, item.y, item.w, item.h)
					ctx.restore()
				}
			})
		}

		// 箭頭：終點畫實心三角形，大小跟著線條粗細；線只畫到三角形底部，圓頭才不會從尖端凸出來
		_paintArrow(ctx, item) {
			const angle = Math.atan2(item.y2 - item.y1, item.x2 - item.x1)
			const size = Math.max(ARROW_MIN_SIZE, (item.width ?? LINE_WIDTH) * ARROW_SIZE_RATIO)
			const back = size * Math.cos(ARROW_ANGLE)
			ctx.beginPath()
			ctx.moveTo(item.x1, item.y1)
			ctx.lineTo(item.x2 - back * Math.cos(angle), item.y2 - back * Math.sin(angle))
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(item.x2, item.y2)
			ctx.lineTo(item.x2 - size * Math.cos(angle - ARROW_ANGLE), item.y2 - size * Math.sin(angle - ARROW_ANGLE))
			ctx.lineTo(item.x2 - size * Math.cos(angle + ARROW_ANGLE), item.y2 - size * Math.sin(angle + ARROW_ANGLE))
			ctx.closePath()
			ctx.fill()
		}

		// 直線和箭頭都由兩個端點組成，選取、移動、調整的方式相同
		_isLineLike(item) {
			return item.type === 'line' || item.type === 'arrow'
		}

		// 超出文字框的部分裁掉，和畫面上一樣
		_paintText(ctx, item) {
			ctx.save()
			ctx.beginPath()
			ctx.rect(item.x, item.y, item.w, item.h)
			ctx.clip()
			ctx.font = `700 ${item.size ?? TEXT_SIZE}px ${FONT_FAMILY}`
			ctx.textAlign = 'left'
			ctx.textBaseline = 'middle'
			const lineHeight = this._textLineHeight(item)
			const lines = item.text.split('\n').flatMap(line => this._wrapText(ctx, line, item.w - TEXT_PADDING * 2))
			lines.forEach((line, index) => {
				ctx.fillText(line, item.x + TEXT_PADDING, item.y + TEXT_PADDING + lineHeight * (index + .5))
			})
			ctx.restore()
		}

		// 遮罩只蓋住這張圖的範圍，捲動到別處時不會把其他內容也變暗
		_cropMask(shot) {
			const $mask = $('<div class="screenshot_crop_mask"><div class="screenshot_crop_shade js-crop-box"></div></div>')
			$mask.find('.js-crop-box').css(this._boxStyle(shot.crop))
			return $mask
		}

		_cropElement(shot) {
			const $crop = $(`
				<div class="screenshot_crop js-crop-box js-box">
					<span class="_move js-crop-move" title="按住拖曳可移動藍框">${this._shotNumber(shot)}</span>
					<button class="_remove js-crop-remove" type="button" aria-label="移除藍框和裡面畫的內容">×</button>
					${SHOT_TOOLS}
					${DRAW_TOOLS}
					<span class="_handle js-crop-handle" title="拖曳調整大小"></span>
				</div>
			`)
			$crop.css(this._boxStyle(shot.crop))
			return $crop
		}

		// 放大中的整頁截圖：圖比畫面高，要能捲動
		_isScrollShot(shot) {
			return Boolean(shot?.isFullPage) && shot === this.frozenShot
		}

		// 整頁截圖的框元素只對齊畫面上看得到的範圍（框的位置用圖上的座標），複製、下載和畫圖工具列才會一直在畫面內
		_scrollShotBox(shot) {
			const { clientWidth, clientHeight } = this.$stage[0]
			return { left: 0, top: this.galleryScrollY, width: Math.min(shot.viewportWidth, clientWidth), height: Math.min(shot.viewportHeight, clientHeight) }
		}

		_scrollGallery(delta) {
			const shot = this.frozenShot
			if (!shot?.isFullPage || this.drawing || this.adjusting || this.moving) return

			const max = Math.max(0, shot.viewportHeight - this.$stage[0].clientHeight)
			const next = Math.min(Math.max(this.galleryScrollY + delta, 0), max)
			if (next === this.galleryScrollY) return
			this.galleryScrollY = next
			this._syncShots()
		}

		// 框貼齊視窗邊緣時，× 和工具列超出去就按不到了，要改放框內
		_syncCropLayout($box, shot) {
			const { clientWidth, clientHeight } = this.$stage[0]
			// 整頁截圖的框元素就是畫面範圍，工具列一律放框內
			const { left, top, right, bottom } = this._isScrollShot(shot) ? { left: 0, top: 0, right: clientWidth, bottom: clientHeight } : this._cropRect(shot)
			$box.toggleClass('is_tools_inside', right > clientWidth - TOOLS_WIDTH)
			$box.toggleClass('is_remove_inside', top < REMOVE_OFFSET || right > clientWidth - REMOVE_OFFSET)
			$box.toggleClass('is_draw_inside', bottom > clientHeight - DRAW_BAR_HEIGHT)
			$box.toggleClass('is_draw_end', left + DRAW_BAR_WIDTH > clientWidth)
		}

		// 直線、方框、文字框的控制點；元素鋪滿整張圖，裡面各自定位
		_itemElement(item) {
			const grip = (part, title) => `<span class="_grip js-item-grip" data-part="${part}" title="${title}"></span>`
			const grips = this._isLineLike(item)
				? grip('end1', '拖曳調整端點') + grip('end2', '拖曳調整端點')
				: grip('move', '按住拖曳可移動') + grip('resize', '拖曳調整大小')
			const text = item.type === 'text' ? '<textarea class="_text js-item-text" aria-label="文字" tabindex="-1"></textarea>' : ''
			const $item = $(`
				<div class="screenshot_item js-item" data-id="${item.id}">
					${text}
					${grips}
					<button class="_remove js-item-remove" type="button" aria-label="刪除">×</button>
				</div>
			`)
			$item.find('.js-item-text').val(item.text)
			this._placeControls($item, item)
			return $item
		}

		_placeItem(item) {
			this._placeControls(this.$marks.find(`.js-item[data-id="${item.id}"]`), item)
		}

		// 只改位置，不重建元素：拖曳中的點和輸入中的文字框都不能被換掉
		_placeControls($item, item) {
			const { clientWidth, clientHeight } = this.$stage[0]
			// 貼齊視窗邊緣時，控制點超出去就按不到了；整頁截圖會捲動，座標不是畫面位置，不限制
			const isFree = Boolean(this.frozenShot?.isFullPage)
			const clamp = (value, max) => isFree ? value : Math.min(Math.max(value, CONTROL_MARGIN), max - CONTROL_MARGIN)
			const place = (selector, x, y) => $item.find(selector).css({ left: clamp(x, clientWidth), top: clamp(y, clientHeight) })

			if (this._isLineLike(item)) {
				place('[data-part="end1"]', item.x1, item.y1)
				place('[data-part="end2"]', item.x2, item.y2)
				place('.js-item-remove', item.x2 + 14, item.y2 - 14)
				return
			}
			place('[data-part="move"]', item.x, item.y)
			place('[data-part="resize"]', item.x + item.w, item.y + item.h)
			place('.js-item-remove', item.x + item.w, item.y)
			$item.find('.js-item-text').css({ left: item.x, top: item.y, width: item.w, height: item.h, fontSize: item.size ?? TEXT_SIZE, lineHeight: `${this._textLineHeight(item)}px` })
		}

		// 藍框和畫的內容跟著網頁捲動
		_syncShots() {
			// 底圖跟著放大中的整頁截圖捲動
			this.$backdrop[0].style.transform = this._isScrollShot(this.frozenShot) ? `translateY(${-this.galleryScrollY}px)` : ''
			this.$marks.children('.js-shot').each((_, el) => {
				const shot = $(el).data('shot')
				const offset = this._shotOffset(shot)
				el.style.transform = `translate(${offset.x}px, ${offset.y}px)`
				if (this._isScrollShot(shot)) $(el).children('.js-box').css(this._scrollShotBox(shot))
				$(el).toggleClass('is_focus', shot === this.focusedShot)
				// 放大中目前這張、沒選取時，加外框標出頁數指的是哪個藍框
				$(el).toggleClass('is_current', Boolean(this.frozenShot) && shot === this.frozenShot && shot !== this.focusedShot)
				el.style.zIndex = shot.z
				// 選文字工具時才能點進文字框，其他工具要能畫在文字上面
				$(el).toggleClass('is_tool_text', this.activeTool === 'text')
				// 顯示位置時只是標示，不顯示複製、下載和畫圖工具
				const $box = $(el).children('.js-box').toggleClass('is_tools', shot === this.focusedShot && !this._isLocating())
				this._syncCropLayout($box, shot)
				$box.find('.js-draw-tool').each((_, tool) => $(tool).toggleClass('is_active', tool.dataset.tool === this.activeTool))
				const selected = this._selectedOf(shot)
				$(el).find('.js-item').each((_, item) => $(item).toggleClass('is_selected', $(item).data('id') === selected?.id))
				$box.find('.js-draw-size').text(`${selected ? selected.width ?? LINE_WIDTH : this.activeTool === 'text' ? this.textSize : this.lineWidth}px`)
			})
			this._paintDim()
			// 換工具、換粗細、取消選取時，紅點跟著更新
			this._syncBrush()
		}

		// 凍結底圖上的黑底：整片塗暗，再挖空畫面上每個藍框和框選中的範圍；沒有凍結底圖（一般模式）時不顯示
		// 移動藍框、框選時每次 pointermove 都會重畫，只有填色和清除，成本很低
		_paintDim() {
			const isOn = !this.$backdrop.prop('hidden')
			this.$dim.prop('hidden', !isOn)
			if (!isOn) return

			const canvas = this.$dim[0]
			const { clientWidth: width, clientHeight: height } = this.$stage[0]
			const ratio = window.devicePixelRatio
			if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio)
			if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio)

			const ctx = canvas.getContext('2d')
			ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
			ctx.clearRect(0, 0, width, height)
			ctx.fillStyle = COLOR_DIM
			ctx.fillRect(0, 0, width, height)
			// 只挖空實際畫在畫面上的藍框
			this.$marks.children('.js-shot').each((_, el) => {
				const shot = $(el).data('shot')
				const { x, y } = this._shotOffset(shot)
				const { left, top, right, bottom } = this._cropRect(shot)
				ctx.clearRect(left + x, top + y, right - left, bottom - top)
			})
			if (this.dragStart) {
				const rect = this._dragRect()
				ctx.clearRect(rect.left, rect.top, rect.width, rect.height)
			}
		}

		// 拖曳右側欄左邊界調整寬度；放開時存進草稿，換頁接回時沿用
		_startPanelResize(e) {
			if (e.button !== 0) return
			e.preventDefault()
			const handle = e.currentTarget
			handle.setPointerCapture(e.pointerId)
			this.$editor.addClass('is_panel_resizing')

			const onMove = moveEvent => this._setPanelWidth(window.innerWidth - moveEvent.clientX)
			const onUp = () => {
				handle.removeEventListener('pointermove', onMove)
				handle.removeEventListener('pointerup', onUp)
				handle.removeEventListener('pointercancel', onUp)
				this.$editor.removeClass('is_panel_resizing')
				this._saveDraft()
				log('調整截圖清單寬度', { 寬度: this.panelWidth })
			}
			handle.addEventListener('pointermove', onMove)
			handle.addEventListener('pointerup', onUp)
			handle.addEventListener('pointercancel', onUp)
		}

		// 截圖清單：一排一張（16:9）或一排多張（1:1）
		_setPanelCols(cols, { isSave = true } = {}) {
			this.panelCols = cols === 1 ? 1 : 2
			const label = this.panelCols === 1 ? '一排一張' : '一排多張'
			const next = this.panelCols === 1 ? '一排多張' : '一排一張'
			this.$panelImages.toggleClass('is_single', this.panelCols === 1)
			this.$panelCols.html(this.panelCols === 1 ? ICON_COLS_1 : ICON_COLS_2).attr({ 'title': `${label}（按一下改成${next}）`, 'aria-label': `改成${next}` })
			if (isSave) this._saveDraft()
		}

		_setPanelWidth(width) {
			const max = Math.min(PANEL_MAX_WIDTH, window.innerWidth - PANEL_PAGE_GAP)
			this.panelWidth = Math.round(Math.min(Math.max(width, PANEL_MIN_WIDTH), Math.max(max, PANEL_MIN_WIDTH)))
			this.$panel.css('--panel-width', `${this.panelWidth}px`)
		}

		_isPanelOpen() {
			return !this.$panel.prop('hidden')
		}

		_togglePanel() {
			this._isPanelOpen() ? this._closePanel() : this._openPanel()
		}

		// 右側欄不擋操作，開著也能繼續框選，圖片即時同步
		// 工具列移進右側欄最上方；先記下拖曳到的位置再清掉，收合時放回原處
		_openPanel() {
			const toolbar = this.$toolbar[0]
			this.toolbarPos = this.$toolbar.hasClass('is_moved') ? { left: toolbar.offsetLeft, top: toolbar.offsetTop } : null
			this.$toolbar.removeClass('is_moved').css({ left: '', top: '' })
			this.$panel.prepend(this.$toolbar).prop('hidden', false)
			this.$panelEdge.prop('hidden', true)
			this.$toggle.attr('aria-expanded', 'true')
			this._syncPanelToggle()
			this._syncPanel()
			this._saveDraft()
			log('展開圖片清單', this._summary())
		}

		// 右側欄收合時不必更新，展開時會重新產生
		_syncPanel() {
			if (!this._isPanelOpen()) return

			// 張數用紅色圓點顯示；沒有圖時不顯示
			this.$panelTitleCount.text(this.shots.length || '')
			this.$panelTabs.each((_, tab) => {
				const isActive = tab.dataset.tab === this.panelTab
				$(tab).attr('aria-selected', String(isActive)).toggleClass('is_active', isActive)
				$(tab).find('.js-tab-count').text(this._groupShots(tab.dataset.tab).length || '')
			})
			const shots = this._groupShots(this.panelTab)
			this.$panelEmpty.prop('hidden', shots.length > 0).text(this.panelTab === 'page' ? '還沒有整頁截圖，截圖模式下在空白處雙擊中鍵。' : '還沒有截圖，進入截圖模式後框選範圍。')
			this.$panelImages.empty()

			shots.forEach((shot, index) => {
				const $item = $(`
					<figure class="screenshot_image js-image" data-shot-id="${shot.id}">
						<figcaption class="screenshot_image--head">
							<span class="screenshot_image_index" title="第 ${index + 1} 張${shot.isFullPage ? '' : '，對應藍框左上角的編號'}">${index + 1}</span>
							<span class="screenshot_image_url js-image-url"></span>
							<button class="screenshot_image_copyUrl js-image-copy-url" type="button" title="複製網址" aria-label="複製網址">${ICON_COPY}</button>
							<button class="screenshot_image_remove js-image-remove" type="button" data-id="${shot.id}" title="刪除此圖" aria-label="刪除此圖">${ICON_TRASH}</button>
						</figcaption>
						<div class="screenshot_image--frame js-image-frame">
							<div class="screenshot_imageTools">
								<button class="_tool _tool_view js-shot-goto" type="button" title="在網頁上顯示位置" aria-label="在網頁上顯示位置">${ICON_EYE}</button>
								<button class="_tool _tool_copy js-shot-copy" type="button" title="複製圖片" aria-label="複製圖片">${ICON_COPY}</button>
								<button class="_tool _tool_download js-shot-download" type="button" title="下載圖片" aria-label="下載圖片">${ICON_DOWNLOAD}</button>
							</div>
						</div>
					</figure>
				`)
				// 只顯示網域和路徑，太長由 CSS 截斷；完整網址放在 title
				$item.find('.js-image-url').text(this._displayUrl(shot.url)).attr('title', shot.url)
				$item.find('.js-image-frame').prepend(this._thumbnail(shot))
				this.$panelImages.append($item)
			})
			this._syncFocusUI()
		}

		_setPanelTab(tab) {
			if (tab === this.panelTab) return
			this.panelTab = tab
			this._syncPanel()
		}

		// 截圖分兩組：區塊（藍框）、整頁；編號、放大切換都在同一組內
		_groupOf(shot) {
			return shot.isFullPage ? 'page' : 'block'
		}

		_groupShots(group) {
			return this.shots.filter(shot => this._groupOf(shot) === group)
		}

		_shotNumber(shot) {
			return this._groupShots(this._groupOf(shot)).indexOf(shot) + 1
		}

		// 只重畫動過的那張，其他圖片不用跟著重繪
		_refreshPanelImage(shot) {
			if (!this._isPanelOpen()) return
			this.$panelImages.find(`[data-shot-id="${shot.id}"] canvas`).replaceWith(this._thumbnail(shot))
		}

		// 直接用 canvas 當縮圖，避免被網站 CSP 的 img-src 擋下
		_thumbnail(shot) {
			const canvas = this._renderShot(shot)
			canvas.className = 'js-image-zoom'
			canvas.title = '放大編輯'
			return canvas
		}

		// 清單圖片的眼睛：在網頁上顯示位置；截圖模式中先回到一般模式
		async _viewShot(shot) {
			if (!shot) return
			if (this.isCapture) await this.toggleCapture()
			this._focusShot(shot)
		}

		// 顯示位置：只有藍框實線，不含複製、下載和畫的內容，平滑捲到當時的位置；不在此頁就詢問是否前往
		_focusShot(shot) {
			// _viewShot 已先離開截圖模式；正在截圖（isBusy）離開不了時就不顯示
			if (!shot || this.isCapture) return

			this.focusedShot = shot
			if (shot.url !== location.href) {
				this._syncFocusUI()
				this._showDialog(shot)
				return
			}
			// 整頁截圖不疊在網頁上，整個網頁外框持續閃爍表示就是這一頁
			if (shot.isFullPage) {
				this._syncFocusUI()
				this._flashPage()
				return
			}

			window.scrollTo({ left: shot.scrollX, top: shot.scrollY, behavior: 'smooth' })
			this._renderMarks()
			// 只有點右側欄圖片才閃動提示，按藍框時不閃
			this.$marks.children('.is_focus').addClass('is_pulse')
			log('顯示圖片', { 第幾張: this.shots.indexOf(shot) + 1, 畫的內容: shot.items.length })
		}

		// 重新加 class 讓動畫從頭播放；持續閃爍，取消顯示位置時由 _syncFocusUI 移除
		_flashPage() {
			this.$stage.removeClass('is_flash')
			void this.$stage[0].offsetWidth
			this.$stage.addClass('is_flash')
		}

		// 只切換 class，不重建元素：按下點點時才開始拖曳，重建會讓拖曳對象消失
		_setFocus(shot) {
			if (shot && shot !== this.focusedShot) shot.z = this.nextZ++
			if (shot !== this.focusedShot) this.selectedItem = null
			this.focusedShot = shot
			this._syncShots()
			this._syncFocusUI()
		}

		_clearFocus() {
			if (this.focusedShot) this._setFocus(null)
		}

		// 右側欄圖片的選取外框，跟著 focus 狀態
		// 清單上的網址去掉 https:// 和結尾的 /，比較好讀
		_displayUrl(url) {
			try {
				const { host, pathname, search, hash } = new URL(url)
				return `${host}${pathname === '/' ? '' : pathname}${search}${hash}`
			} catch {
				return url
			}
		}

		_syncFocusUI() {
			// 放大中選取藍框編輯時，頁數、上下頁、右上按鈕都隱藏，不擋畫面
			this.$editor.toggleClass('is_gallery_focus', Boolean(this.frozenShot && this.focusedShot))
			// 整頁截圖的外框閃爍只在顯示位置時保留，收起、放大編輯、凍結時移除
			if (!(this.focusedShot?.isFullPage && this._isLocating())) this.$stage.removeClass('is_flash')
			this.$panelImages.children('.js-image').each((_, el) => {
				$(el).toggleClass('is_selected', el.dataset.shotId === this.focusedShot?.id)
			})
		}

		_showDialog(shot) {
			// 網址來自當時的 location.href，仍只接受 http(s)，避免產生可執行的連結
			if (!/^https?:/i.test(shot.url)) return

			this.$dialogLinks.attr('href', shot.url)
			this.$dialogUrl.text(shot.url)
			this.$dialog.prop('hidden', false)
			this.$editor.find('.js-dialog-go')[0].focus({ preventScroll: true })
			log('圖片不在目前頁面，詢問是否前往', shot.url)
		}

		_closeDialog() {
			this.$dialog.prop('hidden', true)
			this._focusEditor()
		}

		// ── 放大編輯 ───────────────────────────────────────
		// 底圖換成該張截圖、固定在原本的位置和大小，畫圖的功能和座標都和頁面上相同
		async _openGallery(shot) {
			if (!shot || this.isBusy) return

			this.isGalleryFromIdle = !this.isCapture
			if (this.isGalleryFromIdle) await this.toggleCapture({ isFreeze: false })
			this.$gallery.prop('hidden', false)
			this.$editor.addClass('is_gallery')
			this._showGalleryShot(this.shots.indexOf(shot))
			this._renderMarks()
			this._focusEditor()
			log('放大圖片', { 第幾張: this.galleryIndex + 1 })
		}

		_closeGallery() {
			this._closeHelp()
			this.frozenShot = null
			this.focusedShot = null
			this.$gallery.prop('hidden', true)
			this.$editor.removeClass('is_gallery')
			if (this.isGalleryFromIdle) {
				this.toggleCapture()
			} else {
				this._renderMarks()
			}
			this._focusEditor()
		}

		// 只在同一組（區塊或整頁）內循環切換
		_moveGallery(step) {
			const group = this._groupShots(this._groupOf(this.frozenShot))
			const index = (group.indexOf(this.frozenShot) + step + group.length) % group.length
			this._showGalleryShot(this.shots.indexOf(group[index]))
			this._renderMarks()
		}

		_showGalleryShot(index) {
			this.galleryIndex = index
			const shot = this.shots[index]
			if (shot !== this.frozenShot) this.galleryScrollY = 0
			this.frozenShot = shot
			// 進入時不選取藍框，目前這張以外框標出（is_current）；點藍框才開始編輯
			this.focusedShot = null
			shot.z = this.nextZ++
			this._syncGalleryNav()
		}

		// 放大中新增或移除藍框，總張數會變
		_syncGalleryNav() {
			if (!this.frozenShot) return
			const group = this._groupShots(this._groupOf(this.frozenShot))
			this.$galleryNav.prop('hidden', group.length < 2)
			this.$galleryCount.text(`${this.frozenShot.isFullPage ? '整頁 ' : ''}${group.indexOf(this.frozenShot) + 1} / ${group.length}`)
		}

		_closePanel() {
			this.$panel.prop('hidden', true)
			this.$toolbar.insertAfter(this.$panel)
			// 回到展開前的位置；視窗可能變小過，仍限制在視窗內
			if (this.toolbarPos) {
				this.$toolbar.addClass('is_moved')
				this._placeToolbar(this.toolbarPos.left, this.toolbarPos.top)
			}
			this.$panelEdge.prop('hidden', false)
			this.$toggle.attr('aria-expanded', 'false')
			this._syncPanelToggle()
			this._focusEditor()
			this._saveDraft()
		}

		// 工具列在右側欄內時按鈕是收合，張數已顯示在清單標題；沒有圖時不顯示張數
		_syncPanelToggle() {
			const isOpen = this._isPanelOpen()
			const count = this.shots.length
			const title = isOpen ? '收合截圖清單' : `截圖清單（${count} 張）`
			this.$toggle.attr({ 'title': title, 'aria-label': title })
			this.$panelCount.text(isOpen || !count ? '' : count)
		}

		// 清除無法復原，第一次按只提醒
		_requestClearDraft() {
			if (!this.isClearPending) {
				this.isClearPending = true
				this.$panelClear.text('再按一次確認移除')
				this.clearTimer = setTimeout(() => this._resetClearButton(), 3000)
				return
			}
			clearTimeout(this.clearTimer)
			this._resetClearButton()
			this._clearDraft()
		}

		_resetClearButton() {
			this.isClearPending = false
			this.$panelClear.text('全部移除')
		}

		async _clearDraft() {
			// 依前綴全部移除，連中途失敗留下的孤兒圖片也一併清掉，否則會一直佔硬碟空間
			const stored = await chrome.storage.local.get(null)
			const imageKeys = Object.keys(stored).filter(key => key.startsWith(IMAGE_KEY_PREFIX))
			this.shots.forEach(shot => shot.bitmap.close())
			this.shots = []
			this.focusedShot = null
			this.pendingShots.clear()
			this.redoStacks.clear()
			this._renderMarks()
			this._syncPanel()
			await this._removeStored(imageKeys)
			await this._saveDraft()
			log('已清除草稿')
		}

		// ── 草稿儲存與還原 ────────────────────────────────────
		_saveSoon() {
			clearTimeout(this.saveTimer)
			this.saveTimer = setTimeout(() => this._saveDraft(), SAVE_DELAY)
		}

		_flushSave = () => {
			if (this.saveTimer) this._saveDraft()
		}

		async _saveDraft() {
			clearTimeout(this.saveTimer)
			this.saveTimer = null
			const shots = this.shots.map(({ bitmap, dataUrl, isDetached, ...shot }) => shot)
			await this._writeStorage({ [DRAFT_KEY]: { editorId: this.editorId, shots, isPanelOpen: this._isPanelOpen(), panelWidth: this.panelWidth, panelCols: this.panelCols } })
		}

		async _saveImage(shot) {
			await this._writeStorage({ [`${IMAGE_KEY_PREFIX}${shot.id}`]: shot.dataUrl })
			shot.dataUrl = null
		}

		async _writeStorage(data) {
			try {
				await chrome.storage.local.set(data)
			} catch (error) {
				log('草稿儲存失敗', error)
				this._setStatus('草稿儲存失敗，請先刪除部分圖片')
			}
		}

		async _removeStored(keys) {
			try {
				await chrome.storage.local.remove(keys)
			} catch (error) {
				log('移除草稿圖片失敗', error)
			}
		}

		// 草稿沒有引用的圖片，介面上看不到也刪不掉，只會一直佔空間（舊版或中途失敗留下的）
		async _removeOrphanImages(shots) {
			const used = new Set(shots.map(shot => `${IMAGE_KEY_PREFIX}${shot.id}`))
			const keys = await chrome.storage.local.getKeys()
			const orphans = keys.filter(key => key.startsWith(IMAGE_KEY_PREFIX) && !used.has(key))
			if (!orphans.length) return

			await this._removeStored(orphans)
			log('已清除沒有被引用的舊圖片', { 張數: orphans.length })
		}

		async _restoreDraft() {
			const stored = await chrome.storage.local.get(DRAFT_KEY)
			const draft = stored[DRAFT_KEY]
			this.shouldOpenPanel = this.isResume && Boolean(draft?.isPanelOpen)
			if (draft?.panelWidth) this._setPanelWidth(draft.panelWidth)
			this._setPanelCols(draft?.panelCols ?? this.panelCols, { isSave: false })
			await this._removeOrphanImages(draft?.shots || [])
			if (!draft?.shots?.length) return

			const keys = draft.shots.map(shot => `${IMAGE_KEY_PREFIX}${shot.id}`)
			const images = await chrome.storage.local.get(keys)

			for (const shot of draft.shots) {
				const dataUrl = images[`${IMAGE_KEY_PREFIX}${shot.id}`]
				if (!dataUrl) {
					log('草稿圖片遺失，略過', shot.url)
					continue
				}
				// 舊版草稿的紅框和全螢幕標記不沿用，沒有藍框的圖就框住整張
				const { marks, isFull, ...rest } = shot
				this.shots.push({ ...rest, crop: shot.crop || { x: 0, y: 0, w: 1, h: 1 }, items: shot.items || [], bitmap: await createImageBitmap(this._dataUrlToBlob(dataUrl)), dataUrl: null, isDetached: false })
			}

			const items = this.shots.flatMap(shot => shot.items)
			this.nextItemId = Math.max(0, ...items.map(item => item.id)) + 1
			this.nextZ = Math.max(0, ...this.shots.map(shot => shot.z)) + 1
			log('已還原草稿', this._summary())
		}

		// ── 輸出圖片 ──────────────────────────────────────────
		// 只留藍框內的範圍；畫的內容超出藍框的部分也會被裁掉
		_renderShot(shot) {
			const { width, height } = shot.bitmap
			const { crop } = shot
			const canvas = document.createElement('canvas')
			canvas.width = Math.max(1, Math.round(crop.w * width))
			canvas.height = Math.max(1, Math.round(crop.h * height))
			const ctx = canvas.getContext('2d')
			ctx.translate(-crop.x * width, -crop.y * height)
			ctx.drawImage(shot.bitmap, 0, 0)
			ctx.scale(shot.scale, shot.scale)
			this._paintItems(ctx, shot, true)
			return canvas
		}

		// 逐字換行，中文和長網址都沒有空白可斷
		_wrapText(ctx, text, maxWidth) {
			const lines = []
			let line = ''
			for (const char of text) {
				if (line && ctx.measureText(line + char).width > maxWidth) {
					lines.push(line)
					line = char
				} else {
					line += char
				}
			}
			lines.push(line)
			return lines
		}

		_canvasToBlob(canvas) {
			return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
		}

		// 按鈕在框上或右側欄的圖片下方
		_shotOfTool(e) {
			const $tool = $(e.currentTarget)
			return $tool.closest('.js-shot').data('shot') || this.shots.find(shot => shot.id === $tool.closest('.js-image')[0]?.dataset.shotId)
		}

		// 複製成功才顯示快照
		async _copy(shot) {
			if (!shot) return

			if (!navigator.clipboard?.write) {
				this._setStatus('此頁面不支援複製（http 網站）')
				return
			}
			try {
				const canvas = this._renderShot(shot)
				const blob = await this._canvasToBlob(canvas)
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
				const index = this._shotNumber(shot)
				this._showSnapshot(canvas, `已複製第 ${index} 張圖片`)
				log('複製圖片', { 第幾張: index, 大小KB: Math.round(blob.size / 1024) })
			} catch (error) {
				log('複製失敗', error)
				this._setStatus('複製失敗')
			}
		}

		async _copyUrl(shot) {
			if (!shot) return

			if (!navigator.clipboard?.writeText) {
				this._setStatus('此頁面不支援複製（http 網站）')
				return
			}
			try {
				await navigator.clipboard.writeText(shot.url)
				this._setStatus(`已複製第 ${this._shotNumber(shot)} 張的網址`)
			} catch (error) {
				log('複製網址失敗', error)
				this._setStatus('複製失敗')
			}
		}

		// 內容和複製的相同
		async _download(shot) {
			if (!shot) return

			const canvas = this._renderShot(shot)
			const blob = await this._canvasToBlob(canvas)
			const url = URL.createObjectURL(blob)
			const index = this._shotNumber(shot)
			const filename = `screenshot_${this._timestamp()}_${index}.png`
			const link = document.createElement('a')
			link.href = url
			link.download = filename
			link.click()
			setTimeout(() => URL.revokeObjectURL(url), 1000)
			this._showSnapshot(canvas, `已下載第 ${index} 張圖片`)
			log('下載圖片', { 第幾張: index, 檔名: filename, 大小KB: Math.round(blob.size / 1024) })
		}

		// 顯示實際輸出的圖片，過幾秒自動消失；每次重建元素，動畫才會重新播放
		// 畫面上方中間的提示，顯示一段時間後淡出（淡出由 CSS 動畫處理）
		showHint() {
			clearTimeout(this.hintTimer)
			this.$hint?.remove()
			this.$hint = $('<p class="screenshot_hint" role="status"></p>').text(HINT_TEXT)
			this.$editor.append(this.$hint)
			this.hintTimer = setTimeout(() => this.$hint?.remove(), HINT_DELAY)
		}

		_showSnapshot(canvas, text) {
			clearTimeout(this.snapshotTimer)
			this.$snapshot?.remove()

			this.$snapshot = $('<div class="screenshot_snapshot" role="status"><p class="_text"></p></div>')
			this.$snapshot.find('._text').text(text)
			this.$snapshot.append(canvas)
			this.$editor.append(this.$snapshot)
			this.snapshotTimer = setTimeout(() => this.$snapshot?.remove(), SNAPSHOT_DELAY)
		}

		// 有提示時顯示幾秒，再回到目前模式
		// 倒數中沒有其他提示時，狀態文字顯示倒數（is_countdown 醒目顯示）
		_setStatus(message) {
			clearTimeout(this.statusTimer)
			const isCountdown = !message && Boolean(this.countdown)
			this.$status.toggleClass('is_countdown', isCountdown)
			if (isCountdown) {
				// 結構只建一次，每秒只換數字：整段重建的話，剛好在換秒時按下的取消會失效
				if (!this.$status.find('.js-countdown-remain').length) {
					this.$status.html('<span class="js-countdown-remain"></span> 秒後截圖<br><button class="screenshot_link js-countdown-cancel" type="button" title="取消倒數">Esc 取消</button>')
				}
				this.$status.find('.js-countdown-remain').text(this.countdown.remain)
			} else {
				this.$status.text(message || this._idleStatus())
			}
			if (message) this.statusTimer = setTimeout(() => this._setStatus(), 3000)
		}

		_idleStatus() {
			return this.isCapture ? STATUS_CAPTURE : STATUS_IDLE
		}

		_timestamp() {
			const pad = v => String(v).padStart(2, '0')
			const now = new Date()
			return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
		}

		_dataUrlToBlob(dataUrl) {
			const [header, base64] = dataUrl.split(',')
			const binary = atob(base64)
			const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
			return new Blob([bytes], { type: header.match(/data:(.*?);/)?.[1] || 'image/png' })
		}
	}

	let current = null

	const create = options => {
		current = new ScreenshotEditor({ ...options, onClose: () => { current = null } })
	}

	window.wlScreenshot = {
		// 快捷鍵：第一次開啟直接進入截圖模式；工具列已開啟時（再按一次）切換截圖模式
		// popup（isHint）：開啟後維持一般模式，只顯示「長按右鍵開始截圖」提示；已開啟時再提示一次
		open(options) {
			if (current) {
				if (options?.isHint) {
					current.showHint()
				} else {
					current.toggleCapture()
				}
				return
			}
			create(options)
		},
		// 換頁後接回；網址變了但網頁沒重新載入時工具還在，不用重建，也不能切換模式
		resume(options) {
			if (!current) create({ ...options, isResume: true })
		},
	}
})()
