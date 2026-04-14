// ==========================================
// 1. 儀表板 (Dashboard)
// ==========================================
const dashboardModal = document.getElementById('dashboardModalBackdrop');
const dashboardBtn = document.getElementById('dashboardBtn');

const originalUpdateStoreDisplay = window.updateStoreDisplay;
window.updateStoreDisplay = function() {
    if (typeof originalUpdateStoreDisplay === 'function') {
        originalUpdateStoreDisplay();
    }
    if (dashboardBtn) {
        if (storeSelect && storeSelect.value) {
            dashboardBtn.classList.remove('hidden');
        } else {
            dashboardBtn.classList.add('hidden');
        }
    }
};

if (storeSelect) {
    storeSelect.addEventListener('change', () => {
        if (dashboardBtn) {
            if (storeSelect.value) {
                dashboardBtn.classList.remove('hidden');
            } else {
                dashboardBtn.classList.add('hidden');
            }
        }
    });
}

if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
        const opt = storeSelect.options[storeSelect.selectedIndex];
        let title = '營運總覽 - 總部 (全區)';
        if(opt?.dataset?.type === 'REGION') title = `營運總覽 - ${opt.dataset.value}`;
        else if(opt?.dataset?.type === 'STORE') title = `營運總覽 - ${opt.dataset.name}`;
        
        document.getElementById('dashboardTitle').textContent = title;
        calculateDashboardStats(opt?.dataset?.type, opt?.dataset?.value);
        if(dashboardModal) dashboardModal.classList.remove('hidden');
    });
}

const closeDashboardModalBtn = document.getElementById('closeDashboardModal');
if (closeDashboardModalBtn) {
    closeDashboardModalBtn.addEventListener('click', () => {
        if(dashboardModal) dashboardModal.classList.add('hidden');
    });
}

