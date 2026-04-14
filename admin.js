// ==========================================
// 0. 共用工具與一般訂單編輯 (Regular Orders)
// ==========================================
function setInputDate(id, val) {
    const el = document.getElementById(id);
    if(el) el.value = toDateOnly(val) || '';
}

function parseMultiDateStringToArray(val) {
    if(!val) return [];
    return String(val).split(/[,;，\s]+/).filter(Boolean);
}

function renderStoreTransferTags(val) {
    const container = document.getElementById('storeTransferOptions');
    if(!container) return;
    container.innerHTML = '';
    if(!val) return;
    const tag = document.createElement('span');
    tag.className = 'tag bg-indigo-50 text-indigo-700 border-indigo-200';
    tag.innerHTML = `${val} <span class="remove cursor-pointer text-red-500 ml-1 font-bold">&times;</span>`;
    tag.querySelector('.remove').addEventListener('click', () => {
        document.getElementById('editStoreTransfer').value = '';
        renderStoreTransferTags('');
    });
    container.appendChild(tag);
}

const editModal = document.getElementById('editModalBackdrop');
const editMissedCtrl = setupTagControls(document.getElementById('editAddMissed'), document.getElementById('editStampMissed'), document.getElementById('editMissedInput'), document.getElementById('editMissedTags'), document.getElementById('editMissedHidden'));
const editNotifyCtrl = setupTagControls(document.getElementById('editAddNotify'), document.getElementById('editStampNotify'), document.getElementById('editNotifyInput'), document.getElementById('editNotifyTags'), document.getElementById('editNotifyHidden'));

const tStoreInput = document.getElementById('editTransferStoreInput');
const tDateInput = document.getElementById('editTransferDateInput');
const tHiddenInput = document.getElementById('editStoreTransfer');

function updateStoreTransfer() {
    if(tStoreInput && tDateInput && tStoreInput.value && tDateInput.value) {
        const val = `${tStoreInput.value} (${tDateInput.value})`;
        if(tHiddenInput) tHiddenInput.value = val;
        renderStoreTransferTags(val);
        tStoreInput.value = '';
        tDateInput.value = '';
    }
}
tStoreInput?.addEventListener('change', updateStoreTransfer);
tDateInput?.addEventListener('change', updateStoreTransfer);

window.deleteRow = async function(rowIdx) {
    try {
        const fd = new FormData();
        fd.append('action', 'delete');
        fd.append('row', rowIdx);
        fd.append('store', storeSelect.value);
        await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        alert('刪除成功');
        if(editModal) editModal.classList.add('hidden');
        if(document.getElementById('longTerm_editModalBackdrop')) document.getElementById('longTerm_editModalBackdrop').classList.add('hidden');
        if(typeof fetchOrders === 'function') fetchOrders();
    } catch(err) {
        alert('刪除失敗');
    }
};

window.openEditModal = function(order) {
    document.getElementById('editRowIndex').value = order['__row'];
    document.getElementById('editCustomerID').value = order['客號'] || '';
    document.getElementById('editCustomerName').value = order['姓名'] || '';
    document.getElementById('editPhone').value = order['電話'] || order['連絡電話'] || '';
    document.getElementById('editLineNotify').checked = isChecked(order['Line通知']);
    document.getElementById('editLineName').value = order['LINE名稱'] || '';

    document.getElementById('editProductAName').value = order['客訂商品A'] || '';
    document.getElementById('editProductAOutStock').checked = isChecked(order['A缺貨']);
    document.getElementById('editProductAQty').value = order['A數量'] || '';
    document.getElementById('editProductASpec').value = order['A商品規格'] || '';

    document.getElementById('editProductBName').value = order['客訂商品B'] || '';
    document.getElementById('editProductBOutStock').checked = isChecked(order['B缺貨']);
    document.getElementById('editProductBQty').value = order['B數量'] || '';
    document.getElementById('editProductBSpec').value = order['B商品規格'] || '';

    if(tHiddenInput) tHiddenInput.value = order['分店調撥'] || '';
    if(tStoreInput) tStoreInput.value = '';
    if(tDateInput) tDateInput.value = '';
    renderStoreTransferTags(order['分店調撥']);

    setInputDate('editPurchaseDate', order['採購日期']);
    setInputDate('editArrivalDate', order['到貨日期']);
    setInputDate('editPickupDate', order['取走日期']);
    setInputDate('editOutStockDate', order['缺貨通知日期']);

    try {
        editMissedCtrl.setItems(parseMultiDateStringToArray(order['未接電話日期']));
        editNotifyCtrl.setItems(parseMultiDateStringToArray(order['通知日期']));
    } catch(e) { console.warn(e); }

    document.getElementById('editPaid').checked = isChecked(order['付清']);
    document.getElementById('editNotes').value = order['備註'] || order['說明'] || '';

    if(editModal) editModal.classList.remove('hidden');
};

