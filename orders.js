// ==========================================
// 1. 初始化與入口 (Init)
// ==========================================

const editMissedCtrl = setupTagControls(document.getElementById('editAddMissed'), document.getElementById('editStampMissed'), document.getElementById('editMissedInput'), document.getElementById('editMissedTags'), document.getElementById('editMissedHidden'));
const editNotifyCtrl = setupTagControls(document.getElementById('editAddNotify'), document.getElementById('editStampNotify'), document.getElementById('editNotifyInput'), document.getElementById('editNotifyTags'), document.getElementById('editNotifyHidden'));

const editTransferStoreInput = document.getElementById('editTransferStoreInput');
const editTransferDateInput = document.getElementById('editTransferDateInput');
const editStoreTransferHidden = document.getElementById('editStoreTransfer');
const storeTransferOptionsContainer = document.getElementById('storeTransferOptions');
const clearStoreTransferBtn = document.getElementById('clearStoreTransfer');

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

// 記錄先前有效的下拉選單值，用於驗證失敗時還原
let previousStoreSelectValue = '';

window.addEventListener('load', async () => {
    renderTabs();
    await fetchStores();
    await fetchOrders(); 
    
    if(typeof fetchBlacklistData === 'function') {
        fetchBlacklistData();
    }
});

// ==========================================
// 2. 資料讀取 (Fetch Data)
// ==========================================

function populateStoreSelect(region) {
    if (!storeSelect) return;
    storeSelect.innerHTML = '<option value="">請選擇店別</option>';

    if (!region) {
        storeSelect.disabled = true;
        return;
    }

    storeSelect.disabled = false;

    if (region === 'ALL') {
        const opt = document.createElement('option');
        opt.value = 'ALL';
        opt.dataset.type = 'ALL';
        opt.dataset.value = '';
        opt.textContent = '🌟 總部 (全部)';
        storeSelect.appendChild(opt);
    } else if (region === 'OTHER') {
        const noRegionStores = allStoresCache.filter(s => !s.region);
        noRegionStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `STORE_${s.code}`;
            opt.dataset.type = 'STORE';
            opt.dataset.value = s.code;
            opt.dataset.name = s.name || s.code;
            opt.textContent = `🏠 ${s.code} - ${s.name}`;
            storeSelect.appendChild(opt);
        });
    } else {
        const rOpt = document.createElement('option');
        rOpt.value = `REGION_${region}`;
        rOpt.dataset.type = 'REGION';
        rOpt.dataset.value = region;
        rOpt.textContent = `📁 ${region} (全部)`;
        storeSelect.appendChild(rOpt);

        const rStores = allStoresCache.filter(s => s.region === region);
        rStores.forEach(s => {
            const opt = document.createElement('option');
            opt.value = `STORE_${s.code}`;
            opt.dataset.type = 'STORE';
            opt.dataset.value = s.code;
            opt.dataset.name = s.name || s.code;
            opt.textContent = `🏠 ${s.code} - ${s.name}`;
            storeSelect.appendChild(opt);
        });
    }
}

if (regionSelect) {
    regionSelect.addEventListener('change', () => {
        populateStoreSelect(regionSelect.value);
        
        // 切換區域時重置畫面與授權狀態
        storeSelect.value = '';
        previousStoreSelectValue = '';
        currentValidStoreType = 'ALL';
        currentValidStoreValue = '';
        updateStoreDisplay();
        setupFormStoreSelect();
        
        // 清空列表避免跨區殘留資料
        if (typeof renderTable === 'function') {
            allOrders = [];
            allLongTermOrders = [];
            renderTable();
            if (typeof renderLongTermTable === 'function') renderLongTermTable();
        }
    });
}

