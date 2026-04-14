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

// 記錄先前有效的下拉選單值
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
// 2. 資料讀取與連動選單 (Fetch Data & Select)
// ==========================================

function populateStoreSelect(region) {
    if (!storeSelect) return;
    storeSelect.innerHTML = '<option value="">請選擇店別</option>';

    if (!region) {
        storeSelect.disabled = true;
        return;
    }

    storeSelect.disabled = false;
    let targetStores = [];

    if (region === 'OTHER') {
        targetStores = allStoresCache.filter(s => !s.region && s.code && s.name !== '店名' && s.code !== '店編號');
    } else {
        targetStores = allStoresCache.filter(s => s.region === region && s.code && s.name !== '店名' && s.code !== '店編號');
    }

    targetStores.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `STORE_${s.code}`;
        opt.dataset.type = 'STORE';
        opt.dataset.value = s.code;
        opt.dataset.name = s.name || s.code;
        opt.dataset.region = s.region || 'OTHER'; // 儲存所屬區域供驗證使用
        opt.textContent = `🏠 ${s.code} - ${s.name}`;
        storeSelect.appendChild(opt);
    });
}

const regionSelect = document.getElementById('regionSelect');
if (regionSelect) {
    regionSelect.addEventListener('change', () => {
        populateStoreSelect(regionSelect.value);
        
        // 切換區域時重置狀態，但不觸發密碼輸入
        storeSelect.value = '';
        previousStoreSelectValue = '';
        currentValidStoreType = 'ALL';
        currentValidStoreValue = '';
        updateStoreDisplay();
        setupFormStoreSelect();
        
        allOrders = [];
        allLongTermOrders = [];
        renderTable();
        if (typeof renderLongTermTable === 'function') renderLongTermTable();
    });
}

async function fetchStores() {
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=stores&t=${new Date().getTime()}`);
        const json = await resp.json();
        const stores = json.stores || [];
        allStoresCache = stores; 

        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">請選擇區域</option>';
            const regions = [...new Set(stores.map(s => s.region).filter(Boolean))];
            regions.forEach(r => {
                regionSelect.innerHTML += `<option value="${r}">📍 ${r}</option>`;
            });

            const noRegionStores = stores.filter(s => !s.region && s.name !== '店名' && s.code !== '店編號');
            if(noRegionStores.length > 0) {
                regionSelect.innerHTML += '<option value="OTHER">📁 其他分店</option>';
            }
        }

        const savedVal = localStorage.getItem('selected_store_value');
        if(savedVal) {
            let targetRegion = '';
            if (savedVal.startsWith('STORE_')) {
                const sCode = savedVal.replace('STORE_', '');
                const st = allStoresCache.find(s => s.code === sCode);
                if (st) targetRegion = st.region ? st.region : 'OTHER';
            }

            if (targetRegion && regionSelect) {
                regionSelect.value = targetRegion;
                populateStoreSelect(targetRegion);
                
                if (Array.from(storeSelect.options).some(o => o.value === savedVal)) {
                    storeSelect.value = savedVal; 
                    previousStoreSelectValue = savedVal;
                    
                    // 恢復時設定目前生效的資料範圍
                    currentValidStoreType = localStorage.getItem('auth_type') || 'STORE';
                    currentValidStoreValue = localStorage.getItem('auth_value') || savedVal.replace('STORE_', '');
                    
                    updateStoreDisplay(); 
                    setupFormStoreSelect();
                }
            }
        }
        
        if(typeof checkStoreSettings === 'function') checkStoreSettings(); 
    } catch(e) { console.error('Fetch Stores Error:', e); }
}

function setupFormStoreSelect() {
    const formStoreSelect = document.getElementById('formStoreSelect');
    const blAddStore = document.getElementById('blacklist_addStore');
    if(!formStoreSelect) return;
    
    formStoreSelect.innerHTML = '<option value="">請選擇建檔店別</option>';
    if(blAddStore) blAddStore.innerHTML = '<option value="">請選擇提報店別</option>';
    
    let availableStores = allStoresCache;
    // 如果是區經理授權，表單選單僅顯示該區分店
    if (currentValidStoreType === 'REGION') {
        availableStores = allStoresCache.filter(s => s.region === currentValidStoreValue);
    } else if (currentValidStoreType === 'STORE') {
        availableStores = allStoresCache.filter(s => s.code === currentValidStoreValue);
    }
    
    availableStores.forEach(s => {
        if(s.name === '店名' || s.code === '店編號') return;
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
    } else {
        formStoreSelect.style.pointerEvents = 'auto';
        formStoreSelect.classList.remove('bg-gray-100');
    }
}

storeSelect.addEventListener('change', async () => {
    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        previousStoreSelectValue = '';
        currentValidStoreType = 'ALL';
        currentValidStoreValue = '';
        updateStoreDisplay();
        setupFormStoreSelect();
        fetchOrders();
        return;
    }

    const storeCode = selectedOption.dataset.value;
    const storeName = selectedOption.textContent.replace(/^[🌟📍📁🏠]\s*/, '');
    const storeRegion = selectedOption.dataset.region;

    const input = prompt(`請輸入 ${storeName} 的店密碼，\n或輸入【區經理代碼】查看該區域所有訂單：`);

    if (!input) { 
        storeSelect.value = previousStoreSelectValue; 
        return; 
    }

    submitButton.disabled = true; 
    
    try {
        const fd = new FormData();
        fd.append('action', 'verify_store_password');
        fd.append('storeCode', storeCode);
        fd.append('password', input.trim());
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();

        if (json.result === 'success') {
            // 設定權限範圍：'STORE' 或 'REGION'
            currentValidStoreType = json.scope; 
            currentValidStoreValue = json.authorizedValue;
            previousStoreSelectValue = selectedOption.value;
            
            localStorage.setItem('selected_store_value', selectedOption.value);
            localStorage.setItem('auth_type', currentValidStoreType);
            localStorage.setItem('auth_value', currentValidStoreValue);

            updateStoreDisplay();
            setupFormStoreSelect();
            if(typeof checkStoreSettings === 'function') checkStoreSettings();
            
            if (json.scope === 'REGION') {
                alert(`區經理驗證成功！已解鎖【${storeRegion}】區域所有資料。`);
            }
            fetchOrders();
        } else {
            alert('驗證失敗：密碼或代碼錯誤。');
            storeSelect.value = previousStoreSelectValue; 
        }
    } catch (e) {
        console.error(e);
        alert('連線失敗，請檢查網路。');
        storeSelect.value = previousStoreSelectValue;
    } finally {
        submitButton.disabled = false;
    }
});

async function fetchOrders() {
    dataLoader.classList.remove('hidden');
    dataTableBody.innerHTML = '';
    noDataText.classList.add('hidden');
    dataMessageBox.classList.add('hidden');
    
    // 根據驗證後獲得的範圍抓取資料
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
        if(order['缺貨通知日期']) dateDisplay += `<div class="text-xs text-red-600 font-bold">缺貨通知: ${formatDateMMDD(order['傾貨通知日期'])}</div>`;
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
