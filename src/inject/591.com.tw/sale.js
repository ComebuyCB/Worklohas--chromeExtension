
/*=== 591 售屋網列表頁面注入腳本 ===*/

wlOnce('sale.591.com.tw/', () => {
  wlLog('591 Sale List Script Loaded');

  wlMessage({
    INIT() { wl_init(); },
    UPDATE() { wl_update(); }
  });
})

function wl_init() {
    createExtractButton();
    wl_update();
    wl_observeSlideLeft();
}

const PAGE_SIZE = 30; // 591 每頁固定筆數，對照 API 回傳 data.page 分頁連結的 data-first="30"/"60" 可驗證

// .slide-left 底下的 .ware-list-wrap（清單）跟 .paginator-wrapper（分頁）都是 Vue 換頁/換條件後才非同步重繪，
// 直接在當下讀 DOM 常常撲空，改成監看共同父層 .slide-left，有變化（換頁、換篩選條件）就重新同步分頁 + 重抓列表
function wl_observeSlideLeft() {
    const trySetup = () => {
        const slideLeft = document.querySelector('.slide-left');
        if (!slideLeft) return false;

        wl_syncPaginatorClone();

        let debounceTimer = null;
        new MutationObserver(() => {
            wl_syncPaginatorClone();
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => wl_update(), 300);
        }).observe(slideLeft, { childList: true, subtree: true });

        return true;
    };

    if (trySetup()) return;

    // .slide-left 首次還沒渲染出來，短輪詢等它出現後再掛 observer
    const waitTimer = setInterval(() => {
        if (trySetup()) clearInterval(waitTimer);
    }, 300);
}

// 把目前真實的 .paginator-wrapper 內容同步進我們自己 overlay 裡的 clone
function wl_syncPaginatorClone() {
    const $original = $('.paginator-wrapper');
    const $clone = $('#paginator-wrapper-clone');
    if (!$clone.length) return;
    $clone.html($original.length ? $original.html() : '');
}

// 自動擷取，不開啟 overlay
async function wl_update() {
    const result = await wl_fetchData();
    wl_createSortableTable(result);
    wlLog('✅ 提取了', result.list.length, '筆資料 (共', result.total, '筆 / 第', result.page, '頁)');
}

// 直接呼叫 591 官方 BFF API，帶入目前頁面上的搜尋條件（query string 透傳），比 DOM 擷取更精準完整
async function wl_fetchData() {
    const params = new URLSearchParams(window.location.search);

    // 換頁只會更新 query string 的 page 參數，但換回第 1 頁時 591 自己不會清掉這個參數，
    // URL 上的 page 會殘留舊值，所以優先信任 .paginator-wrapper 當下 active 的頁碼，URL 只當 fallback
    const activePage = parseInt($('.paginator-wrapper .paging li.active a').text().trim());
    const page = activePage || parseInt(params.get('page')) || 1;
    params.set('firstRow', (page - 1) * PAGE_SIZE);

    const apiUrl = `https://bff-house.591.com.tw/v1/web/sale/list?timestamp=${Date.now()}&type=2&category=1&${params.toString()}`;
    let json;
    try {
        const res = await fetch(apiUrl);
        json = await res.json();
    } catch (e) {
        wlLog('❌ API 取得失敗', e);
        return { list: [], total: 0, page };
    }

    const houseList = json?.data?.house_list || [];
    const total = parseInt(json?.data?.total) || 0;

    // 排除埋在列表中的新案廣告（is_newhouse 為 1，type 非 "2"）
    const list = houseList
        .filter(item => !item.is_newhouse && String(item.type) === '2')
        .map(item => ({
            href: `https://sale.591.com.tw/home/house/detail/2/${item.houseid}.html`,
            title: item.title,
            img: item.photo_url,
            shapeName: item.shape_name || '',
            room: item.room || '',
            area: item.area != null ? `${item.area}坪` : '',
            mainArea: item.mainarea != null ? `${item.mainarea}坪` : '',
            houseAge: item.showhouseage || '',
            floor: item.floor || '',
            hasCarport: !!item.has_carport,
            community: item.community_name || '',
            communityLink: item.community_link || '',
            section: item.section_name ? `${item.section_name}-` : '',
            address: item.address || '',
            distanceLabel: item.distance_name ? `距${item.distance_name}` : '',
            distanceMeters: item.distance || 0,
            ownerName: item.nick_name,
            updateTime: item.refreshtime,
            priceValue: item.showprice,
            priceNote: item.price_has_carport ? '( 含車位價 )' : '',
            unitPrice: item.unit_price
        }));

    return { list, total, page };
}

