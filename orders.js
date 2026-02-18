// ==========================================
// 1. 初始化與入口 (Init)
// ==========================================

// 初始化 Tag Controls (一般編輯模態框)
// 依賴 utils.js 中的 setupTagControls 函式
const editMissedCtrl = setupTagControls(
    document.getElementById('editAddMissed'), 
    document.getElementById('editStampMissed'), 
    document.getElementById('editMissedInput'), 
    document.getElementById('editMissedTags'), 
    document.getElementById('editMissedHidden')
);
const editNotifyCtrl = setupTagControls(
    document.getElementById('editAddNotify'), 
    document.getElementById('editStampNotify'), 
    document.getElementById('editNotifyInput'), 
    document.getElementById('editNotifyTags'), 
    document.getElementById('editNotifyHidden')
);

// 分店調撥控制項
const editTransferStoreInput = document.getElementById('editTransferStoreInput');
const editTransferDateInput = document.getElementById('editTransferDateInput');
const editStoreTransferHidden = document.getElementById('editStoreTransfer');
const storeTransferOptionsContainer = document.getElementById('storeTransferOptions');
const clearStoreTransferBtn = document.getElementById('clearStoreTransfer');

// DOM 元素參考 (本檔案專用)
const dataLoader = document.getElementById('dataLoader');
const dataTableBody = document.getElementById('data-table-body');
const noDataText = document.getElementById('noDataText');
const dataMessageBox = document.getElementById('data-message-box');
const searchInput = document.getElementById('searchInput');
const searchButton = document.getElementById('searchButton');
const refreshButton = document.getElementById('refreshButton');
const editModal = document.getElementById('editModalBackdrop');
const orderForm = document.getElementById('orderForm');
const submitButton = document.getElementById('submitButton');

// 追蹤當前有效的店別代碼 (用於驗證失敗時還原)
let currentValidStore = '';

// 程式進入點
window.addEventListener('load', async () => {
    renderTabs();
    await fetchStores();
    await fetchOrders(); 
    
    // 同步載入黑名單資料 (函式定義在 admin.js)
    if(typeof fetchBlacklistData === 'function') {
        fetchBlacklistData();
    }
});

// ==========================================
// 2. 資料讀取 (Fetch Data)
// ==========================================

