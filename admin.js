// ==========================================
// 1. 長期客訂 (Long Term Orders)
// ==========================================
const longTermEditModal = document.getElementById('longTerm_editModalBackdrop');
const longTerm_dataTableBody = document.getElementById('longTerm_data-table-body');
const longTerm_noDataText = document.getElementById('longTerm_noDataText');
const longTerm_tableContainer = document.getElementById('longTerm_dataTableContainer');

// 長期客訂的 Tag Controls 初始化
const longTerm_editPurchaseCtrl = setupTagControls(document.getElementById('longTerm_editAddPurchase'), document.getElementById('longTerm_editStampPurchase'), document.getElementById('longTerm_editPurchaseInput'), document.getElementById('longTerm_editPurchaseTags'), document.getElementById('longTerm_editPurchaseHidden'));
const longTerm_editArrivalCtrl = setupTagControls(document.getElementById('longTerm_editAddArrival'), document.getElementById('longTerm_editStampArrival'), document.getElementById('longTerm_editArrivalInput'), document.getElementById('longTerm_editArrivalTags'), document.getElementById('longTerm_editArrivalHidden'));
const longTerm_editPickupCtrl = setupTagControls(document.getElementById('longTerm_editAddPickup'), document.getElementById('longTerm_editStampPickup'), document.getElementById('longTerm_editPickupInput'), document.getElementById('longTerm_editPickupTags'), document.getElementById('longTerm_editPickupHidden'));
const longTerm_editMissedCtrl = setupTagControls(document.getElementById('longTerm_editAddMissed'), document.getElementById('longTerm_editStampMissed'), document.getElementById('longTerm_editMissedInput'), document.getElementById('longTerm_editMissedTags'), document.getElementById('longTerm_editMissedHidden'));
const longTerm_editNotifyCtrl = setupTagControls(document.getElementById('longTerm_editAddNotify'), document.getElementById('longTerm_editStampNotify'), document.getElementById('longTerm_editNotifyInput'), document.getElementById('longTerm_editNotifyTags'), document.getElementById('longTerm_editNotifyHidden'));

// 手風琴初始化
toggleAccordion(document.getElementById('longTermToggleBtn'), document.getElementById('longTermContent'), document.getElementById('longTermArrowIcon'));

// 搜尋與重整
document.getElementById('longTerm_searchButton').addEventListener('click', renderLongTermTable);
document.getElementById('longTerm_searchInput').addEventListener('input', renderLongTermTable);
document.getElementById('longTerm_refreshButton').addEventListener('click', () => {
    // 這裡調用 orders.js 中的 fetchOrders，但因為是全域函式所以可以直接呼叫
    if(typeof fetchOrders === 'function') fetchOrders(); 
});

function renderLongTermTableHeaders(displayHeaders){
    if(!longTerm_dataTableHeaders) return;
    longTerm_dataTableHeaders.innerHTML = '';
    // 移除 '刪除' 標題
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
        
        const productA = order['客訂商品A'] ? `[${order['客訂商品A']}]${order['A商品規格'] ? `(${order['A商品規格']})` : ''} ${order['A數量'] ? 'x' + order['A數量'] : ''}` : '';
        const productB = order['客訂商品B'] ? `[${order['客訂商品B']}]${order['B商品規格'] ? `(${order['B商品規格']})` : ''} ${order['B數量'] ? 'x' + order['B數量'] : ''}` : '';

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
        if(order['未接電話日期']) dateDisplay += `<div class="text-xs text-red-500">未接: ${formatMulti(order['未接電話日期'])}</div>`;
        if(order['通知日期']) dateDisplay += `<div class="text-xs text-orange-600">通知: ${formatMulti(order['通知日期'])}</div>`;
        if(order['取走日期']) dateDisplay += `<div class="text-xs text-green-600">取走: ${formatMulti(order['取走日期'])}</div>`;
        
        let phoneDisplay = formatPhone(order['電話'] || order['連絡電話']);
        const isPaid = isChecked(order['付清'] || order['paid']);
        const paidDisplay = isPaid ? '<span class="text-green-600 font-bold">是</span>' : '<span class="text-gray-400">否</span>';
        const createdDate = formatDateMMDD(order['建立日期'] || order['creationDate'] || order['建立時間']);
        const updatedDate = formatDateMMDD(order['最後更新時間']);

        // 移除列表中的刪除按鈕
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
    document.getElementById('longTerm_editProductASpec').value = order['A商品規格']||'';
    document.getElementById('longTerm_editProductAQty').value = order['A數量']||'';
    document.getElementById('longTerm_editProductBName').value = order['客訂商品B']||'';
    document.getElementById('longTerm_editProductBSpec').value = order['B商品規格']||'';
    document.getElementById('longTerm_editProductBQty').value = order['B數量']||'';
    document.getElementById('longTerm_editPaid').checked = (order['paid'] === '是' || order['paid'] === true || order['付清'] === '是');
    document.getElementById('longTerm_editStoreTransfer').value = order['分店調撥'] || '';
    document.getElementById('longTerm_editNotes').value = order['備註'] || order['說明'] || '';
    
    try{
        const purchase = parseMultiDateStringToArray(order['採購日期']);
        const arrival = parseMultiDateStringToArray(order['到貨日期']);
        const pickup = parseMultiDateStringToArray(order['取走日期']);
        const missed = parseMultiDateStringToArray(order['未接電話日期']);
        const notify = parseMultiDateStringToArray(order['通知日期']);
        longTerm_editPurchaseCtrl.setItems(purchase);
        longTerm_editArrivalCtrl.setItems(arrival);
        longTerm_editPickupCtrl.setItems(pickup);
        longTerm_editMissedCtrl.setItems(missed);
        longTerm_editNotifyCtrl.setItems(notify);
    }catch(e){ console.warn(e); }

    longTermEditModal.classList.remove('hidden');
}