document.getElementById('editForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!document.getElementById('editProductAOutStock').checked) fd.append('A缺貨', '');
    if (!document.getElementById('editProductBOutStock').checked) fd.append('B缺貨', '');
    if (!document.getElementById('editLineNotify').checked) fd.append('Line通知', '');
    if (!document.getElementById('editPaid').checked) fd.append('付清', '');

    fd.append('action', 'update');
    fd.append('store', storeSelect.value);

    try {
        await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        alert('更新成功');
        if(editModal) editModal.classList.add('hidden');
        if (typeof fetchOrders === 'function') fetchOrders();
    } catch(err) {
        alert('更新失敗');
    }
});

document.getElementById('deleteEdit')?.addEventListener('click', () => {
    if (confirm('確定要刪除這筆訂單嗎？此動作無法復原。')) {
        deleteRow(document.getElementById('editRowIndex').value);
    }
});

document.getElementById('closeEditModal')?.addEventListener('click', () => {
    if(editModal) editModal.classList.add('hidden');
});

document.getElementById('clearStoreTransfer')?.addEventListener('click', () => {
    if(tHiddenInput) tHiddenInput.value = '';
    renderStoreTransferTags('');
});


// ==========================================
// 1. 長期客訂 (Long Term Orders)
// ==========================================
const longTermEditModal = document.getElementById('longTerm_editModalBackdrop');
const longTerm_dataTableBody = document.getElementById('longTerm_data-table-body');
const longTerm_noDataText = document.getElementById('longTerm_noDataText');
const longTerm_tableContainer = document.getElementById('longTerm_dataTableContainer');

const longTerm_editPurchaseCtrl = setupTagControls(document.getElementById('longTerm_editAddPurchase'), document.getElementById('longTerm_editStampPurchase'), document.getElementById('longTerm_editPurchaseInput'), document.getElementById('longTerm_editPurchaseTags'), document.getElementById('longTerm_editPurchaseHidden'));
const longTerm_editArrivalCtrl = setupTagControls(document.getElementById('longTerm_editAddArrival'), document.getElementById('longTerm_editStampArrival'), document.getElementById('longTerm_editArrivalInput'), document.getElementById('longTerm_editArrivalTags'), document.getElementById('longTerm_editArrivalHidden'));
const longTerm_editPickupCtrl = setupTagControls(document.getElementById('longTerm_editAddPickup'), document.getElementById('longTerm_editStampPickup'), document.getElementById('longTerm_editPickupInput'), document.getElementById('longTerm_editPickupTags'), document.getElementById('longTerm_editPickupHidden'));
const longTerm_editMissedCtrl = setupTagControls(document.getElementById('longTerm_editAddMissed'), document.getElementById('longTerm_editStampMissed'), document.getElementById('longTerm_editMissedInput'), document.getElementById('longTerm_editMissedTags'), document.getElementById('longTerm_editMissedHidden'));
const longTerm_editNotifyCtrl = setupTagControls(document.getElementById('longTerm_editAddNotify'), document.getElementById('longTerm_editStampNotify'), document.getElementById('longTerm_editNotifyInput'), document.getElementById('longTerm_editNotifyTags'), document.getElementById('longTerm_editNotifyHidden'));

document.getElementById('longTerm_searchButton')?.addEventListener('click', renderLongTermTable);
document.getElementById('longTerm_searchInput')?.addEventListener('input', renderLongTermTable);
document.getElementById('longTerm_refreshButton')?.addEventListener('click', () => {
    if(typeof fetchOrders === 'function') fetchOrders(); 
});

