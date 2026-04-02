setInterval(()=>{
	let frameId = 'detail-rhs'
	let frame = document.querySelector('#'+frameId);
	let scrollsId = 'cb-scrolls'
	let scrolls = document.querySelector('#'+scrollsId);
	if ( frame && scrolls === null ){
		document.querySelector('#detail-rhs').insertAdjacentHTML('beforeend',`
			<div id="${scrollsId}">
				<div class="cb-scrollBtnBox _mid">	
					<div class="cb-scrollBtn"	onclick="document.querySelector('#${frameId}').scrollTo(0, 999999)">↓</div>
				</div>
				<div class="cb-scrollBtnBox _right">
					<div class="cb-scrollBtn"	onclick="document.querySelector('#${frameId}').scrollTo(0, 0)">↑</div>
				</div>
			</div>
		`)
	}
}, 500)