
/*=== 591租屋網列表頁面注入腳本 ===*/

wlOnce('rent.591.com.tw/list', () => {
  wlLog('591 Rent List Script Loaded');

  wlMessage({
    INIT() { wl_init(); },
    UPDATE() { wl_update(); }
  });
})

function wl_init() {
    createExtractButton();
    wl_update();
}

// 自動擷取，不開啟 overlay
function wl_update() {
    const data = wl_extractData();
    wl_createSortableTable(data);
    wlLog('✅ 提取了', data.length, '筆資料');
}

function wl_extractData() {
    const data = [];

    $('.item-info').each(function() {
        const $item = $(this);

        let imgSrc = '';
        const $parentItem = $item.closest('.vue-list-rent-item');
        const $imgScope = $parentItem.length ? $parentItem : $item.parent();
        if ($imgScope.length) {
            let $img = $imgScope.find('img[alt="物件圖片"]').first();
            if (!$img.length) $img = $imgScope.find('img.common-img').first();
            if ($img.length) imgSrc = $img.attr('data-src') || $img.attr('src') || '';
        }

        const $titleElement = $item.find('.item-info-title a').first();
        const href = $titleElement.attr('href') || '';
        const title = $titleElement.text().trim();

        const $metroElement = $item.find('.house-metro').first();
        let metroText = '';
        let distanceMeters = 0;
        if ($metroElement.length) {
            const $parentDiv = $metroElement.parent();
            if ($parentDiv.length) {
                metroText = $parentDiv.text().trim();
                const distanceMatch = metroText.match(/(\d+)公尺/);
                if (distanceMatch) distanceMeters = parseInt(distanceMatch[1]);
            }
        }

        const $houseHomeElement = $item.find('.house-home').first();
        let houseType = '';
        if ($houseHomeElement.length) {
            const $span = $houseHomeElement.parent().find('span').first();
            if ($span.length) houseType = $span.text().trim();
        }

        const $roleNameElement = $item.find('.role-name').first();
        let ownerName = '';
        let updateTime = '';
        if ($roleNameElement.length) {
            const $spans = $roleNameElement.find('span');
            const $firstSpan = $spans.eq(0);
            if ($firstSpan.length) ownerName = $firstSpan.text().trim();
            const $secondSpan = $spans.eq(1);
            if ($secondSpan.length) updateTime = $secondSpan.text().trim();
        }

        const priceText = $item.find('.item-info-price').first().text().trim();

        if (href || title || metroText) {
            data.push({ img: imgSrc, href, title, metroText, distanceMeters, houseType, ownerName, updateTime, priceText });
        }
    });

    return data;
}

