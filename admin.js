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

toggleAccordion(document.getElementById('longTermToggleBtn'), document.getElementById('longTermContent'), document.getElementById('longTermArrowIcon'));

document.getElementById('longTerm_searchButton').addEventListener('click', renderLongTermTable);
document.getElementById('longTerm_searchInput').addEventListener('input', renderLongTermTable);
document.getElementById('longTerm_refreshButton').addEventListener('click', () => { if(typeof fetchOrders === 'function') fetchOrders(); });

function renderLongTermTableHeaders(displayHeaders){
    if(!longTerm_dataTableHeaders) return;
    longTerm_dataTableHeaders.innerHTML = '';
    const headers = ['狀態', ...displayHeaders];
    headers.forEach(h=>{
      const th = document.createElement('th');
      th.className = 'sticky top-0 z-30 bg-gray-100 text-gray-900 font-bold px-4 py-3 border-b-2 border-gray-200 whitespace-nowrap';
      th.textContent = h;
      longTerm_dataTableHeaders.appendChild(th);
    });
}

function renderLongTermTable() {
    longTerm_dataTableBody.innerHTML = '';
    const term = document.getElementById('longTerm_searchInput').value.trim().toLowerCase();
    
    let filtered = allLongTermOrders.filter(o => {
        if (!term) return true;
        return Object.values(o).some(val => String(val).toLowerCase().includes(term));
    });
    
    if(filtered.length === 0) { 
        longTerm_noDataText.classList.remove('hidden'); 
        longTerm_tableContainer.classList.add('hidden');
        return; 
    } else { 
        longTerm_noDataText.classList.add('hidden'); 
        longTerm_tableContainer.classList.remove('hidden');
    }
    
    filtered.forEach(order => {
        const tr = document.createElement('tr');
        tr.className = 'bg-white even:bg-gray-50 hover:bg-blue-50 cursor-pointer transition-colors';
        tr.onclick = (e) => { if(e.target.closest('button')) return; openLongTermEditModal(order); };
        const status = getStatus(order);
        
        const storeTag = `<div class="text-xs font-bold text-gray-500 mb-1">📍 ${order['店編號']||order['店別']||order['分店']||''}</div>`;
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
          <td data-label="姓名" class="font-medium text-gray-900">${storeTag}${order['姓名'] || '未知'}</td>
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
    
    document.getElementById('longTerm_editPaid').checked = (order['paid'] === '是' || order['paid'] === true || order['付清'] === '是');
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

    longTermEditModal.classList.remove('hidden');
}

document.getElementById('longTerm_editForm').addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    if (!document.getElementById('longTerm_editProductAOutStock').checked) fd.append('A缺貨', '');
    if (!document.getElementById('longTerm_editPaid').checked) fd.append('付清', '');

    fd.append('action','update'); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); 
    longTermEditModal.classList.add('hidden'); 
    if(typeof fetchOrders === 'function') fetchOrders(); 
});

document.getElementById('longTerm_deleteEdit').addEventListener('click', ()=>{ 
    if(confirm('刪除?')) { if(typeof deleteRow === 'function') deleteRow(document.getElementById('longTerm_editRowIndex').value); }
});

document.getElementById('longTerm_closeEditModal').addEventListener('click', () => longTermEditModal.classList.add('hidden'));

// ==========================================
// 2. 黑名單管理 (Blacklist)
// ==========================================
toggleAccordion(document.getElementById('blacklistToggleBtn'), document.getElementById('blacklistContent'), document.getElementById('blacklistArrowIcon'));
const blacklistEditModal = document.getElementById('blacklist_editModalBackdrop');