function renderLongTermTableHeaders(displayHeaders){
    const headersContainer = document.getElementById('longTerm_data-table-headers');
    if(!headersContainer) return;
    headersContainer.innerHTML = '';
    const headers = ['狀態', ...displayHeaders];
    headers.forEach(h=>{
      const th = document.createElement('th');
      th.className = 'sticky top-0 z-30 bg-gray-100 text-gray-900 font-bold px-4 py-3 border-b-2 border-gray-200 whitespace-nowrap';
      th.textContent = h;
      headersContainer.appendChild(th);
    });
}

function renderLongTermTable() {
    if(!longTerm_dataTableBody) return;
    longTerm_dataTableBody.innerHTML = '';
    const term = document.getElementById('longTerm_searchInput')?.value.trim().toLowerCase() || '';
    
    let filtered = allLongTermOrders.filter(o => {
        if (!term) return true;
        return Object.values(o).some(val => String(val).toLowerCase().includes(term));
    });
    
    if(filtered.length === 0) { 
        if(longTerm_noDataText) longTerm_noDataText.classList.remove('hidden'); 
        if(longTerm_tableContainer) longTerm_tableContainer.classList.add('hidden');
        return; 
    } else { 
        if(longTerm_noDataText) longTerm_noDataText.classList.add('hidden'); 
        if(longTerm_tableContainer) longTerm_tableContainer.classList.remove('hidden');
    }
    
    filtered.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white even:bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors';
        tr.onclick = (e) => { if(e.target.closest('button')) return; openLongTermEditModal(order); };
        const status = getStatus(order);
        
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
        if(order['採購日期']) dateDisplay += `<div class="text-xs text-blue-600">採購: ${formatMulti(order['採購日期'])}</div>`;
        if(order['到貨日期']) dateDisplay += `<div class="text-xs text-purple-600">到貨: ${formatMulti(order['到貨日期'])}</div>`;
        if(order['缺貨通知日期']) dateDisplay += `<div class="text-xs text-red-600 font-bold">缺貨通知: ${formatMulti(order['缺貨通知日期'])}</div>`;
        if(order['未接電話日期']) dateDisplay += `<div class="text-xs text-red-500">未接: ${formatMulti(order['未接電話日期'])}</div>`;
        if(order['通知日期']) dateDisplay += `<div class="text-xs text-orange-600">通知: ${formatMulti(order['通知日期'])}</div>`;
        if(order['取走日期']) dateDisplay += `<div class="text-xs text-green-600">取走: ${formatMulti(order['取走日期'])}</div>`;
        
        let phoneDisplay = formatPhone(order['電話'] || order['連絡電話']);
        const isPaid = isChecked(order['付清'] || order['paid']);
        const paidDisplay = isPaid ? '<span class="text-green-600 font-bold">是</span>' : '<span class="text-gray-400">否</span>';
        const createdDate = formatDateMMDD(order['建立日期'] || order['creationDate'] || order['建立時間']);
        const updatedDate = formatDateMMDD(order['最後更新時間']);

        tr.innerHTML = `
          <td><span class="status-badge ${status.class}">${status.label}</span></td>
          <td data-label="姓名" class="font-medium text-gray-900">${order['姓名'] || '未知'}</td>
          <td data-label="手機號碼">${phoneDisplay}</td>
          <td data-label="商品" class="mobile-full-width">
             <div class="font-medium text-blue-900">${productA}</div>
             ${productB ? `<div class="font-medium text-blue-900 mt-1">${productB}</div>` : ''}
          </td>
          <td data-label="進度" class="text-gray-500">${dateDisplay || '-'}</td>
          <td data-label="付清">${paidDisplay}</td>
          <td data-label="建立日期" class="text-xs text-gray-400">${createdDate}</td>
          <td data-label="最後更新" class="text-xs text-gray-400">${updatedDate}</td>
        `;

        longTerm_dataTableBody.appendChild(tr);
    });
}