// 建立固定框架（僅第一次執行，內容一律留空，交由 wl_updateTable 填充/更新）
function wl_createSortableTable(data) {
    sortDirection = {};

    let $overlay = $('#rental-fullscreen-overlay');
    if (!$overlay.length) {
        $overlay = $('<div id="rental-fullscreen-overlay"></div>').appendTo('body');

        $overlay.html(`
        <div id="rental-fullscreen-content">
            <div class="rental-head">
                <div class="rental-head--row">
                    <h2 id="rental-table-title">租房資料表格 - 共 <span id="rental-table-count">${data.length}</span> 筆</h2>
                    <button id="rental-fullscreen-close">×</button>
                </div>
                <div id="paginator-wrapper-clone"></div>
            </div>
            <div class="rental-body">
                <table id="rental-table-inline">
                    <thead>
                        <tr>
                            <th width="50">圖片</th>
                            <th data-column="1">標題</th>
                            <th data-column="2">捷運資訊</th>
                            <th data-column="3" style="width: 102px;">距離(公尺)</th>
                            <th data-column="4" style="width: 78px;">房型</th>
                            <th data-column="5" style="width: 108px;">屋主</th>
                            <th data-column="6" style="width: 108px;">更新時間</th>
                            <th data-column="7">價格</th>
                        </tr>
                    </thead>
                    <tbody id="rental-table-body"></tbody>
                </table>
            </div>
        </div>`);

        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && $overlay.css('display') === 'block') {
                $overlay.css('display', 'none');
            }
        });

        // 分頁點擊委派：clone 內的 <a> 一律取消預設行為，
        // 改觸發原頁面 .paginator-wrapper 對應位置的 <a>，讓 Vue router 正常運作
        $overlay.on('click', '#paginator-wrapper-clone a', function(e) {
            e.preventDefault();

            const $originalPaginator = $('.paginator-wrapper');
            if (!$originalPaginator.length) return;
            const index = $(this).closest('#paginator-wrapper-clone').find('a').index(this);
            $originalPaginator.find('a').eq(index)[0]?.click();
        });

        $overlay.on('click', 'th[data-column]', function() {
            sortTable(parseInt($(this).attr('data-column')));
        });

        $overlay.on('click', '#rental-fullscreen-close', function() {
            $overlay.css('display', 'none');
        });

        $overlay.on('click', function(e) {
            if (e.target === $overlay[0]) $overlay.css('display', 'none');
        });
    }

    // 資料重新提取視為未排序，thead 的排序樣式需一併重置，避免跟新的 tbody 對不上
    $overlay.find('th.sort-asc-inline, th.sort-desc-inline').removeClass('sort-asc-inline sort-desc-inline');

    wl_updateTable(data);
}

// 更新動態內容：標題筆數、分頁 clone、表格資料列
function wl_updateTable(data) {
    const $overlay = $('#rental-fullscreen-overlay');
    if (!$overlay.length) return;

    // 更新標題筆數
    $overlay.find('#rental-table-count').text(data.length);

    const $originalPaginator = $('.paginator-wrapper');
    const $paginatorClone = $overlay.find('#paginator-wrapper-clone');
    if ($paginatorClone.length) $paginatorClone.html($originalPaginator.length ? $originalPaginator.html() : '');

    const $tbody = $overlay.find('#rental-table-body');
    if ($tbody.length) {
        $tbody.html(data.map(item => `
            <tr>
                <td>${item.img ? `<img src="${item.img}" style="max-width: 100px; height: auto;">` : ''}</td>
                <td><a href="${item.href}" target="_blank">${item.title}</a></td>
                <td>${item.metroText}</td>
                <td>${item.distanceMeters}</td>
                <td>${item.houseType}</td>
                <td>${item.ownerName}</td>
                <td>${item.updateTime}</td>
                <td>${item.priceText}</td>
            </tr>`).join(''));
    }
}

let sortDirection = {};

function sortTable(columnIndex) {
    const $table = $('#rental-table-inline');
    const $tbody = $table.find('tbody').first();
    const $rows = $tbody.find('tr');

    sortDirection[columnIndex] = sortDirection[columnIndex] === 'asc' ? 'desc' : 'asc';

    $table.find('th').removeClass('sort-asc-inline sort-desc-inline');
    $table.find('th').eq(columnIndex).addClass(
        sortDirection[columnIndex] === 'asc' ? 'sort-asc-inline' : 'sort-desc-inline'
    );

    const sortedRows = $rows.get().sort((a, b) => {
        let aVal = $(a).find('td').eq(columnIndex).text().trim();
        let bVal = $(b).find('td').eq(columnIndex).text().trim();
        if (columnIndex === 3) {
            aVal = parseInt(aVal) || 0; bVal = parseInt(bVal) || 0;
            return sortDirection[columnIndex] === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection[columnIndex] === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    $tbody.append(sortedRows);
}

function createExtractButton() {
    const $extractBtn = $('<button id="extract-btn">查看租房資料</button>');

    $extractBtn.on('click', function() {
        $('#rental-fullscreen-overlay').css('display', 'block');
    });

    $('body').append($extractBtn);
}
