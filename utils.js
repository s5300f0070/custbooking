// ==========================================
// 1. 全域設定與變數 (Global Config & State)
// ==========================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyfDwaVTkHD-HGtY-6MzxscARnxwML9j1Ejn4v5cvPCAlgIPNRNkuU07r_61OBEVAYK/exec";

// 資料容器
let allOrders = [];
let allLongTermOrders = [];
let allBlacklistData = [];
let allStoresCache = []; 
let currentFilter = 'all';

// 權限範圍
let currentValidStoreType = 'ALL'; 
let currentValidStoreValue = '';

// 統一宣告 DOM 元素
const regionSelect = document.getElementById('regionSelect');
const storeSelect = document.getElementById('storeSelect');
const topMessage = document.getElementById('top-message');
const dataTableHeaders = document.getElementById('data-table-headers');
const longTerm_dataTableHeaders = document.getElementById('longTerm_data-table-headers');
const currentStoreBadge = document.getElementById('currentStoreBadge');

// ==========================================
// 2. 工具函式 (Helper Functions)
// ==========================================

function pad(n) { return String(n).padStart(2, '0'); }

function todayLocalForInput() { 
    const d = new Date(); 
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; 
}

function toDateOnly(val) {
    if (!val && val !== 0) return '';
    const s = String(val).trim();
    const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (m1) return `${m1[1]}-${pad(m1[2])}-${pad(m1[3])}`;
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

function formatPhone(rawVal) {
    if (!rawVal) return '';
    const s = String(rawVal).trim();
    return s.startsWith('0') ? s : (/^\d{9}$/.test(s) ? '0' + s : s);
}

function formatDateMMDD(val) {
    if (!val) return '';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val).substring(0, 10);
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function formatFieldValueIfDate(header, val) {
    if (!val) return '';
    if (header.includes('日期') || header.includes('Date') || header.includes('時間')) {
        const parts = String(val).split(/[,;，\s]+/);
        const last = parts[parts.length - 1];
        const d = new Date(last);
        return isNaN(d.getTime()) ? last : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    }
    return val;
}

function getStatus(order) {
    if (order['取走日期']) return { key: '已取貨', label: '已取貨', class: 'closed' };
    if (order['通知日期']) return { key: '已通知', label: '已通知', class: 'notified' };
    if (order['未接電話日期']) return { key: '未接', label: '未接', class: 'missed' };
    if (order['到貨日期']) return { key: '已到貨', label: '已到貨', class: 'arrived' };
    if (order['採購日期'] || (order['分店調撥'] && order['分店調撥'].trim())) return { key: '已採購', label: '已採購', class: 'purchase' };
    return { key: '未處理', label: '未處理', class: 'pending' };
}

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

function toggleAccordion(btn, content, icon) {
    if(!btn || !content) return;
    btn.addEventListener('click', () => {
        const isOpen = content.classList.contains('open');
        content.classList.toggle('open');
        if(icon) icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    });
}

function setupTagControls(addBtn, stampBtn, inputEl, tagsContainer, hiddenInput) {
    if(!addBtn || !inputEl || !tagsContainer || !hiddenInput) return { setItems:()=>{}, getItems:()=>[] };
    let items = [];
    addBtn.addEventListener('click', () => {
        const v = inputEl.value;
        if (v && !items.includes(v)) { items.push(v); items.sort(); inputEl.value = ''; render(); }
    });
    if (stampBtn) {
        stampBtn.addEventListener('click', () => {
            const v = todayLocalForInput();
            if (!items.includes(v)) { items.push(v); items.sort(); render(); }
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
        if (removeBtn) { items = items.filter(x => x !== removeBtn.dataset.date); render(); }
    });
    return { setItems(arr) { items = (arr || []).filter(Boolean); items.sort(); render(); }, getItems() { return items.slice(); } };
}
