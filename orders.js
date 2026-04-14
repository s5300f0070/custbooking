// --- 這裡不要重複宣告 regionSelect 等已在 utils.js 宣告過的常數 ---

let previousStoreSelectValue = '';

window.addEventListener('load', async () => {
    renderTabs();
    await fetchStores();
    await fetchOrders(); 
    if(typeof fetchBlacklistData === 'function') fetchBlacklistData();
});

function toggleBackupBtn() {
    const backupBtn = document.getElementById('backupBtn');
    if (backupBtn) {
        if (currentValidStoreType === 'REGION') {
            backupBtn.classList.remove('hidden');
        } else {
            backupBtn.classList.add('hidden');
        }
    }
}

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
        toggleBackupBtn();
        
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
            if (savedVal.startsWith('REGION_')) {
                targetRegion = savedVal.replace('REGION_', '');
            } else if (savedVal.startsWith('STORE_')) {
                const sCode = savedVal.replace('STORE_', '');
                const st = allStoresCache.find(s => s.code === sCode);
                if (st) targetRegion = st.region ? st.region : 'OTHER';
            }
            if (targetRegion && regionSelect) {
                regionSelect.value = targetRegion;
                populateStoreSelect(targetRegion);
                
                if (savedVal.startsWith('REGION_')) {
                    const allOpt = document.createElement('option');
                    allOpt.value = savedVal;
                    allOpt.dataset.type = 'REGION';
                    allOpt.dataset.value = targetRegion;
                    allOpt.dataset.name = `全區 (${targetRegion})`;
                    allOpt.dataset.region = targetRegion;
                    allOpt.textContent = `👁️ ${targetRegion} 全區`;
                    allOpt.style.display = 'none';
                    storeSelect.appendChild(allOpt);
                }

                if (Array.from(storeSelect.options).some(o => o.value === savedVal)) {
                    storeSelect.value = savedVal; 
                    previousStoreSelectValue = savedVal;
                    currentValidStoreType = localStorage.getItem('auth_type') || 'STORE';
                    currentValidStoreValue = localStorage.getItem('auth_value') || (savedVal.startsWith('REGION_') ? targetRegion : savedVal.replace('STORE_', ''));
                    updateStoreDisplay(); 
                    setupFormStoreSelect();
                    toggleBackupBtn();
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
        localStorage.removeItem('selected_store_value'); updateStoreDisplay(); fetchOrders(); toggleBackupBtn(); return;
    }

    if (selectedOption.dataset.type === 'REGION') return;

    const storeCode = selectedOption.dataset.value;
    const storeName = selectedOption.dataset.name;

    const input = prompt(`請輸入 ${storeName} 的店密碼：`);
    if (!input) { storeSelect.value = previousStoreSelectValue; return; }

    try {
        const fd = new FormData();
        fd.append('action', 'verify_store_password');
        fd.append('storeCode', storeCode);
        fd.append('password', input.trim());
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();

        if (json.result === 'success') {
            currentValidStoreType = 'STORE'; 
            currentValidStoreValue = storeCode;
            previousStoreSelectValue = selectedOption.value;
            localStorage.setItem('selected_store_value', selectedOption.value);
            localStorage.setItem('auth_type', currentValidStoreType);
            localStorage.setItem('auth_value', currentValidStoreValue);

            updateStoreDisplay();
            setupFormStoreSelect();
            if(typeof checkStoreSettings === 'function') checkStoreSettings();
            toggleBackupBtn();
            
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

    if (currentValidStoreType === 'ALL' || !currentValidStoreValue) {
        allOrders = []; 
        allLongTermOrders = [];
        renderTable(); 
        if(typeof renderLongTermTable === 'function') renderLongTermTable();
        return;
    }

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
        if (noDataText) {
            noDataText.textContent = (currentValidStoreType === 'ALL') ? '請先於上方選擇店別以查看訂單' : '沒有找到符合的訂單';
            noDataText.classList.remove('hidden'); 
        }
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
        
        const storeTag = currentValidStoreType !== 'STORE' 
            ? `<div class="text-xs font-bold text-gray-500 mb-1">📍 ${order['店編號']||order['店別']||''}</div>` 
            : '';
        
        const isAOut = isChecked(order['A缺貨']) ? '<span class="text-red-600 font-bold mr-1">[缺貨]</span>' : '';
        const productA = order['客訂商品A'] ? `${isAOut}[${order['客訂商品A']}]${order['A商品規格'] ? `(${order['A商品規格']})` : ''} ${order['A數量'] ? 'x' + order['A數量'] : ''}` : '';
        
        const isBOut = isChecked(order['B缺貨']) ? '<span class="text-red-600 font-bold mr-1">[缺貨]</span>' : '';
        const productB = order['客訂商品B'] ? `${isBOut}[${order['客訂商品B']}]${order['B商品規格'] ? `(${order['B商品規格']})` : ''} ${order['B數量'] ? 'x' + order['B數量'] : ''}` : '';

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
        if(order['分店調撥']) dateDisplay += `<div class="text-xs text-indigo-600 font-bold">調撥: ${String(order['分店調撥']).trim()}</div>`;
        if(order['採購日期']) dateDisplay += `<div class="text-xs text-blue-600">採購: ${formatMulti(order['採購日期'])}</div>`;
        if(order['到貨日期']) dateDisplay += `<div class="text-xs text-purple-600">到貨: ${formatMulti(order['到貨日期'])}</div>`;
        if(order['缺貨通知日期']) dateDisplay += `<div class="text-xs text-red-600 font-bold">缺貨通知: ${formatMulti(order['缺貨通知日期'])}</div>`;
        if(order['未接電話日期']) dateDisplay += `<div class="text-xs text-red-500">未接: ${formatMulti(order['未接電話日期'])}</div>`;
        if(order['通知日期']) dateDisplay += `<div class="text-xs text-orange-600">通知: ${formatMulti(order['通知日期'])}</div>`;
        if(order['取走日期']) dateDisplay += `<div class="text-xs text-green-600">取走: ${formatMulti(order['取走日期'])}</div>`;
        
        if(!dateDisplay) {
            dateDisplay = `<div class="text-xs text-gray-400">${formatDateMMDD(order['最後更新時間'] || order['建立日期'])}</div>`;
        }

        const paidDisplay = isChecked(order['付清'] || order['paid']) ? '<span class="text-green-600 font-bold">是</span>' : '<span class="text-gray-400">否</span>';

        tr.innerHTML = `
          <td><span class="status-badge ${status.class}">${status.label}</span></td>
          <td data-label="姓名" class="font-medium text-gray-900">${storeTag}${order['姓名'] || '未知'}</td>
          <td data-label="手機號碼">${formatPhone(order['電話'] || order['連絡電話'] || '')}</td>
          <td data-label="商品" class="mobile-full-width">
             <div class="font-medium text-indigo-900">${productA}</div>
             ${productB ? `<div class="font-medium text-indigo-900 mt-1">${productB}</div>` : ''}
          </td>
          <td data-label="進度" class="text-gray-700">${dateDisplay}</td>
          <td data-label="付清">${paidDisplay}</td>
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

const regionManagerBtn = document.getElementById('regionManagerBtn');
if (regionManagerBtn) {
    regionManagerBtn.addEventListener('click', async () => {
        const region = regionSelect ? regionSelect.value : '';
        if (!region) {
            alert('請先於左側下拉選單選擇要查看的「區域」！');
            return;
        }
        
        const input = prompt(`請輸入【${region}】區的區經理代碼：`);
        if (!input) return;

        try {
            const firstStore = allStoresCache.find(s => s.region === region && s.code);
            const storeCodeForCheck = firstStore ? firstStore.code : '';

            const fd = new FormData();
            fd.append('action', 'verify_store_password');
            fd.append('storeCode', storeCodeForCheck);
            fd.append('password', input.trim());
            
            const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
            const json = await resp.json();

            if (json.result === 'success' && json.scope === 'REGION') {
                currentValidStoreType = 'REGION'; 
                currentValidStoreValue = json.authorizedValue || region;
                
                let allOpt = Array.from(storeSelect.options).find(o => o.value === `REGION_${currentValidStoreValue}`);
                if (!allOpt) {
                    allOpt = document.createElement('option');
                    allOpt.value = `REGION_${currentValidStoreValue}`;
                    allOpt.dataset.type = 'REGION';
                    allOpt.dataset.value = currentValidStoreValue;
                    allOpt.dataset.name = `全區 (${currentValidStoreValue})`;
                    allOpt.dataset.region = currentValidStoreValue;
                    allOpt.textContent = `👁️ ${currentValidStoreValue} 全區`;
                    allOpt.style.display = 'none';
                    storeSelect.appendChild(allOpt);
                }
                
                storeSelect.value = allOpt.value;
                previousStoreSelectValue = allOpt.value;

                localStorage.setItem('selected_store_value', allOpt.value);
                localStorage.setItem('auth_type', currentValidStoreType);
                localStorage.setItem('auth_value', currentValidStoreValue);

                updateStoreDisplay();
                if (typeof setupFormStoreSelect === 'function') setupFormStoreSelect();
                if (typeof checkStoreSettings === 'function') checkStoreSettings();
                toggleBackupBtn();
                
                alert(`區經理驗證成功！已進入【${currentValidStoreValue}】全區模式。`);
                fetchOrders();
            } else {
                alert('驗證失敗：區經理代碼錯誤或權限不足。');
            }
        } catch (e) {
            alert('連線失敗');
        }
    });
}