// 長期客訂表單提交
document.getElementById('longTerm_editForm').addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    fd.append('action','update'); 
    fd.append('store',storeSelect.value); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); 
    longTermEditModal.classList.add('hidden'); 
    if(typeof fetchOrders === 'function') fetchOrders(); 
});

// 長期客訂刪除
document.getElementById('longTerm_deleteEdit').addEventListener('click', ()=>{ 
    if(confirm('刪除?')) {
        // 調用 orders.js 定義的 deleteRow
        if(typeof deleteRow === 'function') deleteRow(document.getElementById('longTerm_editRowIndex').value); 
    }
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
    
    if(filtered.length === 0) { 
        noData.classList.remove('hidden'); 
        tableContainer.classList.add('hidden'); 
        return; 
    } else { 
        noData.classList.add('hidden'); 
        tableContainer.classList.remove('hidden'); 
    }
    
    filtered.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-red-50 cursor-pointer';
        tr.onclick = (e) => { if(e.target.closest('button')) return; openBlacklistEditModal(row); };
        
        const data = resolveBlacklistRowData(row);
        const dateVal = formatFieldValueIfDate('日期', data.date);
        const phoneVal = formatPhone(data.phone);

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
          <td data-label="電話">${phoneVal}</td>
          <td data-label="店別">${displayStoreName}</td>
          <td data-label="原因" class="text-red-600">${data.reason}</td>
          <td data-label="日期">${dateVal}</td>
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
    let note = row['備註'] || row['Note'] || '';
    document.getElementById('bl_edit_notes').value = note;
    
    blacklistEditModal.classList.remove('hidden');
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

// 黑名單相關事件監聽
document.getElementById('blacklist_searchButton').addEventListener('click', renderBlacklistTable);
document.getElementById('blacklist_searchInput').addEventListener('input', renderBlacklistTable);

document.getElementById('blacklist_addButton').addEventListener('click', () => { 
    const currentStoreVal = storeSelect.value;
    if(currentStoreVal) {
        const currentStoreName = storeSelect.options[storeSelect.selectedIndex].text;
        document.getElementById('blacklist_addStore').value = currentStoreName;
    }
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

document.getElementById('blacklist_editForm').addEventListener('submit', async(e)=>{ 
    e.preventDefault(); 
    const fd=new FormData(e.target); 
    fd.append('action','update'); 
    fd.append('targetSheet','blacklist'); 
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    alert('更新成功'); 
    blacklistEditModal.classList.add('hidden'); 
    fetchBlacklistData(); 
});


// ==========================================
// 3. 店別設定與鎖定 (Store Settings)
// ==========================================
const storeLockCheckbox = document.getElementById('storeLockCheckbox');
const notifyToggle = document.getElementById('notifyToggle');

async function checkStoreSettings() {
    const store = storeSelect.value;
    if(!store) {
        storeLockCheckbox.checked = false;
        notifyToggle.checked = false;
        notifyToggle.disabled = true; 
        return;
    }
    
    const storeName = getSelectedStoreName();
    if(!storeName) return;

    notifyToggle.disabled = false; 
    
    try {
        const resp = await fetch(`${SCRIPT_URL}?action=get_store_settings&store=${encodeURIComponent(storeName)}`);
        const json = await resp.json();
        if (json.result === 'success') {
            storeLockCheckbox.checked = (json.settings.locked === '1');
            notifyToggle.checked = (json.settings.notify_enabled === '1');
            
            if(json.settings.locked === '1') {
                storeSelect.classList.add('select-disabled');
                storeSelect.disabled = true;
                showTopMessage('店別已鎖定', false);
            } else {
                storeSelect.classList.remove('select-disabled');
                storeSelect.disabled = false;
                showTopMessage('', false);
            }
        }
    } catch(err) { console.warn('checkStoreSettings error', err); }
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

storeLockCheckbox.addEventListener('change', async () => {
    const store = storeSelect.value;
    const locked = storeLockCheckbox.checked;
    if(!store){ 
        showTopMessage('請先選擇店別', true); 
        storeLockCheckbox.checked = false; 
        return; 
    }
    if(locked){
        storeSelect.classList.add('select-disabled');
        storeSelect.disabled = true;
    } else {
        storeSelect.classList.remove('select-disabled');
        storeSelect.disabled = false;
    }
    showTopMessage(locked ? '店別已鎖定' : '店別已解鎖', false);
    const ok = await setStoreLockValue(locked);
    if(!ok){
        showTopMessage('設定店別鎖定失敗，已還原狀態', true);
        storeLockCheckbox.checked = !locked;
        if(!locked){ 
            storeSelect.classList.add('select-disabled');
            storeSelect.disabled = true;
        } else {
            storeSelect.classList.remove('select-disabled');
            storeSelect.disabled = false;
        }
    }
});

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
            showTopMessage(`已${msg}逾期通知`, false);
        } else {
            throw new Error(json.error || '設定失敗');
        }
    } catch (err) {
        alert('設定失敗: ' + err.message);
        notifyToggle.checked = !isEnabled; 
    }
});


// ==========================================
// 4. 資料備份與清理 (Backup & Clean)
// ==========================================
const backupModalBackdrop = document.getElementById('backupModalBackdrop');
const backupModalContent = document.getElementById('backupModalContent');
const confirmBackupBtn = document.getElementById('confirmBackupBtn');

// 重整分店
document.getElementById('refreshStoresBtn').addEventListener('click', async()=>{ 
    const fd = new FormData();
    fd.append('action','create_store_sheets');
    await fetch(SCRIPT_URL,{method:'POST',body:fd}); 
    // 調用 orders.js 的 fetchStores
    if(typeof fetchStores === 'function') await fetchStores(); 
});

// 備份按鈕
document.getElementById('backupBtn').addEventListener('click', () => {
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
    backupModalContent.innerHTML = htmlContent;
    backupModalBackdrop.classList.remove('hidden');
});

document.getElementById('closeBackupModal').addEventListener('click', () => backupModalBackdrop.classList.add('hidden'));
document.getElementById('cancelBackupBtn').addEventListener('click', () => backupModalBackdrop.classList.add('hidden'));

confirmBackupBtn.addEventListener('click', async () => {
    // 驗證超級管理員密碼 - 改為後端驗證
    const pwd = prompt('請輸入管理員密碼以確認備份：');
    if (!pwd) return;

    confirmBackupBtn.disabled = true;
    confirmBackupBtn.textContent = '驗證中...';

    // 1. 先驗證密碼
    const isVerified = await verifyAdminPassword(pwd);
    if (!isVerified) {
        alert('密碼錯誤，已取消備份。');
        confirmBackupBtn.disabled = false;
        confirmBackupBtn.textContent = '確認備份';
        return;
    }

    // 2. 驗證通過，執行備份
    confirmBackupBtn.textContent = '備份中...';
    const store = storeSelect.value;
    const storeName = getSelectedStoreName();
    try {
        const params = new URLSearchParams();
        params.append('action', 'backup_database');
        if(store) params.append('store', storeName);
        // 可選：將密碼再次傳送以供後端二次驗證(視後端實作而定)
        params.append('password', pwd); 
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: params });
        const json = await resp.json();
        if (json.result === 'success') {
            alert(json.message || '備份成功！');
            backupModalBackdrop.classList.add('hidden');
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

// 清除逾期
document.getElementById('clearOverdueBtn').addEventListener('click', async () => {
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