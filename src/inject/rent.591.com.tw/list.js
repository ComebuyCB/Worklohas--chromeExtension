
/*=== 591租屋網列表頁面注入腳本 ===*/

// 注入腳本載入完成標記
console.log('591 Rent List Script Loaded');

// 監聽來自 content.js 的初始化消息
window.addEventListener('message', (event) => {
  const message = event.data;
  
  // 檢查消息格式和目標
  if (!message.from || !message.to || !message.type) {
    return;
  }
  
  // 檢查是否為發送給 RENT591 的消息
  if (message.to !== 'RENT591') {
    return;
  }
  
  // 處理初始化消息
  if (message.type === 'INIT_RENT_LIST') {
    console.log('591 Rent: 收到列表頁面初始化消息');
    initializeListPage();
  }
});

// 初始化列表頁面功能
function initializeListPage() {
  console.log('591 Rent: 初始化列表頁面功能');
  
  // 創建解析按鈕
  createExtractButton();
}

function extractRentalData() {
    const itemInfos = document.querySelectorAll('.item-info');
    const data = [];
    
    itemInfos.forEach(item => {
        // Extract title and href from .item-info-title a
        const titleElement = item.querySelector('.item-info-title a');
        const href = titleElement ? titleElement.getAttribute('href') : '';
        const title = titleElement ? titleElement.textContent.trim() : '';
        
        // Extract metro distance from .house-metro
        const metroElement = item.querySelector('.house-metro');
        let metroText = '';
        let distanceMeters = 0;
        
        if (metroElement) {
            const parentDiv = metroElement.parentElement;
            if (parentDiv) {
                metroText = parentDiv.textContent.trim();
                // Extract distance number
                const distanceMatch = metroText.match(/(\d+)公尺/);
                if (distanceMatch) {
                    distanceMeters = parseInt(distanceMatch[1]);
                }
            }
        }
        
        // Extract 獨立套房 from .house-home parent span
        const houseHomeElement = item.querySelector('.house-home');
        let houseType = '';
        if (houseHomeElement) {
            const parentDiv = houseHomeElement.parentElement;
            if (parentDiv) {
                const spanElement = parentDiv.querySelector('span');
                if (spanElement) {
                    houseType = spanElement.textContent.trim();
                }
            }
        }
        
        // Extract 屋主張先生 from .role-name
        const roleNameElement = item.querySelector('.role-name');
        let ownerName = '';
        if (roleNameElement) {
            const firstSpan = roleNameElement.querySelector('span');
            if (firstSpan) {
                ownerName = firstSpan.textContent.trim();
            }
        }
        
        // Extract price from .item-info-price
        const priceElement = item.querySelector('.item-info-price');
        let priceText = '';
        if (priceElement) {
            priceText = priceElement.textContent.trim();
        }
        
        if (href || title || metroText) {
            data.push({
                href: href,
                title: title,
                metroText: metroText,
                distanceMeters: distanceMeters,
                houseType: houseType,
                ownerName: ownerName,
                priceText: priceText
            });
        }
    });
    
    return data;
}

