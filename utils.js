// ==========================================
// 1. 全域設定與變數 (Global Config & State)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfDwaVTkHD-HGtY-6MzxscARnxwML9j1Ejn4v5cvPCAlgIPNRNkuU07r_61OBEVAYK/exec";

// 資料容器 (讓所有檔案都能存取)
let allOrders = [];
let allLongTermOrders = [];
let allBlacklistData = [];
let allStoresCache = []; 
let currentFilter = 'all';

// 權限範圍變數
let currentValidStoreType = 'ALL'; // 'ALL', 'REGION', 'STORE'
let currentValidStoreValue = '';

// --- 統一在此宣告 DOM 元素，其他檔案不要重複 const ---
const regionSelect = document.getElementById('regionSelect');
const storeSelect = document.getElementById('storeSelect');
const topMessage = document.getElementById('top-message');
const dataTableHeaders = document.getElementById('data-table-headers');
const longTerm_dataTableHeaders = document.getElementById('longTerm_data-table-headers');
const blacklistDataTableHeaders = document.getElementById('blacklist_data-table-headers');
const blacklistDataTableBody = document.getElementById('blacklist_data-table-body');
const currentStoreBadge = document.getElementById('currentStoreBadge');

// ==========================================
// 2. 工具函式 (Helper Functions)
// ==========================================

/**
 * 補零函式
 */
function pad(n) { return String(n).padStart(2, '0'); }

/**
 * 取得今天日期的 input 格式 (YYYY-MM-DD)
 */
function todayLocalForInput() { 
    const d = new Date(); 
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; 
}

/**
 * 將逗號分隔的日期字串轉換為陣列
 */
function parseMultiDateStringToArray(dateString) {
    if (!dateString || typeof dateString !== 'string') return [];
    return dateString.split(/[,;，\s]+/).map(s => toDateOnly(s)).filter(Boolean);
}

/**
 * 標準化日期格式 (YYYY-MM-DD)
 */
function toDateOnly(val) {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m1) {
        return `${m1[1]}-${String(m1[2]).padStart(2, '0')}-${String(m1[3]).padStart(2, '0')}`;
    }
    return '';
}

/**
 * 判斷值是否為「是」
 */
function isChecked(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const s = value.toLowerCase().trim();
        return s === '是' || s === 'true' || s === '1' || s === 'yes';
    }
    return false;
}

/**
 * 顯示頂部提示訊息
 */
function showTopMessage(txt, isError = false) {
    if (!topMessage) return;
    if (!txt) { topMessage.classList.add('hidden'); return; }
    topMessage.textContent = txt;
    topMessage.classList.remove('hidden');
    topMessage.style.color = isError ? '#b91c1c' : '#065f46';
}

/**
 * 格式化電話號碼
 */
function formatPhone(rawVal) {
    if (rawVal === undefined || rawVal === null) return '';
    const s = String(rawVal).trim();
    if (s.startsWith('0')) return s;
    if (/^\d{9}$/.test(s)) return '0' + s;
    return s;
}

/**
 * 短日期格式化 (MM/DD)
 */
function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split(/[,;，\s]+/);
    const last = parts[parts.length - 1];
    const d = new Date(last);
    if (isNaN(d.getTime())) return last;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * 日期格式化為 MM/DD
 */
function formatDateMMDD(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).substring(0, 10);
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * 根據欄位標題判斷是否為日期並格式化
 */
function formatFieldValueIfDate(header, val) {
    if (!val) return '';
    if (header.includes('日期') || header.includes('Date') || header.includes('時間')) {
        return formatDateShort(val);
    }
    return val;
}

/**
 * 設定 input type="date" 的值
 */