// 建立固定框架（僅第一次執行，內容一律留空，交由 wl_updateTable 填充/更新）
function wl_createSortableTable(result) {
    sortDirection = {};

    let $overlay = $('#sale-fullscreen-overlay');
    if (!$overlay.length) {
        $overlay = $('<div id="sale-fullscreen-overlay"></div>').appendTo('body');

        $overlay.html(`
        <div id="sale-fullscreen-content">
            <div class="sale-head">
                <div class="sale-head--row">
                    <h2 id="sale-table-title">買屋資料表格 - 共 <span id="sale-table-count">${result.total}</span> 筆</h2>
                    <button id="sale-fullscreen-close">×</button>
                </div>
                <div id="paginator-wrapper-clone"></div>
            </div>
            <div class="sale-body">
                <table id="sale-table-inline">
                    <thead>
                        <tr>
                            <th width="50">圖片</th>
                            <th data-column="1">標題</th>
                            <th data-column="2">社區/地址</th>
                            <th data-column="3">距離資訊</th>
                            <th data-column="4" style="width: 102px;">距離(公尺)</th>
                            <th data-column="5" style="width: 90px;">型態/格局</th>
                            <th data-column="6" style="width: 80px;">樓層/車位</th>
                            <th data-column="7" style="width: 80px;">權狀坪</th>
                            <th data-column="8" style="width: 80px;">主建坪</th>
                            <th data-column="9" style="width: 70px;">屋齡</th>
                            <th data-column="10" style="width: 108px;">屋主</th>
                            <th data-column="11" style="width: 108px;">更新時間</th>
                            <th data-column="12" style="width: 90px;">總價(萬)</th>
                            <th data-column="13" style="width: 108px;">單價</th>
                        </tr>
                    </thead>
                    <tbody id="sale-table-body"></tbody>
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

        $overlay.on('click', '#sale-fullscreen-close', function() {
            $overlay.css('display', 'none');
        });

        $overlay.on('click', function(e) {
            if (e.target === $overlay[0]) $overlay.css('display', 'none');
        });
    }

    // 資料重新提取視為未排序，thead 的排序樣式需一併重置，避免跟新的 tbody 對不上
    $overlay.find('th.sort-asc-inline, th.sort-desc-inline').removeClass('sort-asc-inline sort-desc-inline');

    wl_updateTable(result);
}

// 更新動態內容：標題筆數、分頁 clone、表格資料列
function wl_updateTable(result) {
    const { list, total } = result;
    const $overlay = $('#sale-fullscreen-overlay');
    if (!$overlay.length) return;

    // 更新標題筆數
    $overlay.find('#sale-table-count').text(total);

    wl_syncPaginatorClone();

    const $tbody = $overlay.find('#sale-table-body');
    if ($tbody.length) {
        $tbody.html(list.map(item => `
            <tr>
                <td>${item.img ? `<img src="${item.img}" style="max-width: 100px; height: auto;">` : ''}</td>
                <td><a href="${item.href}" target="_blank">${item.title}</a></td>
                <td>${item.communityLink ? `<a href="${item.communityLink}" target="_blank">${item.community}</a>` : item.community}<br>${item.section}${item.address}</td>
                <td>${item.distanceLabel}</td>
                <td>${item.distanceMeters}</td>
                <td>${item.shapeName}<br>${item.room}</td>
                <td>${item.floor}${item.hasCarport ? '<br>含車位' : ''}</td>
                <td>${item.area}</td>
                <td>${item.mainArea}</td>
                <td>${item.houseAge}</td>
                <td>${item.ownerName}</td>
                <td>${item.updateTime}</td>
                <td>${item.priceValue}</td>
                <td>${item.unitPrice}</td>
            </tr>`).join(''));
    }
}

let sortDirection = {};

function sortTable(columnIndex) {
    const $table = $('#sale-table-inline');
    const $tbody = $table.find('tbody').first();
    const $rows = $tbody.find('tr');

    sortDirection[columnIndex] = sortDirection[columnIndex] === 'asc' ? 'desc' : 'asc';

    $table.find('th').removeClass('sort-asc-inline sort-desc-inline');
    $table.find('th').eq(columnIndex).addClass(
        sortDirection[columnIndex] === 'asc' ? 'sort-asc-inline' : 'sort-desc-inline'
    );

    // 距離(公尺)、權狀坪、主建坪、屋齡、總價(萬) 皆為數值欄位，其餘走文字排序
    const numericColumns = [4, 7, 8, 9, 12];

    const sortedRows = $rows.get().sort((a, b) => {
        let aVal = $(a).find('td').eq(columnIndex).text().trim();
        let bVal = $(b).find('td').eq(columnIndex).text().trim();
        if (numericColumns.includes(columnIndex)) {
            aVal = parseFloat(aVal.replace(/[^\d.]/g, '')) || 0;
            bVal = parseFloat(bVal.replace(/[^\d.]/g, '')) || 0;
            return sortDirection[columnIndex] === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection[columnIndex] === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    $tbody.append(sortedRows);
}

function createExtractButton() {
    const $extractBtn = $('<button id="extract-btn">查看買屋資料</button>');

    $extractBtn.on('click', function() {
        $('#sale-fullscreen-overlay').css('display', 'block');
    });

    $('body').append($extractBtn);
}
