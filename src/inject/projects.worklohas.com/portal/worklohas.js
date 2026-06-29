setInterval(()=>{
	const frameId  = 'detail-rhs'
	const frame = document.querySelector('#' + frameId)
	const scrollsId = 'wl-scrolls'
	const scrolls = document.getElementById(scrollsId)
	if ( frame && !scrolls ){
		document.querySelector('#detailsGreyBar').insertAdjacentHTML('beforeend', `
			<div id="${scrollsId}" class="wl-scrollBtnBox">
				<div class="wl-scrollBtn" id="wl-btn-bottom">
					<span>至底</span>
					<span class="_icon">↓</span>
				</div>
				<div class="wl-scrollBtn" id="wl-btn-top">
					<span class="_icon">↑</span>
					<span>至頂</span>
				</div>
			</div>
		`)

		const btnBottom = document.getElementById('wl-btn-bottom');
		const btnTop = document.getElementById('wl-btn-top');

		btnBottom.addEventListener('click', () => frame.scrollTo({ top: 999999 }));
		btnTop.addEventListener('click', () => frame.scrollTo({ top: 0 }));

		const updateVisibility = () => {
			const atTop = frame.scrollTop <= 0;
			const atBottom = frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1;
			btnTop.classList.toggle('is-hidden', atTop);
			btnBottom.classList.toggle('is-hidden', atBottom);
		}

		frame.addEventListener('scroll', updateVisibility);
		updateVisibility();
	}
}, 500)