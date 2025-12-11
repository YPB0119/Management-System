const $ = (id) => document.getElementById(id);

const state = {
  user: null,
  products: [],
  buyerOrders: [],
  merchantOrders: [],
};

const toastEl = $('toast');

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), 2400);
}

function saveUser(user) {
  state.user = user;
  localStorage.setItem('user', JSON.stringify(user));
  renderUser();
  refreshData();
}

function loadUser() {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    state.user = JSON.parse(raw);
    renderUser();
    refreshData();
  } catch (e) {
    console.warn('load user fail', e);
  }
}

function clearUser() {
  state.user = null;
  localStorage.removeItem('user');
  renderUser();
}

function renderUser() {
  const userInfo = $('user-info');
  if (!state.user) {
    userInfo.hidden = true;
    $('auth-card').classList.remove('hidden');
    $('merchant-products').classList.add('hidden');
    $('buyer-orders').classList.add('hidden');
    $('merchant-orders').classList.add('hidden');
    return;
  }

  userInfo.hidden = false;
  $('auth-card').classList.add('hidden');
  $('user-name').textContent = state.user.username;
  $('user-role').textContent = state.user.role === 'merchant' ? '商戶' : '購物者';

  if (state.user.role === 'merchant') {
    $('merchant-products').classList.remove('hidden');
    $('merchant-orders').classList.remove('hidden');
    $('buyer-orders').classList.add('hidden');
  } else {
    $('merchant-products').classList.add('hidden');
    $('merchant-orders').classList.add('hidden');
    $('buyer-orders').classList.remove('hidden');
  }
}

async function apiFetch(url, options = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    ...options,
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || '請求失敗');
  }
  return data;
}

async function handleLogin() {
  const role = $('login-role').value;
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  if (!username || !password) {
    return showToast('請填寫用戶名與密碼');
  }
  try {
    const { user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, username, password }),
    });
    showToast('登入成功');
    saveUser(user);
  } catch (err) {
    showToast(err.message);
  }
}

function toggleRoleFields() {
  const role = $('reg-role').value;
  document.querySelectorAll('.role-merchant').forEach((el) => {
    el.classList.toggle('hidden', role !== 'merchant');
  });
  document.querySelectorAll('.role-buyer').forEach((el) => {
    el.classList.toggle('hidden', role !== 'buyer');
  });
}

async function handleRegister() {
  const role = $('reg-role').value;
  const username = $('reg-username').value.trim();
  const password = $('reg-password').value;
  const payload = { role, username, password };

  if (!username || !password) {
    return showToast('請填寫用戶名與密碼');
  }

  if (role === 'merchant') {
    payload.shopName = $('reg-shop-name').value.trim();
    payload.phone = $('reg-merchant-phone').value.trim();
    payload.name = $('reg-merchant-name').value.trim();
  } else {
    payload.realName = $('reg-real-name').value.trim();
    payload.phone = $('reg-buyer-phone').value.trim();
    payload.address = $('reg-address').value.trim();
  }

  try {
    const { user } = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    showToast('註冊成功，已自動登入');
    saveUser(user);
  } catch (err) {
    showToast(err.message);
  }
}

async function loadProducts() {
  try {
    const { products } = await apiFetch('/api/products');
    state.products = products || [];
    $('product-count').textContent = `${state.products.length} 件`;
    renderProducts();
  } catch (err) {
    showToast(err.message);
  }
}

function renderProducts() {
  const tbody = $('products-body');
  tbody.innerHTML = '';
  state.products.forEach((p) => {
    const tr = document.createElement('tr');
    const isOwner = state.user?.role === 'merchant' && Number(state.user.id) === p.merchant_id;
    tr.innerHTML = `
      <td>${p.name || ''}</td>
      <td>${p.category || '-'}</td>
      <td>¥${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${p.shop_name || '—'}</td>
      <td>${p.description || ''}</td>
      <td class="actions"></td>
    `;
    const actions = tr.querySelector('.actions');

    if (state.user?.role === 'buyer') {
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = '1';
      qtyInput.style.width = '64px';
      const buyBtn = document.createElement('button');
      buyBtn.textContent = '下單';
      buyBtn.className = 'primary';
      buyBtn.onclick = () => createOrder(p.id, Number(qtyInput.value));
      actions.append(qtyInput, buyBtn);
    }

    if (isOwner) {
      const edit = document.createElement('button');
      edit.textContent = '編輯';
      edit.className = 'ghost';
      edit.onclick = () => fillProductForm(p);

      const del = document.createElement('button');
      del.textContent = '刪除';
      del.className = 'ghost';
      del.onclick = () => deleteProduct(p.id);
      actions.append(edit, del);
    }

    tbody.appendChild(tr);
  });
}