async function fetchStores() {
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=stores`);
        const json = await resp.json();
        const stores = json.stores || [];
        allStoresCache = stores; 

        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">請選擇區域</option>';
            regionSelect.innerHTML += '<option value="ALL">🌟 總部 (全區)</option>';

            const regions = [...new Set(stores.map(s => s.region).filter(Boolean))];
            regions.forEach(r => {
                regionSelect.innerHTML += `<option value="${r}">📍 ${r}</option>`;
            });

            const noRegionStores = stores.filter(s => !s.region);
            if(noRegionStores.length > 0) {
                regionSelect.innerHTML += '<option value="OTHER">📁 其他分店</option>';
            }
        }

        const savedVal = localStorage.getItem('selected_store_value');
        if(savedVal) {
            let targetRegion = '';
            if (savedVal === 'ALL') {
                targetRegion = 'ALL';
            } else if (savedVal.startsWith('REGION_')) {
                targetRegion = savedVal.replace('REGION_', '');
            } else if (savedVal.startsWith('STORE_')) {
                const sCode = savedVal.replace('STORE_', '');
                const st = allStoresCache.find(s => s.code === sCode);
                if (st) {
                    targetRegion = st.region ? st.region : 'OTHER';
                }
            }

            if (targetRegion && regionSelect) {
                regionSelect.value = targetRegion;
                populateStoreSelect(targetRegion);
                
                if (Array.from(storeSelect.options).some(o => o.value === savedVal)) {
                    storeSelect.value = savedVal; 
                    previousStoreSelectValue = savedVal;
                    
                    const opt = storeSelect.options[storeSelect.selectedIndex];
                    currentValidStoreType = opt.dataset.type || 'ALL';
                    currentValidStoreValue = opt.dataset.value || '';
                    
                    updateStoreDisplay(); 
                    setupFormStoreSelect();
                }
            }
        }
        
        if(typeof checkStoreSettings === 'function') checkStoreSettings(); 
    } catch(e) { console.error('Fetch Stores Error:', e); }
}

// 動態更新表單中的店別下拉選單
function setupFormStoreSelect() {
    const formStoreSelect = document.getElementById('formStoreSelect');
    const blAddStore = document.getElementById('blacklist_addStore');
    
    if(!formStoreSelect) return;
    
    formStoreSelect.innerHTML = '<option value="">請選擇建檔店別</option>';
    if(blAddStore) blAddStore.innerHTML = '<option value="">請選擇提報店別</option>';
    
    let availableStores = allStoresCache;
    if (currentValidStoreType === 'REGION') {
        availableStores = allStoresCache.filter(s => s.region === currentValidStoreValue);
    } else if (currentValidStoreType === 'STORE') {
        availableStores = allStoresCache.filter(s => s.code === currentValidStoreValue);
    }
    
    availableStores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.code;
        opt.textContent = `${s.code} - ${s.name}`;
        formStoreSelect.appendChild(opt);
        if(blAddStore) blAddStore.appendChild(opt.cloneNode(true));
    });
    
    if (currentValidStoreType === 'STORE') {
        formStoreSelect.value = currentValidStoreValue;
        formStoreSelect.style.pointerEvents = 'none';
        formStoreSelect.classList.add('bg-gray-100');
        if(blAddStore) {
            blAddStore.value = currentValidStoreValue;
            blAddStore.style.pointerEvents = 'none';
            blAddStore.classList.add('bg-gray-100');
        }
    } else {
        formStoreSelect.style.pointerEvents = 'auto';
        formStoreSelect.classList.remove('bg-gray-100');
        if(blAddStore) {
            blAddStore.style.pointerEvents = 'auto';
            blAddStore.classList.remove('bg-gray-100');
        }
    }
}

storeSelect.addEventListener('change', async () => {
    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        previousStoreSelectValue = '';
        currentValidStoreType = 'ALL';
        currentValidStoreValue = '';
        localStorage.removeItem('selected_store_value');
        updateStoreDisplay();
        setupFormStoreSelect();
        fetchOrders();
        return;
    }

    const targetType = selectedOption.dataset.type;
    const targetValue = selectedOption.dataset.value;
    const targetName = selectedOption.textContent.replace(/^[🌟📍📁🏠]\s*/, '');

    const input = prompt(`您即將切換至：${targetName}\n\n為確保安全性，請輸入對應的密碼或代碼：`);

    if (!input) { 
        storeSelect.value = previousStoreSelectValue; 
        return; 
    }

    submitButton.disabled = true; 
    const isVerified = await verifyAccess(targetType, targetValue, input.trim());
    submitButton.disabled = false;

    if (isVerified) {
        previousStoreSelectValue = selectedOption.value;
        currentValidStoreType = targetType;
        currentValidStoreValue = targetValue;
        
        localStorage.setItem('selected_store_value', selectedOption.value);
        updateStoreDisplay();
        setupFormStoreSelect();
        if(typeof checkStoreSettings === 'function') checkStoreSettings();
        fetchOrders();
    } else {
        alert('驗證失敗 (密碼或代碼錯誤)，還原至上一個選擇。');
        storeSelect.value = previousStoreSelectValue; 
    }
});

async function fetchOrders() {
    dataLoader.classList.remove('hidden');
    dataTableBody.innerHTML = '';
    noDataText.classList.add('hidden');
    dataMessageBox.classList.add('hidden');
    
    const url = `${SCRIPT_URL}?type=${currentValidStoreType}&value=${encodeURIComponent(currentValidStoreValue || '')}`;
    
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
        
        renderTableHeaders(['姓名', '手機號碼', '商品', '進度', '付清', '建立日期', '最後更新']);
        if(typeof renderLongTermTableHeaders === 'function') renderLongTermTableHeaders(['姓名', '手機號碼', '商品', '進度', '付清', '建立日期', '最後更新']);

        renderTable(); 
        if(typeof renderLongTermTable === 'function') renderLongTermTable();

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
        
        const storeTag = `<div class="text-xs font-bold text-gray-500 mb-1">📍 ${order['店編號']||order['店別']||order['分店']||''}</div>`;
        const isAOut = isChecked(order['A缺貨']) ? '<span class="text-red-600 font-bold mr-1">[缺貨]</span>' : '';
        const productA = order['客訂商品A'] ? `${isAOut}[${order['客訂商品A']}]${order['A商品規格'] ? `(${order['A商品規格']})` : ''} ${order['A數量'] ? 'x' + order['A數量'] : ''}` : '';
        const isBOut = isChecked(order['B缺貨']) ? '<span class="text-red-600 font-bold mr-1">[缺貨]</span>' : '';
        const productB = order['客訂商品B'] ? `${isBOut}[${order['客訂商品B']}]${order['B商品規格'] ? `(${order['B商品規格']})` : ''} ${order['B數量'] ? 'x' + order['B數量'] : ''}` : '';
        
        let transferDisplay = '';
        if (order['分店調撥'] && order['分店調撥'].trim()) {
             const val = order['分店調撥'].trim();
             let displayTxt = val.replace('⇄', '').trim();
             const parts = displayTxt.split(/\s+/);
             if (parts.length > 1) {
                 const datePart = parts[parts.length-1];
                 const formattedDate = formatDateMMDD(datePart);
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
        if(order['缺貨通知日期']) dateDisplay += `<div class="text-xs text-red-600 font-bold">缺貨通知: ${formatDateMMDD(order['缺貨通知日期'])}</div>`;
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
          <td data-label="姓名" class="font-medium text-gray-900">${storeTag}${order['姓名'] || '未知'}</td>
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
    const formStoreVal = document.getElementById('formStoreSelect').value;
    if(!formStoreVal) { alert('請選擇要建檔的店別！'); return; }
    
    submitButton.disabled = true; 
    submitButton.textContent = '送出中...';
    
    try {
      const fd = new FormData(orderForm);
      fd.append('action', 'append');
      await fetch(SCRIPT_URL, { method: 'POST', body: fd });
      alert('訂單已送出'); 
      orderForm.reset(); 
      setupFormStoreSelect();
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
    document.getElementById('editProductAOutStock').checked = isChecked(order['A缺貨']);
    document.getElementById('editProductASpec').value = order['A商品規格']||'';
    document.getElementById('editProductAQty').value = order['A數量']||'';
    
    document.getElementById('editProductBName').value = order['客訂商品B']||'';
    document.getElementById('editProductBOutStock').checked = isChecked(order['B缺貨']);
    document.getElementById('editProductBSpec').value = order['B商品規格']||'';
    document.getElementById('editProductBQty').value = order['B數量']||'';
    
    document.getElementById('editPaid').checked = (order['paid'] === '是' || order['paid'] === true || order['付清'] === '是');
    document.getElementById('editNotes').value = order['備註']||'';
    document.getElementById('editLineName').value = order['LINE名稱'] || '';
    document.getElementById('editLineNotify').checked = isChecked(order['Line通知']);
    
    setInputDate('editPurchaseDate', order['採購日期']);
    setInputDate('editArrivalDate', order['到貨日期']);
    setInputDate('editOutStockDate', order['缺貨通知日期']);
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
                editTransferDateInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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
    
    if (!document.getElementById('editProductAOutStock').checked) fd.append('A缺貨', '');
    if (!document.getElementById('editProductBOutStock').checked) fd.append('B缺貨', '');
    if (!document.getElementById('editPaid').checked) fd.append('付清', '');
    if (!document.getElementById('editLineNotify').checked) fd.append('Line通知', '');

    fd.append('action','update'); 
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
    const term = historySearchInput.value.trim();
    if (!term) { alert('請輸入搜尋關鍵字 (例如姓名、電話或商品名稱)'); return; }
    
    historyLoader.classList.remove('hidden');
    historyTableBody.innerHTML = '';
    historyTableHeaders.innerHTML = ''; 
    historyNoData.classList.add('hidden');
    
    try {
        const url = `${SCRIPT_URL}?action=search_history&type=${currentValidStoreType}&value=${encodeURIComponent(currentValidStoreValue)}&term=${encodeURIComponent(term)}`;
        const resp = await fetch(url);
        const json = await resp.json();
        
        if(json.result === 'success') {
            let rows = json.rows || [];
            const headers = json.headers || [];
            
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