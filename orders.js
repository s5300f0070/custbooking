// --- 這裡不要重複宣告 regionSelect 等已在 utils.js 宣告過的常數 ---

let previousStoreSelectValue = '';

window.addEventListener('load', async () => {
    renderTabs();
    await fetchStores();
    await fetchOrders(); 
    if(typeof fetchBlacklistData === 'function') fetchBlacklistData();
});

function populateStoreSelect(region) {
    if (!storeSelect) return;
    storeSelect.innerHTML = '<option value="">請選擇店別</option>';
    if (!region) { storeSelect.disabled = true; return; }

    storeSelect.disabled = false;
    let targetStores = (region === 'OTHER') 
        ? allStoresCache.filter(s => !s.region && s.code)
        : allStoresCache.filter(s => s.region === region && s.code);

    targetStores.forEach(s => {
        if(s.name === '店名' || s.code === '店編號') return;
        const opt = document.createElement('option');
        opt.value = `STORE_${s.code}`;
        opt.dataset.type = 'STORE';
        opt.dataset.value = s.code;
        opt.dataset.name = s.name || s.code;
        opt.dataset.region = s.region || 'OTHER';
        opt.textContent = `🏠 ${s.code} - ${s.name}`;
        storeSelect.appendChild(opt);
    });
}

