// ==========================================
// admin.js 修正版（已修正 locked 錯誤）
// ==========================================

function checkStoreSettings() {
    try {
        // 取得目前選中的店
        if (!storeSelect || storeSelect.selectedIndex < 0) return;

        const selectedOption = storeSelect.options[storeSelect.selectedIndex];
        if (!selectedOption) return;

        const storeCode = selectedOption.dataset.value;
        if (!storeCode) return;

        // 從快取找店資料
        const store = allStoresCache.find(s => s.code === storeCode);

        // ====== 🔴 關鍵修正：避免 undefined ======
        if (!store) {
            console.warn('找不到店資料:', storeCode);
            return;
        }

        // 如果沒有 locked 欄位，直接當作未鎖定
        const isLocked = store.locked === true || store.locked === 'true' || store.locked === '1';

        // UI 控制（依你的 checkbox）
        const lockCheckbox = document.getElementById('storeLockCheckbox');
        if (lockCheckbox) {
            lockCheckbox.checked = isLocked;
        }

        // 禁用/啟用 UI
        if (isLocked) {
            storeSelect.classList.add('select-disabled');
        } else {
            storeSelect.classList.remove('select-disabled');
        }

    } catch (e) {
        console.error('checkStoreSettings error:', e);
    }
}


// ==========================================
// 初始化呼叫（確保不會在資料未載入時執行）
// ==========================================

window.addEventListener('load', () => {
    setTimeout(() => {
        if (typeof allStoresCache !== 'undefined' && allStoresCache.length > 0) {
            checkStoreSettings();
        }
    }, 500);
});


// ==========================================
// 當店切換時重新檢查
// ==========================================

if (storeSelect) {
    storeSelect.addEventListener('change', () => {
        setTimeout(checkStoreSettings, 100);
    });
}