async function fetchBlacklistData() {
    document.getElementById('blacklist_dataLoader').classList.remove('hidden');
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=blacklist`);
        const json = await resp.json();
        allBlacklistData = json.rows || [];
        renderBlacklistTable();
    } catch(e) { console.error(e); } finally { document.getElementById('blacklist_dataLoader').classList.add('hidden'); }
}

function renderBlacklistTable() {
    blacklistDataTableBody.innerHTML = '';
    const noData = document.getElementById('blacklist_noDataText');
    const tableContainer = document.getElementById('blacklist_dataTableContainer');
    const term = document.getElementById('blacklist_searchInput').value.trim().toLowerCase();
    
    const filtered = allBlacklistData.filter(row => {
        if(!term) return true;
        return Object.values(row).some(val => String(val).toLowerCase().includes(term));
    });

    filtered.sort((a, b) => new Date(resolveBlacklistRowData(b).date || 0).getTime() - new Date(resolveBlacklistRowData(a).date || 0).getTime());
    
    if(filtered.length === 0) { 
        noData.classList.remove('hidden'); tableContainer.classList.add('hidden'); return; 
    } else { 
        noData.classList.add('hidden'); tableContainer.classList.remove('hidden'); 
    }
    
    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-red-50 cursor-pointer';
        tr.onclick = (e) => { if(e.target.closest('button')) return; openBlacklistEditModal(row); };
        
        const data = resolveBlacklistRowData(row);
        let displayStoreName = data.store;
        if (allStoresCache && allStoresCache.length > 0) {
            const match = allStoresCache.find(s => s.code === data.store);
            if (match && match.name) displayStoreName = match.name;
        }

        tr.innerHTML = `
          <td class="status-badge missed">黑名單</td>
          <td class="text-center"> <button type="button" class="btn bg-red-100 text-red-600 px-2 py-1 text-xs" onclick="event.stopPropagation(); deleteBlacklistRow(${row['__row']})">刪除</button></td>
          <td data-label="客號">${data.id}</td>
          <td data-label="姓名">${data.name}</td>
          <td data-label="電話">${formatPhone(data.phone)}</td>
          <td data-label="店別">${displayStoreName}</td>
          <td data-label="原因" class="text-red-600">${data.reason}</td>
          <td data-label="日期">${formatFieldValueIfDate('日期', data.date)}</td>
        `;
        blacklistDataTableBody.appendChild(tr);
    });
}

function openBlacklistEditModal(row) {
    document.getElementById('blacklist_editRowIndex').value = row['__row'];
    const data = resolveBlacklistRowData(row);
    document.getElementById('bl_edit_phone').value = data.phone;
    document.getElementById('bl_edit_name').value = data.name;
    document.getElementById('bl_edit_custID').value = data.id;
    document.getElementById('bl_edit_reason').value = data.reason;
    document.getElementById('bl_edit_notes').value = row['備註'] || row['Note'] || '';
    blacklistEditModal.classList.remove('hidden');
}

async function deleteBlacklistRow(rowIndex) {
    if (!confirm('確定刪除？此動作無法復原。')) return;
    try {
        const fd = new FormData();
        fd.append('action', 'delete');
        fd.append('row', rowIndex);
        fd.append('targetSheet', 'blacklist'); 
        await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        alert('刪除成功');
        fetchBlacklistData();
    } catch(e) { alert('刪除失敗'); }
}

document.getElementById('blacklist_searchButton').addEventListener('click', renderBlacklistTable);
document.getElementById('blacklist_searchInput').addEventListener('input', renderBlacklistTable);

document.getElementById('blacklist_addButton').addEventListener('click', () => { 
    if(typeof setupFormStoreSelect === 'function') setupFormStoreSelect();
    document.getElementById('blacklist_addModalBackdrop').classList.remove('hidden'); 
});

document.getElementById('blacklist_closeAddModal').addEventListener('click', () => document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'));
document.getElementById('blacklist_cancelAdd').addEventListener('click', () => document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'));
document.getElementById('blacklist_closeEditModal').addEventListener('click', () => blacklistEditModal.classList.add('hidden'));
document.getElementById('blacklist_cancelEdit').addEventListener('click', () => blacklistEditModal.classList.add('hidden'));

document.getElementById('blacklist_addForm').addEventListener('submit', async(e)=>{
    e.preventDefault();
    try { 
        const fd = new FormData(e.target); 
        fd.append('action', 'add_blacklist'); 
        fd.append('targetSheet', 'blacklist');
        fd.append('日期', todayLocalForInput());
        await fetch(SCRIPT_URL, {method:'POST', body:fd}); 
        alert('新增成功'); e.target.reset(); document.getElementById('blacklist_addModalBackdrop').classList.add('hidden'); fetchBlacklistData(); 
    } catch(e) { alert('失敗'); }
});

document.getElementById('blacklist_editForm').addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    fd.append('action','update'); 
    fd.append('targetSheet','blacklist'); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); blacklistEditModal.classList.add('hidden'); fetchBlacklistData(); 
});


// ==========================================
// 3. 店別設定與鎖定 (Store Settings)
// ==========================================
const storeLockCheckbox = document.getElementById('storeLockCheckbox');
const notifyToggle = document.getElementById('notifyToggle');
const notifyLongTermToggle = document.getElementById('notifyLongTermToggle'); 

async function checkStoreSettings() {
    if(currentValidStoreType !== 'STORE') {
        storeLockCheckbox.checked = false; notifyToggle.checked = false;
        storeLockCheckbox.disabled = true; notifyToggle.disabled = true; 
        if (notifyLongTermToggle) { notifyLongTermToggle.checked = false; notifyLongTermToggle.disabled = true; }
        return;
    }
    storeLockCheckbox.disabled = false; notifyToggle.disabled = false; 
    if (notifyLongTermToggle) notifyLongTermToggle.disabled = false;
    
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=get_store_settings&store=${encodeURIComponent(currentValidStoreValue)}`);
        const json = await resp.json();
        if (json.result === 'success') {
            storeLockCheckbox.checked = (json.settings.locked === '1');
            notifyToggle.checked = (json.settings.notify_enabled === '1');
            if (notifyLongTermToggle) notifyLongTermToggle.checked = (json.settings.notify_long_term === '1');
            
            if(json.settings.locked === '1') {
                storeSelect.classList.add('select-disabled'); storeSelect.disabled = true; showTopMessage('店別已鎖定', false);
            } else {
                storeSelect.classList.remove('select-disabled'); storeSelect.disabled = false; showTopMessage('', false);
            }
        }
    } catch(err) { console.warn('checkStoreSettings error', err); }
}