function createSortableTable(data) {
    // Create table container if it doesn't exist
    let container = document.getElementById('extracted-table-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'extracted-table-container';
        document.body.appendChild(container);
    }
    
    let html = `
    <style>
        #rental-table { border-collapse: collapse; width: 100%; margin-top: 20px; font-family: Arial, sans-serif; }
        #rental-table th, #rental-table td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
        #rental-table th { background-color: #f2f2f2; cursor: pointer; user-select: none; }
        #rental-table th:hover { background-color: #e6e6e6; }
        #rental-table tr:nth-child(even) { background-color: #f9f9f9; }
        #rental-table tr:hover { background-color: #f5f5f5; }
        #rental-table a { color: #007bff; text-decoration: none; }
        #rental-table a:hover { text-decoration: underline; }
        .sort-indicator { float: right; opacity: 0.3; }
        .sort-asc::after { content: " ▲"; }
        .sort-desc::after { content: " ▼"; }
        #extract-btn:hover { background-color: #0056b3; }
    </style>
    
    <h2>租房資料表格 (點擊表頭排序) - 共 ${data.length} 筆</h2>
    <table id="rental-table">
        <thead>
            <tr>
                <th onclick="sortTable(0)">標題 <span class="sort-indicator"></span></th>
                <th onclick="sortTable(1)">捷運資訊 <span class="sort-indicator"></span></th>
                <th onclick="sortTable(2)">距離(公尺) <span class="sort-indicator"></span></th>
                <th onclick="sortTable(3)">房型 <span class="sort-indicator"></span></th>
                <th onclick="sortTable(4)">屋主 <span class="sort-indicator"></span></th>
                <th onclick="sortTable(5)">價格 <span class="sort-indicator"></span></th>
            </tr>
        </thead>
        <tbody>`;
    
    data.forEach(item => {
        html += `
            <tr>
                <td><a href="${item.href}" target="_blank">${item.title}</a></td>
                <td>${item.metroText}</td>
                <td>${item.distanceMeters}</td>
                <td>${item.houseType}</td>
                <td>${item.ownerName}</td>
                <td>${item.priceText}</td>
            </tr>`;
    });
    
    html += `
        </tbody>
    </table>`;
    
    container.innerHTML = html;
}

let sortDirection = {};

function sortTable(columnIndex) {
    const table = document.getElementById('rental-table');
    const tbody = table.getElementsByTagName('tbody')[0];
    const rows = Array.from(tbody.getElementsByTagName('tr'));
    
    // Toggle sort direction
    if (!sortDirection[columnIndex]) {
        sortDirection[columnIndex] = 'asc';
    } else {
        sortDirection[columnIndex] = sortDirection[columnIndex] === 'asc' ? 'desc' : 'asc';
    }
    
    // Clear previous sort indicators
    const headers = table.getElementsByTagName('th');
    for (let i = 0; i < headers.length; i++) {
        headers[i].classList.remove('sort-asc', 'sort-desc');
    }
    
    // Add current sort indicator
    headers[columnIndex].classList.add(sortDirection[columnIndex] === 'asc' ? 'sort-asc' : 'sort-desc');
    
    // Sort rows
    rows.sort((a, b) => {
        let aValue = a.getElementsByTagName('td')[columnIndex].textContent.trim();
        let bValue = b.getElementsByTagName('td')[columnIndex].textContent.trim();
        
        // For distance column, convert to numbers
        if (columnIndex === 2) {
            aValue = parseInt(aValue) || 0;
            bValue = parseInt(bValue) || 0;
            return sortDirection[columnIndex] === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        // For text columns
        if (sortDirection[columnIndex] === 'asc') {
            return aValue.localeCompare(bValue);
        } else {
            return bValue.localeCompare(aValue);
        }
    });
    
    // Rebuild table
    rows.forEach(row => tbody.appendChild(row));
}

// 創建解析按鈕
function createExtractButton() {
    // Create extract button
    const extractBtn = document.createElement('button');
    extractBtn.id = 'extract-btn';
    extractBtn.textContent = '解析租房資料';
    extractBtn.style.cssText = 'position: fixed; bottom: 20px; left: 20px; z-index: 1000; padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;';
    
    // Add hover effect
    extractBtn.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#0056b3';
    });
    extractBtn.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '#007bff';
    });
    
    // Add click event
    extractBtn.addEventListener('click', function() {
        const data = extractRentalData();
        createSortableTable(data);
        console.log('提取了', data.length, '筆資料');
        
        // Scroll to table
        const container = document.getElementById('extracted-table-container');
        if (container) {
            container.scrollIntoView({ 
                behavior: 'smooth' 
            });
        }
    });
    
    // Add button to page
    document.body.appendChild(extractBtn);
}