function setInputDate(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    const parts = String(val).split(/[,;，\s]+/);
    const d = new Date(parts[parts.length - 1]);
    if (!isNaN(d)) {
        el.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
}

/**
 * 判斷訂單當前狀態與樣式
 */
function getStatus(order) {
    if (order['取走日期']) return { key: '已取貨', label: '已取貨', class: 'closed' };
    if (order['通知日期']) return { key: '已通知', label: '已通知', class: 'notified' };
    if (order['未接電話日期']) return { key: '未接', label: '未接', class: 'missed' };
    if (order['到貨日期']) return { key: '已到貨', label: '已到貨', class: 'arrived' };
    
    // 如果有採購日期或分店調撥資料，歸類為已採購
    if (order['採購日期'] || (order['分店調撥'] && order['分店調撥'].trim())) {
        return { key: '已採購', label: '已採購', class: 'purchase' };
    }
    
    return { key: '未處理', label: '未處理', class: 'pending' };
}

/**
 * 取得當前選擇的店名稱
 */
function getSelectedStoreName() {
    if (!storeSelect || storeSelect.selectedIndex < 0) return '';
    const opt = storeSelect.options[storeSelect.selectedIndex];
    return opt ? (opt.dataset.name || opt.text) : '';
}

/**
 * 更新導覽列的店別顯示標籤
 */
function updateStoreDisplay() {
    if (!storeSelect || !currentStoreBadge) return;
    const opt = storeSelect.options[storeSelect.selectedIndex];
    if(opt && opt.value) { 
        currentStoreBadge.textContent = opt.text.replace(/^[🌟📍📁🏠]\s*/, ''); 
        currentStoreBadge.classList.remove('hidden'); 
    } else { 
        currentStoreBadge.classList.add('hidden'); 
    }
}

/**
 * 解析黑名單原始列資料
 */
function resolveBlacklistRowData(row) {
    const findKey = (candidates) => {
      const keys = Object.keys(row);
      for (const c of candidates) {
        if (row[c] !== undefined) return c;
      }
      for (const c of candidates) {
        const found = keys.find(k => k.replace(/\s+/g, "").includes(c));
        if (found) return found;
      }
      return null;
    };

    return {
      id: row[findKey(['客號', 'Cust', 'ID', '編號'])] || '-',
      name: row[findKey(['姓名', 'Name', '顧客'])] || '未知',
      phone: row[findKey(['電話', 'Phone', 'Mobile', '手機', '連絡'])] || '',
      reason: row[findKey(['原因', 'Reason', '事由', '備註', '說明'])] || '',
      date: row[findKey(['日期', 'Date', 'Time'])] || '',
      store: row[findKey(['店別', 'Store', '分店', 'StoreName'])] || ''
    };
}

/**
 * 安全驗證管理員/區域密碼 (發送至後端)
 */
async function verifyAdminPassword(inputPwd) {
    if (!inputPwd) return false;
    try {
        const fd = new FormData();
        fd.append('action', 'verify_admin');
        fd.append('password', inputPwd);
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();
        return json.result === 'success';
    } catch (e) {
        console.error('Verify password error:', e);
        return false;
    }
}

// ==========================================
// 3. UI 元件邏輯 (UI Components)
// ==========================================

/**
 * 手風琴切換邏輯
 */
function toggleAccordion(btn, content, icon) {
    if(!btn || !content) return;
    btn.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');
        content.classList.toggle('open');
        if(icon) icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    });
}

/**
 * 初始化 Tag 控制項 (多日期選取)
 */
function setupTagControls(addBtn, stampBtn, inputEl, tagsContainer, hiddenInput) {
    if(!addBtn || !inputEl || !tagsContainer || !hiddenInput) return { setItems:()=>{}, getItems:()=>[] };
    
    let items = [];
    
    addBtn.addEventListener('click', () => {
        const v = inputEl.value;
        if (v && !items.includes(v)) { 
            items.push(v); 
            items.sort(); 
            inputEl.value = ''; 
            render(); 
        }
    });
    
    if (stampBtn) {
        stampBtn.addEventListener('click', () => {
            const v = todayLocalForInput();
            if (!items.includes(v)) { 
                items.push(v); 
                items.sort(); 
                render(); 
            }
        });
    }

    function render() {
        tagsContainer.innerHTML = '';
        items.forEach(d => {
            const div = document.createElement('div');
            div.className = 'tag';
            div.innerHTML = `<span>${d}</span><span class="remove" data-date="${d}">&times;</span>`;
            tagsContainer.appendChild(div);
        });
        hiddenInput.value = items.join(', ');
    }

    tagsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove');
        if (removeBtn) { 
            const d = removeBtn.dataset.date;
            items = items.filter(x => x !== d); 
            render(); 
        }
    });

    return { 
        setItems(arr) { 
            items = (arr || []).filter(Boolean); 
            items.sort(); 
            render(); 
        }, 
        getItems() { return items.slice(); } 
    };
}

/**
 * 快速填入今天日期按鈕 (全域綁定)
 */
document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => { 
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        if(targetEl) targetEl.value = todayLocalForInput(); 
    });
});

// 手風琴初始化 (共用)
const formToggleBtn = document.getElementById('formToggleBtn');
if (formToggleBtn) {
    toggleAccordion(formToggleBtn, document.getElementById('formContent'), document.getElementById('arrowIcon'));
}