function fillProductForm(product) {
  $('product-id').value = product.id;
  $('product-name').value = product.name;
  $('product-price').value = product.price;
  $('product-stock').value = product.stock;
  $('product-category').value = product.category || '';
  $('product-desc').value = product.description || '';
  showToast('已載入商品，可修改後保存');
}

function resetProductForm() {
  $('product-id').value = '';
  $('product-form').reset();
}

async function saveProduct(e) {
  e.preventDefault();
  if (state.user?.role !== 'merchant') return showToast('僅商戶可管理商品');

  const id = $('product-id').value;
  const payload = {
    merchantId: state.user.id,
    name: $('product-name').value.trim(),
    price: Number($('product-price').value),
    stock: Number($('product-stock').value),
    category: $('product-category').value.trim(),
    description: $('product-desc').value.trim(),
  };

  if (!payload.name || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
    return showToast('請輸入完整且正確的商品信息');
  }

  try {
    if (id) {
      await apiFetch(`/api/products?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...payload, id }),
      });
      showToast('商品已更新');
    } else {
      await apiFetch('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      showToast('商品已新增');
    }
    resetProductForm();
    await loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function deleteProduct(id) {
  if (!confirm('確認刪除該商品？')) return;
  try {
    await apiFetch(`/api/products?id=${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ merchantId: state.user.id }),
    });
    showToast('商品已刪除');
    await loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function createOrder(productId, quantity) {
  if (state.user?.role !== 'buyer') return showToast('請以購物者身份登入');
  if (quantity <= 0) return showToast('數量需大於 0');
  try {
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, buyerId: state.user.id }),
    });
    showToast('下單成功');
    await loadProducts();
    await loadBuyerOrders();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadBuyerOrders() {
  if (state.user?.role !== 'buyer') return;
  try {
    const { orders } = await apiFetch(`/api/orders?role=buyer&userId=${state.user.id}`);
    state.buyerOrders = orders || [];
    const tbody = $('buyer-orders-body');
    tbody.innerHTML = '';
    state.buyerOrders.forEach((o) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${o.id}</td>
        <td>${o.product_name || ''}</td>
        <td>${o.quantity}</td>
        <td>¥${Number(o.amount).toFixed(2)}</td>
        <td>${renderStatus(o.status)}</td>
        <td>${new Date(o.created_at).toLocaleString('zh-Hant')}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message);
  }
}

async function loadMerchantOrders() {
  if (state.user?.role !== 'merchant') return;
  try {
    const { orders } = await apiFetch(`/api/orders?role=merchant&userId=${state.user.id}`);
    state.merchantOrders = orders || [];
    const tbody = $('merchant-orders-body');
    tbody.innerHTML = '';
    state.merchantOrders.forEach((o) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${o.id}</td>
        <td>${o.product_name || ''}</td>
        <td>${o.buyer_username || '-'}</td>
        <td>${o.quantity}</td>
        <td>¥${Number(o.amount).toFixed(2)}</td>
        <td>${renderStatus(o.status)}</td>
        <td class="actions"></td>
      `;
      const sel = document.createElement('select');
      ['待付款', '待發貨', '已發貨', '已完成'].forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        if (s === o.status) opt.selected = true;
        sel.appendChild(opt);
      });
      const btn = document.createElement('button');
      btn.textContent = '更新';
      btn.className = 'primary';
      btn.onclick = () => updateOrderStatus(o.id, sel.value);
      tr.querySelector('.actions').append(sel, btn);
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message);
  }
}

function renderStatus(status) {
  let cls = 'status wait';
  if (status === '已發貨') cls = 'status ship';
  if (status === '已完成') cls = 'status done';
  return `<span class="${cls}">${status}</span>`;
}

async function updateOrderStatus(orderId, status) {
  try {
    await apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, status, merchantId: state.user.id }),
    });
    showToast('狀態已更新');
    await loadMerchantOrders();
  } catch (err) {
    showToast(err.message);
  }
}

function refreshData() {
  loadProducts();
  if (state.user?.role === 'buyer') loadBuyerOrders();
  if (state.user?.role === 'merchant') loadMerchantOrders();
}

function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach((tab) => {
    tab.onclick = () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach((p) => {
        p.classList.toggle('hidden', p.id !== `${target}-panel`);
      });
    };
  });
}

function init() {
  setupTabs();
  toggleRoleFields();
  $('reg-role').onchange = toggleRoleFields;
  $('login-btn').onclick = handleLogin;
  $('register-btn').onclick = handleRegister;
  $('logout-btn').onclick = () => {
    clearUser();
    showToast('已登出');
  };
  $('product-form').addEventListener('submit', saveProduct);
  $('product-reset').onclick = resetProductForm;
  loadUser();
  loadProducts();
}

document.addEventListener('DOMContentLoaded', init);