storeLockCheckbox.addEventListener('change', async () => {
    if(currentValidStoreType !== 'STORE'){ showTopMessage('請先選擇單一分店', true); storeLockCheckbox.checked = false; return; }
    const locked = storeLockCheckbox.checked;
    if(locked){ storeSelect.classList.add('select-disabled'); storeSelect.disabled = true; } 
    else { storeSelect.classList.remove('select-disabled'); storeSelect.disabled = false; }
    showTopMessage(locked ? '店別已鎖定' : '店別已解鎖', false);
    try{
        const params = new URLSearchParams(); params.append('action', 'set_store_lock'); params.append('store', currentValidStoreValue); params.append('locked', locked ? '1' : '0');
        await fetch(SCRIPT_URL, { method: 'POST', body: params });
    }catch(err){ showTopMessage('設定失敗', true); storeLockCheckbox.checked = !locked; }
});

notifyToggle.addEventListener('change', async (e) => {
    if (currentValidStoreType !== 'STORE') { e.preventDefault(); notifyToggle.checked = false; alert('未選取單一店別無法開啟逾期通知'); return; }
    const isEnabled = notifyToggle.checked;
    try {
        const params = new URLSearchParams(); params.append('action', 'set_notify_status'); params.append('store', currentValidStoreValue); params.append('enabled', isEnabled ? '1' : '0');
        await fetch(SCRIPT_URL, { method: 'POST', body: params }); showTopMessage(`已${isEnabled ? '開啟' : '關閉'}逾期通知`, false);
    } catch (err) { alert('設定失敗'); notifyToggle.checked = !isEnabled; }
});