if (regionSelect) {
    regionSelect.addEventListener('change', () => {
        populateStoreSelect(regionSelect.value);
        storeSelect.value = '';
        previousStoreSelectValue = '';
        currentValidStoreType = 'ALL';
        currentValidStoreValue = '';
        updateStoreDisplay();
        
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
        allStoresCache = json.stores || []; 

        if (regionSelect) {
            regionSelect.innerHTML = '<option value="">請選擇區域</option>';
            const regions = [...new Set(allStoresCache.map(s => s.region).filter(Boolean))];
            regions.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r; opt.textContent = `📍 ${r}`;
                regionSelect.appendChild(opt);
            });
            if(allStoresCache.some(s => !s.region)) {
                const opt = document.createElement('option');
                opt.value = 'OTHER'; opt.textContent = '📁 其他分店';
                regionSelect.appendChild(opt);
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

storeSelect.addEventListener('change', async () => {
    const selectedOption = storeSelect.options[storeSelect.selectedIndex];
    if (!selectedOption || !selectedOption.value) {
        previousStoreSelectValue = ''; currentValidStoreType = 'ALL'; currentValidStoreValue = '';
        localStorage.removeItem('selected_store_value'); updateStoreDisplay(); fetchOrders(); return;
    }

    const storeCode = selectedOption.dataset.value;
    const storeName = selectedOption.text.replace(/^[🌟📍📁🏠]\s*/, '');
    const storeRegion = selectedOption.dataset.region;

    const input = prompt(`請輸入 ${storeName} 的店密碼，\n或輸入【區經理代碼】查看該區域所有訂單：`);
    if (!input) { storeSelect.value = previousStoreSelectValue; return; }

    try {
        const fd = new FormData();
        fd.append('action', 'verify_store_password');
        fd.append('storeCode', storeCode);
        fd.append('password', input.trim());
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();

        if (json.result === 'success') {
            currentValidStoreType = json.scope; 
            currentValidStoreValue = json.authorizedValue;
            previousStoreSelectValue = selectedOption.value;
            localStorage.setItem('selected_store_value', selectedOption.value);
            localStorage.setItem('auth_type', currentValidStoreType);
            localStorage.setItem('auth_value', currentValidStoreValue);

            updateStoreDisplay();
            setupFormStoreSelect();
            if(typeof checkStoreSettings === 'function') checkStoreSettings();
            if (json.scope === 'REGION') alert(`區經理驗證成功！已解鎖【${storeRegion}】區域。`);
            fetchOrders();
        } else {
            alert('驗證失敗：密碼錯誤。');
            storeSelect.value = previousStoreSelectValue; 
        }
    } catch (e) { alert('連線失敗'); storeSelect.value = previousStoreSelectValue; }
});

async function fetchOrders() {
    const dataLoader = document.getElementById('dataLoader');
    const dataTableBody = document.getElementById('data-table-body');
    if(!dataLoader || !dataTableBody) return;

    dataLoader.classList.remove('hidden');
    dataTableBody.innerHTML = '';
    const url = `${SCRIPT_URL}?type=${currentValidStoreType}&value=${encodeURIComponent(currentValidStoreValue || '')}`;
    
    try {
        const resp = await fetch(url);
        const json = await resp.json();
        const rows = json.rows || [];
        allOrders = []; allLongTermOrders = [];
        rows.forEach(r => {
            if(r['固定/長期客訂'] === '是' || r['固定/長期客訂'] === true) allLongTermOrders.push(r);
            else allOrders.push(r);
        });
        renderTable(); 
        if(typeof renderLongTermTable === 'function') renderLongTermTable();
    } catch(e) { console.error(e); } finally { dataLoader.classList.add('hidden'); }
}

function renderTable() {
    const dataTableBody = document.getElementById('data-table-body');
    const tableContainer = document.getElementById('dataTableContainer');
    const noDataText = document.getElementById('noDataText');
    const searchInput = document.getElementById('searchInput');
    if(!dataTableBody) return;

    dataTableBody.innerHTML = '';
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    let filtered = allOrders.filter(o => {
        const status = getStatus(o);
        if (currentFilter !== 'all' && status.key !== currentFilter) return false;
        if (!term) return true;
        return Object.values(o).some(val => String(val).toLowerCase().includes(term));
    });

    filtered.sort((a,b) => new Date(b['最後更新時間'] || b['建立日期'] || 0) - new Date(a['最後更新時間'] || a['建立日期'] || 0));
    
    if(filtered.length === 0) { 
        noDataText && noDataText.classList.remove('hidden'); 
        tableContainer && tableContainer.classList.add('hidden'); 
        return; 
    } 
    noDataText && noDataText.classList.add('hidden'); 
    tableContainer && tableContainer.classList.remove('hidden'); 

    filtered.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = isChecked(order['Line通知']) 
            ? 'bg-green-100 hover:bg-green-200 cursor-pointer border-l-4 border-green-400' 
            : 'bg-white even:bg-gray-50 hover:bg-indigo-50 cursor-pointer';

        tr.onclick = (e) => { if(!e.target.closest('button')) openEditModal(order); };
        const status = getStatus(order);
        const storeTag = `<div class="text-xs font-bold text-gray-500 mb-1">📍 ${order['店編號']||order['店別']||''}</div>`;
        const pA = order['客訂商品A'] ? `[${order['客訂商品A']}]` : '';

        tr.innerHTML = `
          <td><span class="status-badge ${status.class}">${status.label}</span></td>
          <td data-label="姓名" class="font-medium text-gray-900">${storeTag}${order['姓名'] || '未知'}</td>
          <td data-label="手機號碼">${formatPhone(order['電話'] || order['連絡電話'] || '')}</td>
          <td data-label="商品" class="mobile-full-width"><div class="font-medium text-indigo-900">${pA}</div></td>
          <td data-label="進度" class="text-gray-500">${formatDateMMDD(order['最後更新時間'] || order['建立日期'])}</td>
          <td data-label="付清">${isChecked(order['付清']) ? '是' : '否'}</td>
          <td data-label="建立日期" class="text-xs text-gray-400">${formatDateMMDD(order['建立日期'])}</td>
          <td data-label="最後更新" class="text-xs text-gray-400">${formatDateMMDD(order['最後更新時間'])}</td>
        `;
        dataTableBody.appendChild(tr);
    });
}

function setupFormStoreSelect() {
    const formStoreSelect = document.getElementById('formStoreSelect');
    if(!formStoreSelect) return;
    formStoreSelect.innerHTML = '<option value="">請選擇建檔店別</option>';
    let available = allStoresCache;
    if (currentValidStoreType === 'REGION') available = allStoresCache.filter(s => s.region === currentValidStoreValue);
    else if (currentValidStoreType === 'STORE') available = allStoresCache.filter(s => s.code === currentValidStoreValue);
    
    available.forEach(s => {
        if(s.name === '店名' || s.code === '店編號') return;
        const opt = document.createElement('option');
        opt.value = s.code; opt.textContent = `${s.code} - ${s.name}`;
        formStoreSelect.appendChild(opt);
    });
    if (currentValidStoreType === 'STORE') {
        formStoreSelect.value = currentValidStoreValue; formStoreSelect.style.pointerEvents = 'none'; formStoreSelect.classList.add('bg-gray-100');
    } else {
        formStoreSelect.style.pointerEvents = 'auto'; formStoreSelect.classList.remove('bg-gray-100');
    }
}

function renderTabs() {
    const STATUS_TABS = [ { key: 'all', label: '全部' }, { key: '未處理', label: '未處理' }, { key: '已採購', label: '已採購' }, { key: '已到貨', label: '已到貨' }, { key: '已通知', label: '已通知' }, { key: '未接', label: '未接' }, { key: '已取貨', label: '已取貨' } ];
    const container = document.getElementById('statusTabs');
    if(!container) return;
    container.innerHTML = STATUS_TABS.map(tab => `<button class="tab-btn ${tab.key === currentFilter ? 'active' : ''}" onclick="setFilter('${tab.key}')">${tab.label}</button>`).join('');
}
window.setFilter = (key) => { currentFilter = key; renderTabs(); renderTable(); };
