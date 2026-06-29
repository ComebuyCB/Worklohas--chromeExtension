
/*=== 591租屋網列表頁面注入腳本 ===*/

wlOnce('rent.591.com.tw/list', () => {
  wlLog('591 Rent List Script Loaded');

  window.addEventListener('message', (event) => {
    const message = event.data;
    if (!message?.from || !message?.type || message.to !== 'rent.591.com.tw/list') return;
    if (message.type === 'INIT') {
      initializeListPage();
    } else if (message.type === 'UPDATE') {
      autoExtract();
    }
  });
})

function initializeListPage() {
  createExtractButton();
  autoExtract();
}

// 自動擷取，不開啟 overlay
function autoExtract() {
  const data = extractRentalData();
  createSortableTable(data);
  wlLog('✅ 提取了', data.length, '筆資料');
}

function extractRentalData() {
    const itemInfos = document.querySelectorAll('.item-info');
    const data = [];

    itemInfos.forEach(item => {
        let imgSrc = '';
        const parentItem = item.closest('.vue-list-rent-item') || item.parentElement;
        if (parentItem) {
            let imgElement = parentItem.querySelector('img[alt="物件圖片"]');
            if (!imgElement) {
                imgElement = parentItem.querySelector('img.common-img');
            }
            if (imgElement) {
                imgSrc = imgElement.getAttribute('data-src') || imgElement.getAttribute('src') || '';
            }
        }

        const titleElement = item.querySelector('.item-info-title a');
        const href = titleElement ? titleElement.getAttribute('href') : '';
        const title = titleElement ? titleElement.textContent.trim() : '';

        const metroElement = item.querySelector('.house-metro');
        let metroText = '';
        let distanceMeters = 0;
        if (metroElement) {
            const parentDiv = metroElement.parentElement;
            if (parentDiv) {
                metroText = parentDiv.textContent.trim();
                const distanceMatch = metroText.match(/(\d+)公尺/);
                if (distanceMatch) distanceMeters = parseInt(distanceMatch[1]);
            }
        }

        const houseHomeElement = item.querySelector('.house-home');
        let houseType = '';
        if (houseHomeElement) {
            const parentDiv = houseHomeElement.parentElement;
            if (parentDiv) {
                const spanElement = parentDiv.querySelector('span');
                if (spanElement) houseType = spanElement.textContent.trim();
            }
        }

        const roleNameElement = item.querySelector('.role-name');
        let ownerName = '';
        if (roleNameElement) {
            const firstSpan = roleNameElement.querySelector('span');
            if (firstSpan) ownerName = firstSpan.textContent.trim();
        }

        const priceElement = item.querySelector('.item-info-price');
        let priceText = priceElement ? priceElement.textContent.trim() : '';

        if (href || title || metroText) {
            data.push({ img: imgSrc, href, title, metroText, distanceMeters, houseType, ownerName, priceText });
        }
    });

    return data;
}

function createSortableTable(data) {
    sortDirection = {};

    let overlay = document.getElementById('rental-fullscreen-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'rental-fullscreen-overlay';
        document.body.appendChild(overlay);
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay.style.display === 'block') {
                overlay.style.display = 'none';
            }
        });
    }

    const originalPaginator = document.querySelector('.paginator-wrapper');
    let paginatorHtml = originalPaginator
        ? `<div class="paginator-wrapper-clone">${originalPaginator.innerHTML}</div>`
        : '';

    let html = `
    <div id="rental-fullscreen-content">
        <div class="rental-head">
            <div class="rental-head--row">
                <h2>租房資料表格 (點擊表頭排序) - 共 ${data.length} 筆</h2>
                <button id="rental-fullscreen-close">×</button>
            </div>
            ${paginatorHtml}
        </div>
        <div class="rental-body">
        <table id="rental-table-inline">
            <thead>
                <tr>
                    <th width="50">圖片</th>
                    <th data-column="1">標題 <span class="sort-indicator-inline"></span></th>
                    <th data-column="2">捷運資訊 <span class="sort-indicator-inline"></span></th>
                    <th data-column="3" style="width: 102px;">距離(公尺) <span class="sort-indicator-inline"></span></th>
                    <th data-column="4" style="width: 78px;">房型 <span class="sort-indicator-inline"></span></th>
                    <th data-column="5" style="width: 108px;">屋主 <span class="sort-indicator-inline"></span></th>
                    <th data-column="6">價格 <span class="sort-indicator-inline"></span></th>
                </tr>
            </thead>
            <tbody>`;

    data.forEach(item => {
        html += `
            <tr>
                <td>${item.img ? `<img src="${item.img}" style="max-width: 100px; height: auto;">` : ''}</td>
                <td><a href="${item.href}" target="_blank">${item.title}</a></td>
                <td>${item.metroText}</td>
                <td>${item.distanceMeters}</td>
                <td>${item.houseType}</td>
                <td>${item.ownerName}</td>
                <td>${item.priceText}</td>
            </tr>`;
    });

    html += `</tbody></table></div></div>`;
    overlay.innerHTML = html;

    overlay.querySelectorAll('th[data-column]').forEach(header => {
        header.addEventListener('click', function() {
            sortTable(parseInt(this.getAttribute('data-column')));
        });
    });

    const closeBtn = overlay.querySelector('#rental-fullscreen-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => { overlay.style.display = 'none'; });
    }

    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.style.display = 'none';
    });
}

let sortDirection = {};

function sortTable(columnIndex) {
    const table = document.getElementById('rental-table-inline');
    const tbody = table.getElementsByTagName('tbody')[0];
    const rows = Array.from(tbody.getElementsByTagName('tr'));

    sortDirection[columnIndex] = sortDirection[columnIndex] === 'asc' ? 'desc' : 'asc';

    Array.from(table.getElementsByTagName('th')).forEach(th => th.classList.remove('sort-asc-inline', 'sort-desc-inline'));
    table.getElementsByTagName('th')[columnIndex].classList.add(
        sortDirection[columnIndex] === 'asc' ? 'sort-asc-inline' : 'sort-desc-inline'
    );

    rows.sort((a, b) => {
        let aVal = a.getElementsByTagName('td')[columnIndex].textContent.trim();
        let bVal = b.getElementsByTagName('td')[columnIndex].textContent.trim();
        if (columnIndex === 3) {
            aVal = parseInt(aVal) || 0; bVal = parseInt(bVal) || 0;
            return sortDirection[columnIndex] === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection[columnIndex] === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    rows.forEach(row => tbody.appendChild(row));
}

function createExtractButton() {
    const extractBtn = document.createElement('button');
    extractBtn.id = 'extract-btn';
    extractBtn.textContent = '查看租房資料';

    extractBtn.addEventListener('click', function() {
        const overlayElement = document.getElementById('rental-fullscreen-overlay');
        if (overlayElement) overlayElement.style.display = 'block';
    });

    document.body.appendChild(extractBtn);
}
