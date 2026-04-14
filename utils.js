// ==========================================
// 1. 全域設定與變數 (Global Config & State)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby9D_Jzr1CDrzG7SNGPZQPbxRzxr4eC7MXWhGb8dUBISfmlhhjytBgJkQ1Ml_1EmOJ4/exec";

// 資料容器 (讓所有檔案都能存取)
let allOrders = [];
let allLongTermOrders = [];
let allBlacklistData = [];
let allStoresCache = []; 
let currentFilter = 'all';

// 新增區域版全域變數，紀錄目前權限範圍
let currentValidStoreType = 'ALL'; // 'ALL', 'REGION', 'STORE'
let currentValidStoreValue = '';   // 空字串, '區域A', '店代碼'

// DOM 元素參考 (跨檔案使用的主要元素)
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

function pad(n) { return String(n).padStart(2, '0'); }

function todayLocalForInput() { 
    const d = new Date(); 
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; 
}

function digitsOnly(s) { return String(s || '').replace(/\D/g, ''); }

function parseMultiDateStringToArray(dateString) {
    if (!dateString || typeof dateString !== 'string') return [];
    return dateString.split(/[,;，\s]+/).map(s => toDateOnly(s)).filter(Boolean);
}

function toDateOnly(val) {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m1) {
        return `${m1[1]}-${String(m1[2]).padStart(2, '0')}-${String(m1[3]).padStart(2, '0')}`;
    }
    return '';
}

function isChecked(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const s = value.toLowerCase().trim();
        return s === '是' || s === 'true' || s === '1' || s === 'yes';
    }
    return false;
}

function showTopMessage(txt, isError = false) {
    if (!txt) { topMessage.classList.add('hidden'); topMessage.textContent = ''; return; }
    topMessage.textContent = txt;
    topMessage.classList.remove('hidden');
    topMessage.style.color = isError ? '#b91c1c' : '#065f46';
}

function formatFieldValueIfDate(header, val) {
    if (!val) return '';
    if (header.includes('日期') || header.includes('Date')) {
        return formatDateShort(val);
    }
    return val;
}

function formatPhone(rawVal) {
    if (rawVal === undefined || rawVal === null) return '';
    const s = String(rawVal).trim();
    if (s.startsWith('0')) return s;
    if (/^\d{9}$/.test(s)) return '0' + s;
    return s;
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const parts = String(dateStr).split(/[,;，\s]+/);
    const last = parts[parts.length - 1];
    const d = new Date(last);
    if (isNaN(d.getTime())) return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function formatDateMMDD(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).substring(0, 10);
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function setInputDate(id, val) {
    const el = document.getElementById(id);
    if (!val) { el.value = ''; return; }
    const parts = String(val).split(/[,;，\s]+/);
    const d = new Date(parts[parts.length - 1]);
    if (!isNaN(d)) { el.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
}

function getStatus(order) {
    if (order['取走日期']) return { key: '已取貨', label: '已取貨', class: 'closed' };
    if (order['通知日期']) return { key: '已通知', label: '已通知', class: 'notified' };
    if (order['未接電話日期']) return { key: '未接', label: '未接', class: 'missed' };
    if (order['到貨日期']) return { key: '已到貨', label: '已到貨', class: 'arrived' };
    if (order['採購日期'] || (order['分店調撥'] && order['分店調撥'].trim())) return { key: '已採購', label: '已採購', class: 'purchase' };
    return { key: '未處理', label: '未處理', class: 'pending' };
}

function getSelectedStoreName() {
    if (!storeSelect || storeSelect.selectedIndex < 0) return '';
    const opt = storeSelect.options[storeSelect.selectedIndex];
    return opt ? (opt.dataset.name || opt.text) : '';
}

function updateStoreDisplay() {
    if (!storeSelect) return;
    const opt = storeSelect.options[storeSelect.selectedIndex];
    const text = opt?.textContent;
    if(text && storeSelect.value) { 
        currentStoreBadge.textContent = text.replace(/^[🌟📍📁🏠]\s*/, ''); 
        currentStoreBadge.classList.remove('hidden'); 
    }
    else { currentStoreBadge.classList.add('hidden'); }
}

function resolveBlacklistRowData(row) {
    const keys = Object.keys(row);
    const findKey = (candidates) => {
      for (const c of candidates) {
        if (row[c] !== undefined) return c;
      }
      for (const c of candidates) {
        const found = keys.find(k => k.includes(c));
        if (found) return found;
      }
      return null;
    };

    const idKey = findKey(['客號', 'Cust', 'ID', '編號']);
    const nameKey = findKey(['姓名', 'Name', '顧客']);
    const phoneKey = findKey(['電話', 'Phone', 'Mobile', '手機', '連絡']);
    const reasonKey = findKey(['原因', 'Reason', '事由', '備註', '說明']);
    const dateKey = findKey(['日期', 'Date', 'Time']);
    const storeKey = findKey(['店別', 'Store', '分店', '店編號']); 

    return {
      id: idKey ? row[idKey] : '-',
      name: nameKey ? row[nameKey] : '未知',
      phone: phoneKey ? row[phoneKey] : '',
      reason: reasonKey ? row[reasonKey] : '',
      date: dateKey ? row[dateKey] : '',
      store: storeKey ? row[storeKey] : ''
    };
}

/**
 * 區域版：依據層級驗證權限
 */
async function verifyAccess(targetType, targetValue, inputPwd) {
    if (!inputPwd) return false;
    try {
        const fd = new FormData();
        fd.append('action', 'verify_access');
        fd.append('type', targetType);
        fd.append('value', targetValue);
        fd.append('password', inputPwd);
        
        const resp = await fetch(SCRIPT_URL, { method: 'POST', body: fd });
        const json = await resp.json();
        
        return json.result === 'success';
    } catch (e) {
        console.error('Verify password error:', e);
        alert('無法連接伺服器進行驗證，請檢查網路。');
        return false;
    }
}

// ==========================================
// 3. UI 元件邏輯 (UI Components)
// ==========================================

function toggleAccordion(btn, content, icon) {
    if(!btn) return;
    btn.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');
        content.classList.toggle('open');
        icon.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
    });
}

function setupTagControls(addBtn, stampBtn, inputEl, tagsContainer, hiddenInput) {
    let items = [];
    addBtn && addBtn.addEventListener('click', () => {
        const v = inputEl.value;
        if (v && !items.includes(v)) { items.push(v); items.sort(); inputEl.value = ''; render(); }
    });
    stampBtn && stampBtn.addEventListener('click', () => {
        const v = todayLocalForInput();
        if (!items.includes(v)) { items.push(v); items.sort(); render(); }
    });
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
    tagsContainer && tagsContainer.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove');
        if (removeBtn) {
            const d = removeBtn.dataset.date;
            items = items.filter(x => x !== d); render();
        }
    });
    return { setItems(arr) { items = (arr || []).filter(Boolean); items.sort(); render(); }, getItems() { return items.slice(); } };
}

document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => { 
        const targetId = btn.dataset.target;
        const targetEl = document.getElementById(targetId);
        if(targetEl) targetEl.value = todayLocalForInput(); 
    });
});

const formToggleBtn = document.getElementById('formToggleBtn');
if (formToggleBtn) {
    toggleAccordion(formToggleBtn, document.getElementById('formContent'), document.getElementById('arrowIcon'));
}