if (notifyLongTermToggle) {
    notifyLongTermToggle.addEventListener('change', async (e) => {
        if (currentValidStoreType !== 'STORE') { e.preventDefault(); notifyLongTermToggle.checked = false; alert('未選取單一店別無法設定'); return; }
        const isEnabled = notifyLongTermToggle.checked;
        try {
            const params = new URLSearchParams(); params.append('action', 'set_notify_long_term'); params.append('store', currentValidStoreValue); params.append('enabled', isEnabled ? '1' : '0');
            await fetch(SCRIPT_URL, { method: 'POST', body: params }); showTopMessage(`已${isEnabled ? '開啟' : '關閉'}包含長期客訂通知`, false);
        } catch (err) { alert('設定失敗'); notifyLongTermToggle.checked = !isEnabled; }
    });
}

// ==========================================
// 4. 資料備份與清理 (Backup & Clean)
// ==========================================
const backupModalBackdrop = document.getElementById('backupModalBackdrop');
const backupModalContent = document.getElementById('backupModalContent');
const confirmBackupBtn = document.getElementById('confirmBackupBtn');

document.getElementById('refreshStoresBtn').addEventListener('click', async()=>{ if(typeof fetchStores === 'function') await fetchStores(); alert('同步完成'); });

document.getElementById('backupBtn').addEventListener('click', () => {
    backupModalContent.innerHTML = `<p class="font-bold text-gray-800 mb-2">確定要備份【所有活躍訂單】嗎？</p><ul class="list-disc pl-5 text-sm text-gray-600 space-y-1"><li>系統將建立包含所有資料的備份檔案。</li><li>這不會影響目前的運作。</li></ul>`;
    backupModalBackdrop.classList.remove('hidden');
});

document.getElementById('closeBackupModal').addEventListener('click', () => backupModalBackdrop.classList.add('hidden'));
document.getElementById('cancelBackupBtn').addEventListener('click', () => backupModalBackdrop.classList.add('hidden'));

confirmBackupBtn.addEventListener('click', async () => {
    const pwd = prompt('請輸入密碼以確認備份：');
    if (!pwd) return;

    confirmBackupBtn.disabled = true; confirmBackupBtn.textContent = '驗證中...';
    const isVerified = await verifyAccess('ALL', '', pwd);
    
    if (!isVerified) { alert('密碼錯誤，僅能透過總部權限備份。'); confirmBackupBtn.disabled = false; confirmBackupBtn.textContent = '確認備份'; return; }

    confirmBackupBtn.textContent = '備份中...';
    try {
        const params = new URLSearchParams(); params.append('action', 'backup_database'); 
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const json = await resp.json();
        if (json.result === 'success') { alert(json.message || '備份成功！'); backupModalBackdrop.classList.add('hidden'); } 
        else { alert('備份失敗：' + (json.error || '未知錯誤')); }
    } catch (e) { alert('備份請求失敗：' + e.message); } finally { confirmBackupBtn.disabled = false; confirmBackupBtn.textContent = '確認備份'; }
});

document.getElementById('clearOverdueBtn').addEventListener('click', async () => {
    if (!confirm('確定要整理當前範圍內的過期資料嗎？\n已取走超過 5 天的資料將移至歷史資料庫並刪除。')) return;
    
    const btn = document.getElementById('clearOverdueBtn');
    btn.disabled = true; btn.textContent = '整理中...';
    try {
        const fd = new FormData();
        fd.append('action', 'clean_overdue');
        fd.append('type', currentValidStoreType); 
        fd.append('value', currentValidStoreValue); 
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();
        if (json.result === 'success') { alert(json.message); if(typeof fetchOrders === 'function') fetchOrders(); } 
        else { alert('整理失敗：' + json.error); }
    } catch(e) { alert('請求失敗：' + e.message); } finally { btn.disabled = false; btn.textContent = '清除逾期'; }
});