function openLongTermEditModal(order) {
    document.getElementById('longTerm_editRowIndex').value = order['__row'];
    document.getElementById('longTerm_editCustomerID').value = order['客號']||'';
    document.getElementById('longTerm_editCustomerName').value = order['姓名']||'';
    document.getElementById('longTerm_editPhone').value = order['電話']||order['連絡電話']||'';
    
    document.getElementById('longTerm_editProductAName').value = order['客訂商品A']||'';
    document.getElementById('longTerm_editProductAOutStock').checked = isChecked(order['A缺貨']);
    document.getElementById('longTerm_editProductASpec').value = order['A商品規格']||'';
    document.getElementById('longTerm_editProductAQty').value = order['A數量']||'';
    
    document.getElementById('longTerm_editProductBName').value = order['客訂商品B']||'';
    document.getElementById('longTerm_editProductBOutStock').value = order['B缺貨']||'';
    document.getElementById('longTerm_editProductBSpec').value = order['B商品規格']||'';
    document.getElementById('longTerm_editProductBQty').value = order['B數量']||'';
    
    document.getElementById('longTerm_editPaid').checked = isChecked(order['paid'] || order['付清']);
    document.getElementById('longTerm_editStoreTransfer').value = order['分店調撥'] || '';
    document.getElementById('longTerm_editNotes').value = order['備註'] || order['說明'] || '';
    
    setInputDate('longTerm_editOutStockInput', order['缺貨通知日期']);
    
    try{
        longTerm_editPurchaseCtrl.setItems(parseMultiDateStringToArray(order['採購日期']));
        longTerm_editArrivalCtrl.setItems(parseMultiDateStringToArray(order['到貨日期']));
        longTerm_editPickupCtrl.setItems(parseMultiDateStringToArray(order['取走日期']));
        longTerm_editMissedCtrl.setItems(parseMultiDateStringToArray(order['未接電話日期']));
        longTerm_editNotifyCtrl.setItems(parseMultiDateStringToArray(order['通知日期']));
    }catch(e){ console.warn(e); }

    if(longTermEditModal) longTermEditModal.classList.remove('hidden');
}

document.getElementById('longTerm_editForm')?.addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    
    if (!document.getElementById('longTerm_editProductAOutStock').checked) fd.append('A缺貨', '');
    if (!document.getElementById('longTerm_editPaid').checked) fd.append('付清', '');

    fd.append('action','update'); 
    fd.append('store',storeSelect.value); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); 
    if(longTermEditModal) longTermEditModal.classList.add('hidden'); 
    if(typeof fetchOrders === 'function') fetchOrders(); 
});

document.getElementById('longTerm_deleteEdit')?.addEventListener('click', ()=>{ 
    if(confirm('確定要刪除這筆長期客訂嗎？此動作無法復原。')) {
        deleteRow(document.getElementById('longTerm_editRowIndex').value); 
    }
});

document.getElementById('longTerm_closeEditModal')?.addEventListener('click', () => {
    if(longTermEditModal) longTermEditModal.classList.add('hidden');
});


// ==========================================
// 2. 黑名單管理 (Blacklist)
// ==========================================
const blacklistEditModal = document.getElementById('blacklist_editModalBackdrop');