// 讀取分店清單
async function fetchStores() {
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=stores`);
        const json = await resp.json();
        const stores = json.stores || [];
        
        allStoresCache = stores; // 更新全域快取 (utils.js)

        // 重建下拉選單
        storeSelect.innerHTML = '<option value="">請選擇店別</option>';
        stores.forEach(s => {
            if(s.name === '店名' || s.code === '店編號') return;
            const opt = document.createElement('option');
            opt.value = s.code; 
            opt.textContent = s.name ? `${s.name}` : s.code;
            opt.dataset.name = s.name || s.code; // 儲存店名供後續使用
            storeSelect.appendChild(opt);
        });

        // 恢復上次選擇的店別 (初始化時不需驗證密碼)
        const saved = localStorage.getItem('selected_store');
        if(saved && Array.from(storeSelect.options).some(o=>o.value===saved)) {
            storeSelect.value = saved; 
            currentValidStore = saved; // 設定當前有效店別
            updateStoreDisplay(); // utils.js
        }
        
        // 檢查該店別的鎖定/通知設定 (admin.js)
        if(typeof checkStoreSettings === 'function') {
            checkStoreSettings(); 
        }
    } catch(e) { 
        console.error('Fetch Stores Error:', e); 
    }
}

// 監聽店別切換 (加入驗證邏輯 - 後端驗證版)
storeSelect.addEventListener('change', async () => {
    const targetStoreCode = storeSelect.value;
    const targetOption = storeSelect.options[storeSelect.selectedIndex];
    const targetStoreName = targetOption ? (targetOption.dataset.name || targetOption.text) : '';

    // 如果是切換回「請選擇店別」(空值)，直接允許
    if (!targetStoreCode) {
        currentValidStore = '';
        localStorage.removeItem('selected_store');
        updateStoreDisplay();
        fetchOrders();
        return;
    }

    // 跳出輸入框要求輸入店編號
    const input = prompt(`您即將切換至：${targetStoreName}\n\n為確保安全性，請輸入該店的【店編號】(英文字母需大寫)以確認切換：`);

    if (!input) {
         // 取消輸入
        storeSelect.value = currentValidStore; // 還原選單
        return;
    }

    let isVerified = false;

    // 1. 先比對是否為該店店號 (這是公開資訊，前端比對無妨)
    if (input.trim() === targetStoreCode) {
        isVerified = true;
    } else {
        // 2. 如果不是店號，則嘗試驗證是否為管理員密碼 (後端驗證)
        const isAdmin = await verifyAdminPassword(input.trim());
        if (isAdmin) {
            isVerified = true;
        }
    }

    if (isVerified) {
        // 驗證成功
        currentValidStore = targetStoreCode;
        localStorage.setItem('selected_store', targetStoreCode);
        updateStoreDisplay();
        
        if(typeof checkStoreSettings === 'function') {
            checkStoreSettings();
        }
        fetchOrders();
    } else {
        // 驗證失敗
        alert('驗證失敗 (店號錯誤或管理員密碼錯誤)，還原至上一個店別。');
        storeSelect.value = currentValidStore; // 還原選單
    }
});

// 讀取訂單資料
async function fetchOrders() {
    dataLoader.classList.remove('hidden');
    dataTableBody.innerHTML = '';
    noDataText.classList.add('hidden');
    dataMessageBox.classList.add('hidden');
    
    const store = storeSelect.value;
    const url = store ? `${SCRIPT_URL}?store=${encodeURIComponent(store)}` : SCRIPT_URL;
    
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const rows = json.rows || [];
        
        allOrders = []; 
        allLongTermOrders = [];
        
        rows.forEach(r => {
            if(r['固定/長期客訂'] === '是' || r['固定/長期客訂'] === true) {
                allLongTermOrders.push(r);
            } else {
                allOrders.push(r);
            }
        });
        
        const fixedHeaders = ['姓名', '手機號碼', '商品', '進度', '付清', '建立日期', '最後更新'];
        renderTableHeaders(fixedHeaders);
        
        const longTermHeaders = ['姓名', '手機號碼', '商品', '進度', '付清', '建立日期', '最後更新'];
        if(typeof renderLongTermTableHeaders === 'function') {
            renderLongTermTableHeaders(longTermHeaders);
        }

        renderTable(); 
        
        if(typeof renderLongTermTable === 'function') {
            renderLongTermTable();
        }

    } catch(e) { 
        console.error(e); 
        dataMessageBox.classList.remove('hidden');
        dataMessageBox.textContent = '讀取失敗：' + e.message;
    } finally { 
        dataLoader.classList.add('hidden'); 
    }
}

// ==========================================
// 3. 表格渲染 (Render UI)
// ==========================================

function renderTableHeaders(displayHeaders){
    if(!dataTableHeaders) return;
    dataTableHeaders.innerHTML = '';
    const headers = ['狀態', ...displayHeaders];
    headers.forEach(h=>{
      const th = document.createElement('th');
      th.className = 'sticky top-0 z-30 bg-gray-100 text-gray-900 font-bold px-4 py-3 border-b-2 border-gray-200 whitespace-nowrap'; 
      th.textContent = h;
      dataTableHeaders.appendChild(th);
    });
}

function renderTable() {
    const tableContainer = document.getElementById('dataTableContainer');
    dataTableBody.innerHTML = '';
    const term = searchInput.value.trim().toLowerCase();
    
    let filtered = allOrders.filter(o => {
        const status = getStatus(o);
        if (currentFilter !== 'all' && status.key !== currentFilter) return false;
        if (!term) return true;
        return Object.values(o).some(val => String(val).toLowerCase().includes(term));
    });

    filtered.sort((a,b) => {
         const ta = new Date(a['最後更新時間'] || a['建立日期'] || 0).getTime();
         const tb = new Date(b['最後更新時間'] || b['建立日期'] || 0).getTime();
         return tb - ta;
    });
    
    if(filtered.length === 0) { 
        noDataText.classList.remove('hidden'); 
        tableContainer.classList.add('hidden'); 
        return; 
    } else { 
        noDataText.classList.add('hidden'); 
        tableContainer.classList.remove('hidden'); 
    }

    filtered.forEach(order => {
        const tr = document.createElement('tr');
        const isLineNotify = isChecked(order['Line通知']);
        if (isLineNotify) {
            tr.className = 'bg-green-100 hover:bg-green-200 cursor-pointer transition-colors border-l-4 border-green-400';
        } else {
            tr.className = 'bg-white even:bg-gray-50 hover:bg-indigo-50 cursor-pointer transition-colors';
        }

        tr.onclick = (e) => { 
            if(e.target.closest('button')) return; 
            openEditModal(order); 
        };

        const status = getStatus(order);
        
        const productA = order['客訂商品A'] ? `[${order['客訂商品A']}]${order['A商品規格'] ? `(${order['A商品規格']})` : ''} ${order['A數量'] ? 'x' + order['A數量'] : ''}` : '';
        const productB = order['客訂商品B'] ? `[${order['客訂商品B']}]${order['B商品規格'] ? `(${order['B商品規格']})` : ''} ${order['B數量'] ? 'x' + order['B數量'] : ''}` : '';
        
        let transferDisplay = '';
        if (order['分店調撥'] && order['分店調撥'].trim()) {
             const val = order['分店調撥'].trim();
             let displayTxt = val.replace('⇄', '').trim();
             const parts = displayTxt.split(/\s+/);
             if (parts.length > 1) {
                 const datePart = parts[parts.length-1];
                 const formattedDate = formatDateMMDD(datePart); // utils.js
                 if (formattedDate) {
                    parts[parts.length-1] = formattedDate;
                    displayTxt = parts.join(' ');
                 }
             }
             transferDisplay = `<div class="mt-1 inline-flex items-center gap-1 border border-purple-300 text-purple-700 bg-purple-50 rounded px-2 py-0.5 text-xs"><span>⇄ ${displayTxt}</span></div>`;
        }
        
        const formatMulti = (val) => {
            if(!val) return '';
            const parts = String(val).split(/[,;，\s]+/).filter(Boolean);
            if(parts.length === 0) return '';
            return parts.map(d => {
                const dobj = new Date(d);
                if(isNaN(dobj.getTime())) return d;
                return `${pad(dobj.getMonth()+1)}/${pad(dobj.getDate())}`;
            }).join(', ');
        };

        let dateDisplay = '';
        if(order['採購日期']) dateDisplay += `<div class="text-xs text-blue-600">採購: ${formatDateMMDD(order['採購日期'])}</div>`;
        if(order['到貨日期']) dateDisplay += `<div class="text-xs text-purple-600">到貨: ${formatDateMMDD(order['到貨日期'])}</div>`;
        if(order['未接電話日期']) dateDisplay += `<div class="text-xs text-red-500">未接: ${formatMulti(order['未接電話日期'])}</div>`;
        if(order['通知日期']) dateDisplay += `<div class="text-xs text-orange-600">通知: ${formatMulti(order['通知日期'])}</div>`;
        if(order['取走日期']) dateDisplay += `<div class="text-xs text-green-600">取走: ${formatDateMMDD(order['取走日期'])}</div>`;
        if(!dateDisplay) dateDisplay = `<div class="text-xs text-gray-400">${formatDateMMDD(order['建立日期'])}</div>`;

        let phoneDisplay = order['電話'] || order['連絡電話'] || '';
        if (phoneDisplay) phoneDisplay = formatPhone(phoneDisplay);

        const isPaid = isChecked(order['付清'] || order['paid']);
        const paidDisplay = isPaid ? '<span class="text-green-600 font-bold">是</span>' : '<span class="text-gray-400">否</span>';
        
        const createdDate = formatDateMMDD(order['建立日期'] || order['creationDate'] || order['建立時間']);
        const updatedDate = formatDateMMDD(order['最後更新時間']);

        tr.innerHTML = `
          <td><span class="status-badge ${status.class}">${status.label}</span></td>
          <td data-label="姓名" class="font-medium text-gray-900">${order['姓名'] || '未知'}</td>
          <td data-label="手機號碼">${phoneDisplay}</td>
          <td data-label="商品" class="mobile-full-width">
             <div class="font-medium text-indigo-900">${productA}</div>
             ${productB ? `<div class="font-medium text-indigo-900 mt-1">${productB}</div>` : ''}
             ${transferDisplay}
          </td>
          <td data-label="進度" class="text-gray-500">${dateDisplay || '-'}</td>
          <td data-label="付清">${paidDisplay}</td>
          <td data-label="建立日期" class="text-xs text-gray-400">${createdDate}</td>
          <td data-label="最後更新" class="text-xs text-gray-400">${updatedDate}</td>
        `;

        dataTableBody.appendChild(tr);
    });
}

function renderTabs() {
    const STATUS_TABS = [
      { key: 'all', label: '全部' },
      { key: '未處理', label: '未處理' },
      { key: '已採購', label: '已採購' },
      { key: '已到貨', label: '已到貨' },
      { key: '已通知', label: '已通知' },
      { key: '未接', label: '未接' },
      { key: '已取貨', label: '已取貨' }
    ];
    const container = document.getElementById('statusTabs');
    container.innerHTML = STATUS_TABS.map(tab => `
      <button class="tab-btn ${tab.key === currentFilter ? 'active' : ''}" 
              onclick="setFilter('${tab.key}')">
        ${tab.label}
      </button>
    `).join('');
}

window.setFilter = (key) => { 
    currentFilter = key; 
    renderTabs(); 
    renderTable(); 
};

searchButton.addEventListener('click', renderTable);
searchInput.addEventListener('input', renderTable);
refreshButton.addEventListener('click', fetchOrders);

// ==========================================
// 4. 新增、編輯與刪除 (CRUD)
// ==========================================

orderForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const store = storeSelect.value;
    if(!store) { alert('請先選擇店別！'); return; }
    
    submitButton.disabled = true; 
    submitButton.textContent = '送出中...';
    
    try {
      const fd = new FormData(orderForm);
      fd.append('action', 'append');
      fd.append('store', store);
      await fetch(SCRIPT_URL, { method: 'POST', body: fd });
      alert('訂單已送出'); 
      orderForm.reset(); 
      fetchOrders();
    } catch(err) { alert('失敗: '+err.message); } finally { submitButton.disabled = false; submitButton.textContent = '送出訂單'; }
});

const phoneInput = document.getElementById('phone');
const phoneWarning = document.getElementById('phone-warning');

phoneInput.addEventListener('input', function() {
    const inputVal = this.value.trim().replace(/\D/g, ''); 
    const inputNoZero = inputVal.replace(/^0+/, ''); 
    
    phoneWarning.classList.add('hidden');
    this.style.borderColor = ''; 
    this.style.backgroundColor = '';
    
    if (inputNoZero.length < 6) return;
    
    const found = allBlacklistData.find(row => {
        const data = resolveBlacklistRowData(row);
        const rawPhone = data.phone;
        const rowPhoneNoZero = String(rawPhone).replace(/\D/g, '').replace(/^0+/, '');
        return rowPhoneNoZero && rowPhoneNoZero === inputNoZero;
    });

    if (found) {
         const data = resolveBlacklistRowData(found);
         phoneWarning.classList.remove('hidden');
         phoneWarning.textContent = `⚠️ 此號碼在黑名單中！(${data.reason})`;
         this.style.borderColor = 'red'; 
         this.style.backgroundColor = '#fef2f2';
    }
});

function setupStoreTransferUI() {
    const currentStoreName = getSelectedStoreName();
    storeTransferOptionsContainer.innerHTML = '';
    allStoresCache.forEach(store => {
        if (!store.name || store.name === '店名' || store.name === currentStoreName) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn bg-white border border-gray-200 text-gray-600 text-xs px-2 py-1 hover:bg-gray-50';
        btn.textContent = `⇄ ${store.name}`;
        btn.onclick = () => { editTransferStoreInput.value = store.name; };
        storeTransferOptionsContainer.appendChild(btn);
    });
}

clearStoreTransferBtn.addEventListener('click', () => {
    editTransferStoreInput.value = '';
    editTransferDateInput.value = '';
    editStoreTransferHidden.value = '';
});

function openEditModal(order) {
    document.getElementById('editRowIndex').value = order['__row'];
    document.getElementById('editCustomerID').value = order['客號']||'';
    document.getElementById('editCustomerName').value = order['姓名']||'';
    document.getElementById('editPhone').value = order['電話']||order['連絡電話']||'';
    document.getElementById('editProductAName').value = order['客訂商品A']||'';
    document.getElementById('editProductASpec').value = order['A商品規格']||'';
    document.getElementById('editProductAQty').value = order['A數量']||'';
    document.getElementById('editProductBName').value = order['客訂商品B']||'';
    document.getElementById('editProductBSpec').value = order['B商品規格']||'';
    document.getElementById('editProductBQty').value = order['B數量']||'';
    document.getElementById('editPaid').checked = (order['paid'] === '是' || order['paid'] === true || order['付清'] === '是');
    document.getElementById('editNotes').value = order['備註']||'';
    document.getElementById('editLineName').value = order['LINE名稱'] || '';
    document.getElementById('editLineNotify').checked = isChecked(order['Line通知']);
    
    setInputDate('editPurchaseDate', order['採購日期']);
    setInputDate('editArrivalDate', order['到貨日期']);
    setInputDate('editPickupDate', order['取走日期']);
    
    setupStoreTransferUI();
    
    const transferVal = order['分店調撥'] || '';
    editStoreTransferHidden.value = transferVal;
    editTransferStoreInput.value = '';
    editTransferDateInput.value = '';
    
    if (transferVal && transferVal.includes('⇄')) {
        const content = transferVal.replace('⇄', '').trim();
        const parts = content.split(/\s+/);
        if (parts.length >= 2) {
            const dateStr = parts.pop();
            const storeName = parts.join(' ');
            editTransferStoreInput.value = storeName;
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                editTransferDateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // utils.js pad
            }
        } else {
             editTransferStoreInput.value = content;
        }
    }

    try {
      const missed = parseMultiDateStringToArray(order['未接電話日期']);
      const notify = parseMultiDateStringToArray(order['通知日期']);
      editMissedCtrl.setItems(missed);
      editNotifyCtrl.setItems(notify);
    } catch(e) { console.warn(e); }

    editModal.classList.remove('hidden');
}

document.getElementById('editForm').addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const tStore = editTransferStoreInput.value.trim();
    const tDate = editTransferDateInput.value;
    if (tStore) {
        editStoreTransferHidden.value = `⇄ ${tStore} ${tDate}`; 
    } else {
        editStoreTransferHidden.value = '';
    }
    const fd = new FormData(e.target); 
    fd.append('action','update'); 
    fd.append('store', storeSelect.value); 
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: fd }); 
        alert('更新成功'); 
        editModal.classList.add('hidden'); 
        fetchOrders(); 
    } catch(err) { alert('更新失敗: ' + err.message); }
});

document.getElementById('deleteEdit').addEventListener('click', () => { 
    if(confirm('確定要刪除這筆訂單嗎？')) { deleteRow(document.getElementById('editRowIndex').value); }
});

async function deleteRow(idx) { 
    const fd = new FormData(); 
    fd.append('action', 'delete'); 
    fd.append('row', idx); 
    fd.append('store', storeSelect.value); 
    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: fd }); 
        alert('已刪除'); 
        editModal.classList.add('hidden'); 
        const ltModal = document.getElementById('longTerm_editModalBackdrop');
        if(ltModal) ltModal.classList.add('hidden');
        fetchOrders(); 
    } catch(err) { alert('刪除失敗: ' + err.message); }
}

document.getElementById('closeEditModal').addEventListener('click', () => editModal.classList.add('hidden'));

// ==========================================
// 5. 歷史查詢 (History Search)
// ==========================================
const historyModalBackdrop = document.getElementById('historyModalBackdrop');
const historySearchInput = document.getElementById('historySearchInput');
const historyTableBody = document.getElementById('history-table-body');
const historyTableHeaders = document.getElementById('history-table-headers');
const historyNoData = document.getElementById('historyNoData');
const historyLoader = document.getElementById('historyLoader');

document.getElementById('searchHistoryBtn').addEventListener('click', () => {
    const store = storeSelect.value;
    if (!store) { alert('請先選擇分店才能查詢該店的歷史資料'); return; }
    historySearchInput.value = '';
    historyTableBody.innerHTML = '';
    historyTableHeaders.innerHTML = '';
    historyNoData.textContent = '請輸入關鍵字進行搜尋';
    historyNoData.classList.remove('hidden');
    historyModalBackdrop.classList.remove('hidden');
});

document.getElementById('closeHistoryModal').addEventListener('click', () => historyModalBackdrop.classList.add('hidden'));
document.getElementById('historySearchBtn').addEventListener('click', performHistorySearch);
historySearchInput.addEventListener('keydown', (e) => { if(e.key==='Enter') performHistorySearch(); });

async function performHistorySearch() {
    const store = storeSelect.value;
    const term = historySearchInput.value.trim();
    if (!term) { alert('請輸入搜尋關鍵字 (例如姓名、電話或商品名稱)'); return; }
    
    historyLoader.classList.remove('hidden');
    historyTableBody.innerHTML = '';
    historyTableHeaders.innerHTML = ''; 
    historyNoData.classList.add('hidden');
    
    try {
        const url = `${SCRIPT_URL}?action=search_history&store=${encodeURIComponent(store)}&term=${encodeURIComponent(term)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        
        if(json.result === 'success') {
            let rows = json.rows || [];
            const headers = json.headers || [];
            if (term) {
                const lowerTerm = term.toLowerCase();
                rows = rows.filter(r => {
                    return Object.entries(r).some(([key, val]) => {
                        if (key === '__row') return false;
                        return String(val).toLowerCase().includes(lowerTerm);
                    });
                });
            }
            if(rows.length === 0) {
                historyNoData.textContent = '查無符合資料';
                historyNoData.classList.remove('hidden');
            } else {
                renderHistoryTable(headers, rows);
            }
        } else { alert('查詢失敗：' + json.error); }
    } catch(e) { console.error(e); alert('查詢錯誤'); } finally { historyLoader.classList.add('hidden'); }
}

function renderHistoryTable(headers, rows) {
    historyTableHeaders.innerHTML = '';
    const displayCols = ['歸檔日期', '客號', '姓名', '電話', '連絡電話', '客訂商品A', '商品', '取走日期', '備註'];
    const colNames = [];
    headers.forEach(h => {
        const shouldShow = displayCols.some(k => h.includes(k)) || h.includes('Date') || h.includes('日期');
        if(shouldShow) { 
            const th = document.createElement('th');
            th.textContent = h;
            th.className = "sticky top-0 bg-gray-100 px-4 py-2 border-b font-bold whitespace-nowrap";
            historyTableHeaders.appendChild(th);
            colNames.push(h);
        }
    });
    rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        colNames.forEach(key => {
            const td = document.createElement('td');
            td.className = "px-4 py-2 whitespace-nowrap text-sm";
            let val = row[key]; 
            if(typeof val === 'string' && val.includes('T') && val.includes(':')) { val = val.split('T')[0]; }
            td.textContent = (val !== undefined && val !== null) ? val : '-';
            tr.appendChild(td);
        });
        historyTableBody.appendChild(tr);
    });
}