function calculateDashboardStats(targetType, targetValue) {
    const now = new Date();
    let pendingCount = 0; let purchasedCount = 0; let arrivedCount = 0; let overdueCount = 0; let todayCount = 0;
    
    const todayStr = todayLocalForInput();
    const productCounts = {};
    const allCurrentOrders = [...allOrders, ...allLongTermOrders];

    let scopedStores = [];
    if(targetType === 'ALL') scopedStores = allStoresCache.map(s => s.code);
    else if (targetType === 'REGION') scopedStores = allStoresCache.filter(s => s.region === targetValue).map(s => s.code);
    else scopedStores = [targetValue]; 

    const storeStats = {};
    scopedStores.forEach(code => { storeStats[code] = { total: 0, pending: 0, overdue: 0, name: allStoresCache.find(s=>s.code===code)?.name || code }; });

    allCurrentOrders.forEach(o => {
        const status = getStatus(o);
        const oStore = o['店別'] || o['分店'] || o['店編號'];
        const matchedStore = allStoresCache.find(s => s.code === oStore || s.name === oStore);
        const storeCode = matchedStore ? matchedStore.code : oStore;

        if(storeStats[storeCode]) storeStats[storeCode].total++;
        
        if(status.key === '未處理') { pendingCount++; if(storeStats[storeCode]) storeStats[storeCode].pending++; }
        if(status.key === '已採購') purchasedCount++;
        if(status.key === '已到貨') arrivedCount++;

        const createDate = formatDateMMDD(o['建立日期'] || o['creationDate'] || o['建立時間']);
        if(createDate === formatDateMMDD(todayStr) || toDateOnly(o['建立日期']) === todayStr) {
            todayCount++;
        }

        const isClosed = status.key === '已取貨';
        if(!isClosed && (o['最後更新時間'] || o['建立日期'])) {
            const diffDays = Math.ceil(Math.abs(now - new Date(toDateOnly(o['最後更新時間'] || o['建立日期']))) / (1000 * 60 * 60 * 24));
            if(diffDays > 5) { overdueCount++; if(storeStats[storeCode]) storeStats[storeCode].overdue++; }
        }

        if(o['客訂商品A']) productCounts[o['客訂商品A']] = (productCounts[o['客訂商品A']] || 0) + 1;
        if(o['客訂商品B']) productCounts[o['客訂商品B']] = (productCounts[o['客訂商品B']] || 0) + 1;
    });

    const blacklistCount = allBlacklistData.filter(b => scopedStores.includes(resolveBlacklistRowData(b).store)).length;

    document.getElementById('dashPending').textContent = pendingCount;
    document.getElementById('dashPurchased').textContent = purchasedCount;
    document.getElementById('dashArrived').textContent = arrivedCount;
    document.getElementById('dashOverdue').textContent = overdueCount;
    document.getElementById('dashToday').textContent = todayCount;
    document.getElementById('dashBlacklist').textContent = blacklistCount;

    const tbody = document.getElementById('dashStoreRankBody');
    const sortedStoreStats = Object.values(storeStats).filter(s=>s.total>0).sort((a,b) => b.overdue - a.overdue);
    
    if(sortedStoreStats.length > 0) {
        tbody.innerHTML = sortedStoreStats.map(s => `
            <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors text-sm">
                <td class="py-3 px-2 text-gray-800">${s.name}</td>
                <td class="py-3 px-2 text-gray-600">${s.total}</td>
                <td class="py-3 px-2 font-bold text-[#ea580c]">${s.pending}</td>
                <td class="py-3 px-2 font-bold text-[#dc2626]">${s.overdue}</td>
                <td class="py-3 px-2 text-right">
                    <button class="text-[#4f46e5] font-bold hover:text-indigo-800 text-sm" onclick="document.getElementById('closeDashboardModal').click();">查看</button>
                </td>
            </tr>
        `).join('');
    } else {
        tbody.innerHTML = '<tr><td colspan="5" class="py-3 px-2 text-gray-400 text-center">無資料</td></tr>';
    }

    const hotItemsContainer = document.getElementById('dashHotItems');
    const sortedItems = Object.entries(productCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    
    if(sortedItems.length === 0) {
        hotItemsContainer.innerHTML = '<div class="text-gray-400 text-sm text-center py-4">暫無商品資料</div>';
    } else {
        hotItemsContainer.innerHTML = sortedItems.map((item, index) => `
            <div class="flex items-center justify-between text-sm">
                <div class="flex items-center gap-3">
                    <span class="text-gray-400 font-medium w-4">${index + 1}.</span>
                    <span class="text-gray-700 truncate max-w-[150px]" title="${item[0]}">${item[0]}</span>
                </div>
                <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-bold">${item[1]} 件</span>
            </div>
        `).join('');
    }
}

// ==========================================
// 2. 當前缺貨清單 (Out of Stock List)
// ==========================================
const outStockModal = document.getElementById('outStockModalBackdrop');
const showOutStockBtn = document.getElementById('showOutStockBtn');
const closeOutStockModalBtn = document.getElementById('closeOutStockModal');
const outStockList = document.getElementById('outStockList');
const outStockNoData = document.getElementById('outStockNoData');

if (showOutStockBtn) {
    showOutStockBtn.addEventListener('click', async () => {
        outStockList.innerHTML = '';
        outStockNoData.classList.add('hidden');
        outStockList.classList.remove('hidden');
        if(outStockModal) outStockModal.classList.remove('hidden');

        try {
            const outStockMap = {}; 
            [...allOrders, ...allLongTermOrders].forEach(order => {
                if (getStatus(order).key === '已取貨') return; 
                const storeName = order['店別'] || order['分店'] || order['店編號'] || '未知分店';
                
                if (isChecked(order['A缺貨']) && order['客訂商品A']) {
                    const key = `${String(order['客訂商品A']).trim()}|${String(order['A商品規格'] || '').trim()}`;
                    if (!outStockMap[key]) outStockMap[key] = { name: String(order['客訂商品A']).trim(), spec: String(order['A商品規格'] || '').trim(), stores: new Set() };
                    outStockMap[key].stores.add(storeName);
                }
                if (isChecked(order['B缺貨']) && order['客訂商品B']) {
                    const key = `${String(order['客訂商品B']).trim()}|${String(order['B商品規格'] || '').trim()}`;
                    if (!outStockMap[key]) outStockMap[key] = { name: String(order['客訂商品B']).trim(), spec: String(order['B商品規格'] || '').trim(), stores: new Set() };
                    outStockMap[key].stores.add(storeName);
                }
            });

            const uniqueItems = Object.values(outStockMap).sort((a, b) => a.name.localeCompare(b.name));
            outStockList.innerHTML = '';
            
            if (uniqueItems.length > 0) {
                uniqueItems.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'p-4 bg-white hover:bg-red-50 transition-colors flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-l-4 border-red-500';
                    const specHtml = item.spec ? `<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-sm">${item.spec}</span>` : '';
                    const storesHtml = Array.from(item.stores).map(s => `<span class="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold">${s}</span>`).join(' ');
                    
                    li.innerHTML = `
                        <div class="flex items-center gap-2 flex-1">
                            <div class="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                            <div class="text-gray-800 font-bold text-lg">${item.name}</div>
                            ${specHtml}
                        </div>
                        <div class="flex flex-wrap gap-1 mt-1 sm:mt-0">${storesHtml}</div>
                    `;
                    outStockList.appendChild(li);
                });
            } else {
                outStockNoData.classList.remove('hidden');
                outStockList.classList.add('hidden');
            }
        } catch (err) {
            outStockList.innerHTML = `<li class="p-4 text-center text-red-500 font-bold">資料讀取失敗，請稍後再試</li>`;
        }
    });
}

if (closeOutStockModalBtn) {
    closeOutStockModalBtn.addEventListener('click', () => {
        if(outStockModal) outStockModal.classList.add('hidden');
    });
}