async function fetchBlacklistData() {
    const loader = document.getElementById('blacklist_dataLoader');
    if (loader) loader.classList.remove('hidden');
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=blacklist`);
        const json = await resp.json();
        allBlacklistData = json.rows || json.data || json.blacklist || [];
        renderBlacklistTable();
    } catch(e) { console.error(e); } finally { 
        if (loader) loader.classList.add('hidden'); 
    }
}

function renderBlacklistTable() {
    const tbody = document.getElementById('blacklist_data-table-body');
    const noData = document.getElementById('blacklist_noDataText');
    const tableContainer = document.getElementById('blacklist_dataTableContainer');
    const searchInput = document.getElementById('blacklist_searchInput');
    
    if (!tbody) return;
    tbody.innerHTML = '';
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    
    // 權限與名稱過濾修正
    let scopedData = allBlacklistData.filter(row => {
        const b = resolveBlacklistRowData(row);
        if (currentValidStoreType === 'STORE') {
            const matchStore = allStoresCache.find(s => s.code === currentValidStoreValue);
            return b.store === currentValidStoreValue || (matchStore && b.store === matchStore.name);
        } else if (currentValidStoreType === 'REGION') {
            const storeObj = allStoresCache.find(s => s.code === b.store || s.name === b.store);
            return storeObj && storeObj.region === currentValidStoreValue;
        }
        return true; 
    });

    const filtered = scopedData.filter(row => {
        if(!term) return true;
        return Object.values(row).some(val => String(val).toLowerCase().includes(term));
    });

    filtered.sort((a, b) => {
        const dateA = new Date(resolveBlacklistRowData(a).date || 0).getTime();
        const dateB = new Date(resolveBlacklistRowData(b).date || 0).getTime();
        return dateB - dateA;
    });
    
    if(filtered.length === 0) { 
        if(noData) noData.classList.remove('hidden'); 
        if(tableContainer) tableContainer.classList.add('hidden'); 
        return; 
    } else { 
        if(noData) noData.classList.add('hidden'); 
        if(tableContainer) tableContainer.classList.remove('hidden'); 
    }
    
    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-red-50 cursor-pointer transition-colors border-b border-gray-100';
        tr.onclick = (e) => { if(e.target.closest('button')) return; openBlacklistEditModal(row); };
        
        const data = resolveBlacklistRowData(row);
        const dateVal = formatFieldValueIfDate('日期', data.date);
        const phoneVal = formatPhone(data.phone);

        let displayStoreName = data.store;
        if (allStoresCache && allStoresCache.length > 0) {
            const match = allStoresCache.find(s => s.code === data.store || s.name === data.store);
            if (match && match.name) displayStoreName = match.name;
        }

        tr.innerHTML = `
          <td data-label="狀態" class="px-4 py-3"><span class="status-badge missed">黑名單</span></td>
          <td data-label="操作" class="px-4 py-3 text-center"> 
             <button type="button" class="btn bg-red-100 text-red-600 px-2 py-1 text-xs" onclick="event.stopPropagation(); deleteBlacklistRow(${row['__row']})">刪除</button>
          </td>
          <td data-label="客號" class="px-4 py-3 text-gray-700">${data.id || '-'}</td>
          <td data-label="姓名" class="px-4 py-3 font-bold text-gray-900">${data.name || '未知'}</td>
          <td data-label="電話" class="px-4 py-3 text-gray-700">${phoneVal || '-'}</td>
          <td data-label="店別" class="px-4 py-3"><span class="tag bg-red-50 text-red-700 border-red-200">${displayStoreName || '-'}</span></td>
          <td data-label="原因" class="px-4 py-3 text-red-600 font-medium">${data.reason || '-'}</td>
          <td data-label="日期" class="px-4 py-3 text-sm text-gray-500">${dateVal}</td>
        `;
        tbody.appendChild(tr);
    });
}

function openBlacklistEditModal(row) {
    document.getElementById('blacklist_editRowIndex').value = row['__row'] || row['row'] || '';
    const data = resolveBlacklistRowData(row);
    document.getElementById('bl_edit_phone').value = data.phone;
    document.getElementById('bl_edit_name').value = data.name;
    document.getElementById('bl_edit_custID').value = data.id !== '-' ? data.id : '';
    document.getElementById('bl_edit_reason').value = data.reason;
    
    const dateField = document.getElementById('bl_edit_date');
    if (dateField) dateField.value = toDateOnly(data.date) || todayLocalForInput();

    let note = row['備註'] || row['Note'] || row['說明'] || '';
    document.getElementById('bl_edit_notes').value = note;
    
    const storeField = document.getElementById('bl_edit_store');
    if (storeField) storeField.value = data.store || '';
    
    if(blacklistEditModal) blacklistEditModal.classList.remove('hidden');
}

async function deleteBlacklistRow(rowIndex) {
    if (!confirm('確定要刪除這筆黑名單資料嗎？此動作無法復原。')) return;
    try {
        const fd = new FormData();
        fd.append('action', 'delete');
        fd.append('row', rowIndex);
        fd.append('targetSheet', 'blacklist'); 
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();
        if (json.result === 'success') {
            alert('刪除成功');
            fetchBlacklistData();
        } else {
            alert('刪除失敗：' + json.error);
        }
    } catch(e) {
        alert('刪除失敗：' + e.message);
    }
}

function populateBlacklistStoreSelect() {
    const select = document.getElementById('blacklist_addStore');
    if(!select) return;
    select.innerHTML = '<option value="">選擇提報店別</option>';
    let available = allStoresCache;
    if (currentValidStoreType === 'REGION') available = allStoresCache.filter(s => s.region === currentValidStoreValue);
    else if (currentValidStoreType === 'STORE') available = allStoresCache.filter(s => s.code === currentValidStoreValue);
    
    available.forEach(s => {
        if(s.name === '店名' || s.code === '店編號') return;
        const opt = document.createElement('option');
        opt.value = s.code; opt.textContent = `${s.code} - ${s.name}`;
        select.appendChild(opt);
    });
    
    if (currentValidStoreType === 'STORE') {
        select.value = currentValidStoreValue;
        select.style.pointerEvents = 'none';
        select.classList.add('bg-gray-100');
    } else {
        select.style.pointerEvents = 'auto';
        select.classList.remove('bg-gray-100');
    }
}

document.getElementById('blacklist_searchButton')?.addEventListener('click', renderBlacklistTable);
document.getElementById('blacklist_searchInput')?.addEventListener('input', renderBlacklistTable);

document.getElementById('blacklist_addButton')?.addEventListener('click', () => { 
    populateBlacklistStoreSelect();
    document.getElementById('blacklist_addModalBackdrop').classList.remove('hidden'); 
});

document.getElementById('blacklist_closeAddModal')?.addEventListener('click', () => document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'));
document.getElementById('blacklist_cancelAdd')?.addEventListener('click', () => document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'));
document.getElementById('blacklist_closeEditModal')?.addEventListener('click', () => { if(blacklistEditModal) blacklistEditModal.classList.add('hidden'); });
document.getElementById('blacklist_cancelEdit')?.addEventListener('click', () => { if(blacklistEditModal) blacklistEditModal.classList.add('hidden'); });

document.getElementById('blacklist_addForm')?.addEventListener('submit', async(e)=>{
    e.preventDefault();
    try { 
        const fd = new FormData(e.target); 
        fd.append('action', 'add_blacklist'); 
        fd.append('targetSheet', 'blacklist');
        const today = todayLocalForInput();
        const currentStore = document.getElementById('blacklist_addStore').value;
        fd.append('日期', today);
        fd.append('Date', today);
        fd.append('建立日期', today);
        fd.append('時間', today);
        if(currentStore) {
            fd.append('店別', currentStore);
            fd.append('分店', currentStore);
            fd.append('Store', currentStore);
            fd.append('StoreName', currentStore);
        }
        await fetch(SCRIPT_URL, {method:'POST', body:fd}); 
        alert('新增成功'); 
        e.target.reset(); 
        document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'); 
        fetchBlacklistData(); 
    } catch(e) { alert('失敗: ' + e.message); }
});

document.getElementById('blacklist_editForm')?.addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    fd.append('action','update'); 
    fd.append('targetSheet','blacklist'); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); 
    if(blacklistEditModal) blacklistEditModal.classList.add('hidden'); 
    fetchBlacklistData(); 
});


// ==========================================
// 3. 店別設定與鎖定 (Store Settings)
// ==========================================
const storeLockCheckbox = document.getElementById('storeLockCheckbox');
const notifyToggle = document.getElementById('notifyToggle');
const notifyLongTermToggle = document.getElementById('notifyLongTermToggle');

async function checkStoreSettings() {
    try {
        if (!storeSelect || storeSelect.selectedIndex < 0) return;
        const selectedOption = storeSelect.options[storeSelect.selectedIndex];
        if (!selectedOption || !selectedOption.value) {
            if(storeLockCheckbox) storeLockCheckbox.checked = false;
            if(notifyToggle) { notifyToggle.checked = false; notifyToggle.disabled = true; }
            if(notifyLongTermToggle) { notifyLongTermToggle.checked = false; notifyLongTermToggle.disabled = true; }
            return;
        }

        const storeCode = selectedOption.dataset.value;
        if (!storeCode) return;
        const store = allStoresCache.find(s => s.code === storeCode);
        if (!store) { console.warn('找不到店資料:', storeCode); return; }

        const isLocked = store.locked === true || store.locked === 'true' || store.locked === '1';
        if (storeLockCheckbox) storeLockCheckbox.checked = isLocked;

        if (isLocked) {
            storeSelect.classList.add('select-disabled');
            if(typeof showTopMessage === 'function') showTopMessage('店別已鎖定', false);
        } else {
            storeSelect.classList.remove('select-disabled');
            if(typeof showTopMessage === 'function') showTopMessage('', false);
        }
        
        const storeName = store.name || storeCode;
        if(notifyToggle) notifyToggle.disabled = false; 
        if(notifyLongTermToggle) notifyLongTermToggle.disabled = false;
        
        // 抓取通知狀態設定
        const resp = await fetch(`${SCRIPT_URL}?action=get_store_settings&store=${encodeURIComponent(storeName)}`);
        const json = await resp.json();
        if (json.result === 'success') {
            if(notifyToggle) notifyToggle.checked = (json.settings.notify_enabled === '1');
            if(notifyLongTermToggle) notifyLongTermToggle.checked = (json.settings.notify_long_term === '1');
        }
    } catch (e) {
        console.error('checkStoreSettings error:', e);
    }
}

async function setStoreLockValue(locked){
    if(!storeSelect.value) return;
    try{
        const params = new URLSearchParams();
        params.append('action', 'set_store_lock');
        params.append('store', storeSelect.value);
        params.append('locked', locked ? '1' : '0');
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const json = await resp.json();
        return json && json.result === 'success';
    }catch(err){ console.warn('setStoreLockValue error', err); return false; }
}

if(storeLockCheckbox) {
    storeLockCheckbox.addEventListener('change', async () => {
        const store = storeSelect.value;
        const locked = storeLockCheckbox.checked;
        if(!store){ 
            if(typeof showTopMessage === 'function') showTopMessage('請先選擇店別', true); 
            storeLockCheckbox.checked = false; 
            return; 
        }
        if(locked){
            storeSelect.classList.add('select-disabled');
        } else {
            storeSelect.classList.remove('select-disabled');
        }
        if(typeof showTopMessage === 'function') showTopMessage(locked ? '店別已鎖定' : '店別已解鎖', false);
        const ok = await setStoreLockValue(locked);
        if(!ok){
            if(typeof showTopMessage === 'function') showTopMessage('設定店別鎖定失敗，已還原狀態', true);
            storeLockCheckbox.checked = !locked;
            if(!locked) storeSelect.classList.add('select-disabled');
            else storeSelect.classList.remove('select-disabled');
        }
    });
}

if(notifyToggle) {
    notifyToggle.addEventListener('change', async (e) => {
        const store = storeSelect.value; 
        if (!store) {
            e.preventDefault();
            notifyToggle.checked = false; 
            alert('未選取店別無法開啟逾期Line通知');
            return;
        }
        const isEnabled = notifyToggle.checked;
        const msg = isEnabled ? '開啟' : '關閉';
        try {
            const params = new URLSearchParams();
            params.append('action', 'set_notify_status');
            params.append('store', store); 
            params.append('enabled', isEnabled ? '1' : '0');
            const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
            const json = await resp.json();
            if (json.result === 'success') {
                if(typeof showTopMessage === 'function') showTopMessage(`已${msg}逾期通知`, false);
            } else {
                throw new Error(json.error || '設定失敗');
            }
        } catch (err) {
            alert('設定失敗: ' + err.message);
            notifyToggle.checked = !isEnabled; 
        }
    });
}

if (notifyLongTermToggle) {
    notifyLongTermToggle.addEventListener('change', async (e) => {
        const store = storeSelect.value; 
        if (!store) {
            e.preventDefault();
            notifyLongTermToggle.checked = false; 
            alert('未選取店別無法設定');
            return;
        }
        const isEnabled = notifyLongTermToggle.checked;
        try {
            const params = new URLSearchParams();
            params.append('action', 'set_notify_long_term');
            params.append('store', store); 
            params.append('enabled', isEnabled ? '1' : '0');
            const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
            const json = await resp.json();
            if (json.result === 'success') {
                if(typeof showTopMessage === 'function') showTopMessage(`已${isEnabled ? '開啟' : '關閉'}包含長期客訂逾期通知`, false);
            } else {
                throw new Error(json.error || '設定失敗');
            }
        } catch (err) {
            alert('設定失敗: ' + err.message);
            notifyLongTermToggle.checked = !isEnabled; 
        }
    });
}

// ==========================================
// 4. 資料備份與清理 (Backup & Clean)
// ==========================================
const backupModalBackdrop = document.getElementById('backupModalBackdrop');
const backupModalContent = document.getElementById('backupModalContent');
const confirmBackupBtn = document.getElementById('confirmBackupBtn');

document.getElementById('refreshStoresBtn')?.addEventListener('click', async()=>{ 
    const fd = new FormData();
    fd.append('action','create_store_sheets');
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    if(typeof fetchStores === 'function') await fetchStores(); 
});

document.getElementById('backupBtn')?.addEventListener('click', () => {
    const store = storeSelect.value;
    const storeName = getSelectedStoreName();
    let htmlContent = '';
    if (store) {
        htmlContent = `
          <p class="font-bold text-gray-800 mb-2">確定要備份 [${storeName}] 的資料嗎？</p>
          <ul class="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>系統將會建立一個獨立的備份檔案。</li>
            <li>檔案名稱將包含當前日期時間。</li>
            <li>這不會影響目前的運作。</li>
          </ul>`;
    } else {
        htmlContent = `
          <p class="font-bold text-gray-800 mb-2">您尚未選擇分店，系統將執行【完整備份】。</p>
          <ul class="list-disc pl-5 text-sm text-gray-600 space-y-1">
            <li>備份內容包含所有分店訂單、黑名單與設定。</li>
            <li>檔案較大，請耐心等候。</li>
          </ul>`;
    }
    if(backupModalContent) backupModalContent.innerHTML = htmlContent;
    if(backupModalBackdrop) backupModalBackdrop.classList.remove('hidden');
});

document.getElementById('closeBackupModal')?.addEventListener('click', () => {
    if(backupModalBackdrop) backupModalBackdrop.classList.add('hidden');
});
document.getElementById('cancelBackupBtn')?.addEventListener('click', () => {
    if(backupModalBackdrop) backupModalBackdrop.classList.add('hidden');
});

if(confirmBackupBtn) {
    confirmBackupBtn.addEventListener('click', async () => {
        const pwd = prompt('請輸入管理員密碼以確認備份：');
        if (!pwd) return;

        confirmBackupBtn.disabled = true;
        confirmBackupBtn.textContent = '驗證中...';

        const isVerified = await verifyAdminPassword(pwd);
        if (!isVerified) {
            alert('密碼錯誤，已取消備份。');
            confirmBackupBtn.disabled = false;
            confirmBackupBtn.textContent = '確認備份';
            return;
        }

        confirmBackupBtn.textContent = '備份中...';
        const store = storeSelect.value;
        const storeName = getSelectedStoreName();
        try {
            const params = new URLSearchParams();
            params.append('action', 'backup_database');
            if(store) params.append('store', storeName);
            params.append('password', pwd); 
            
            const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
            const json = await resp.json();
            if (json.result === 'success') {
                alert(json.message || '備份成功！');
                if(backupModalBackdrop) backupModalBackdrop.classList.add('hidden');
            } else {
                alert('備份失敗：' + (json.error || '未知錯誤'));
            }
        } catch (e) {
            alert('備份請求失敗：' + e.message);
        } finally {
            confirmBackupBtn.disabled = false;
            confirmBackupBtn.textContent = '確認備份';
        }
    });
}

document.getElementById('clearOverdueBtn')?.addEventListener('click', async () => {
    const store = storeSelect.value;
    if (!store) {
        alert('請先選擇要整理的分店！');
        return;
    }
    if (!confirm('確定要整理此分店的過期資料嗎？\n\n規則：\n1. 已取走且超過 5 天的資料 -> 移至歷史資料庫並刪除。\n2. 未完成的訂單不會被刪除。')) return;
    
    const btn = document.getElementById('clearOverdueBtn');
    btn.disabled = true;
    btn.textContent = '整理中...';
    try {
        const storeName = getSelectedStoreName();
        const fd = new FormData();
        fd.append('action', 'clean_overdue');
        fd.append('store', storeName); 
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();
        if (json.result === 'success') {
            alert(json.message);
            if(typeof fetchOrders === 'function') fetchOrders(); 
        } else {
            alert('整理失敗：' + json.error);
        }
    } catch(e) {
        alert('請求失敗：' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '清除逾期';
    }
});

// ==========================================
// 5. 事件綁定 (Global Event Listeners)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    if (storeSelect) storeSelect.addEventListener('change', () => setTimeout(() => { checkStoreSettings(); renderBlacklistTable(); }, 300));
    if (regionSelect) regionSelect.addEventListener('change', () => setTimeout(() => { renderBlacklistTable(); }, 300));
    
    setTimeout(() => {
        if (typeof allStoresCache !== 'undefined' && allStoresCache.length > 0) {
            checkStoreSettings();
        }
    }, 500);
});
