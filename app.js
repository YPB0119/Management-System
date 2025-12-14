const $ = (id) => document.getElementById(id);
const PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" font-size="16" fill="%239ca3af" text-anchor="middle" dominant-baseline="middle">暂无图片</text></svg>';
const STATUS_OPTIONS = ['待付款', '待发货', '已发货', '已完成'];

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

function setPreview(url) {
  const img = $('product-preview');
  const real = url && url !== PLACEHOLDER ? url : '';
  img.src = real || PLACEHOLDER;
  img.dataset.url = real;
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
  $('user-role').textContent = state.user.role === 'merchant' ? '商户' : '购物者';

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
    throw new Error(data.error || '请求失败');
  }
  return data;
}

async function handleLogin() {
  const role = $('login-role').value;
  const username = $('login-username').value.trim();
  const password = $('login-password').value;
  if (!username || !password) {
    return showToast('请填写用户名与密码');
  }
  try {
    const { user } = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ role, username, password }),
    });
    showToast('登录成功');
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
    return showToast('请填写用户名与密码');
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
    showToast('注册成功，已自动登录');
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
    renderProductGrid();
  } catch (err) {
    showToast(err.message);
  }
}

function renderProductGrid() {
  const grid = $('product-grid');
  if (!grid) return;
  grid.innerHTML = '';
  state.products.forEach((p) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${p.image_url || PLACEHOLDER}" alt="${p.name || '商品图片'}" />
      <div class="name">${p.name || ''}</div>
      <div class="price">¥${Number(p.price).toFixed(2)}</div>
      <div class="hint">库存：${p.stock} | 分类：${p.category || '-'}</div>
    `;
    card.onclick = () => openDetail(p);
    grid.appendChild(card);
  });
}

function renderProducts() {
  const tbody = $('products-body');
  tbody.innerHTML = '';
  state.products.forEach((p) => {
    const tr = document.createElement('tr');
    const isOwner = state.user?.role === 'merchant' && Number(state.user.id) === p.merchant_id;
    tr.innerHTML = `
      <td><button class="ghost" style="padding:0" onclick="return false;">${p.name || ''}</button></td>
      <td>${p.category || '-'}</td>
      <td>¥${Number(p.price).toFixed(2)}</td>
      <td>${p.stock}</td>
      <td>${p.shop_name || '—'}</td>
      <td>${p.description || ''}</td>
      <td class="actions"></td>
    `;
    tr.querySelector('button').onclick = () => openDetail(p);
    const actions = tr.querySelector('.actions');

    if (state.user?.role === 'buyer') {
      const qtyInput = document.createElement('input');
      qtyInput.type = 'number';
      qtyInput.min = '1';
      qtyInput.value = '1';
      qtyInput.style.width = '64px';
      const buyBtn = document.createElement('button');
      buyBtn.textContent = '下单';
      buyBtn.className = 'primary';
      buyBtn.onclick = () => createOrder(p.id, Number(qtyInput.value));
      actions.append(qtyInput, buyBtn);
    }

    if (isOwner) {
      const edit = document.createElement('button');
      edit.textContent = '编辑';
      edit.className = 'ghost';
      edit.onclick = () => fillProductForm(p);

      const del = document.createElement('button');
      del.textContent = '删除';
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
  setPreview(product.image_url || PLACEHOLDER);
  $('product-image').value = '';
  showToast('已载入商品，可修改后保存');
}

function resetProductForm() {
  $('product-id').value = '';
  $('product-form').reset();
  $('product-image').value = '';
  setPreview(PLACEHOLDER);
}

async function uploadImage(file) {
  if (!file) return '';
  if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
    throw new Error('仅支持 JPG/PNG 图片');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('图片大小需不超过 5MB');
  }
  const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '上传失败');
  return data.url;
}

async function saveProduct(e) {
  e.preventDefault();
  if (state.user?.role !== 'merchant') return showToast('仅商户可管理商品');

  const id = $('product-id').value;
  const payload = {
    merchantId: state.user.id,
    name: $('product-name').value.trim(),
    price: Number($('product-price').value),
    stock: Number($('product-stock').value),
    category: $('product-category').value.trim(),
    description: $('product-desc').value.trim(),
    imageUrl: $('product-preview').dataset.url || '',
  };

  if (!payload.name || Number.isNaN(payload.price) || Number.isNaN(payload.stock)) {
    return showToast('请输入完整且正确的商品信息');
  }

  const file = $('product-image').files[0];
  try {
    if (file) {
      payload.imageUrl = await uploadImage(file);
    }

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
  if (!confirm('确认删除该商品？')) return;
  try {
    await apiFetch(`/api/products?id=${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ merchantId: state.user.id }),
    });
    showToast('商品已删除');
    await loadProducts();
  } catch (err) {
    showToast(err.message);
  }
}

async function createOrder(productId, quantity) {
  if (state.user?.role !== 'buyer') return showToast('请以购物者身份登录');
  if (quantity <= 0) return showToast('数量需大于 0');
  try {
    await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity, buyerId: state.user.id }),
    });
    showToast('下单成功');
    await loadProducts();
    await loadBuyerOrders();
    handleRoute();
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
        <td>${new Date(o.created_at).toLocaleString('zh-CN')}</td>
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
      STATUS_OPTIONS.forEach((s) => {
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
  const val = status && status.replace('發', '发');
  let cls = 'status wait';
  if (val === '已发货') cls = 'status ship';
  if (val === '已完成') cls = 'status done';
  return `<span class="${cls}">${val || status}</span>`;
}

async function updateOrderStatus(orderId, status) {
  try {
    await apiFetch('/api/orders', {
      method: 'PATCH',
      body: JSON.stringify({ orderId, status, merchantId: state.user.id }),
    });
    showToast('状态已更新');
    await loadMerchantOrders();
  } catch (err) {
    showToast(err.message);
  }
}

function openDetail(product) {
  window.location.hash = `#/product/${product.id}`;
  renderDetailPage(product);
}

function renderDetailPage(product) {
  if (!product) return;
  
  $('detail-name').textContent = product.name || '';
  $('detail-price').textContent = `¥${Number(product.price).toFixed(2)}`;
  $('detail-stock').textContent = `库存：${product.stock}`;
  $('detail-category').textContent = `分类：${product.category || '-'}`;
  $('detail-desc').textContent = product.description || '暂无描述';
  $('detail-image').src = product.image_url || PLACEHOLDER;
  
  const actionsEl = $('detail-actions');
  actionsEl.innerHTML = '';
  
  if (state.user?.role === 'buyer') {
    const qtyInput = document.createElement('input');
    qtyInput.type = 'number';
    qtyInput.min = '1';
    qtyInput.max = product.stock;
    qtyInput.value = '1';
    qtyInput.style.width = '80px';
    qtyInput.style.padding = '10px';
    qtyInput.style.border = '1px solid var(--border)';
    qtyInput.style.borderRadius = '8px';
    
    const buyBtn = document.createElement('button');
    buyBtn.textContent = '立即下单';
    buyBtn.className = 'primary';
    buyBtn.style.padding = '12px 24px';
    buyBtn.onclick = () => {
      const qty = Number(qtyInput.value);
      if (qty <= 0 || qty > product.stock) {
        return showToast('数量不正确');
      }
      createOrder(product.id, qty);
    };
    
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.gap = '12px';
    wrapper.style.alignItems = 'center';
    wrapper.appendChild(qtyInput);
    wrapper.appendChild(buyBtn);
    actionsEl.appendChild(wrapper);
  }
  
  const isOwner = state.user?.role === 'merchant' && Number(state.user.id) === product.merchant_id;
  if (isOwner) {
    const editBtn = document.createElement('button');
    editBtn.textContent = '编辑商品';
    editBtn.className = 'primary';
    editBtn.style.padding = '12px 24px';
    editBtn.onclick = () => {
      fillProductForm(product);
      window.location.hash = '';
      showToast('已载入商品信息到编辑表单');
    };
    actionsEl.appendChild(editBtn);
  }
  
  showDetailPage();
}

function showDetailPage() {
  document.querySelectorAll('.card').forEach((card) => {
    if (card.id !== 'product-detail-page') {
      card.classList.add('hidden');
    }
  });
  $('product-detail-page').classList.remove('hidden');
}

function hideDetailPage() {
  $('product-detail-page').classList.add('hidden');
  if (state.user) {
    if (state.user.role === 'merchant') {
      $('merchant-products').classList.remove('hidden');
      $('merchant-orders').classList.remove('hidden');
    } else {
      $('products-home').classList.remove('hidden');
      $('products-card').classList.remove('hidden');
      $('buyer-orders').classList.remove('hidden');
    }
  } else {
    $('products-home').classList.remove('hidden');
    $('products-card').classList.remove('hidden');
  }
}

function handleRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#/product/')) {
    const productId = Number(hash.split('/')[2]);
    const product = state.products.find((p) => p.id === productId);
    if (product) {
      renderDetailPage(product);
    } else {
      showToast('商品不存在');
      window.location.hash = '';
      hideDetailPage();
    }
  } else {
    hideDetailPage();
  }
}

function refreshData() {
  loadProducts();
  if (state.user?.role === 'buyer') loadBuyerOrders();
  if (state.user?.role === 'merchant') loadMerchantOrders();
  handleRoute();
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

function setupPreview() {
  const input = $('product-image');
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) {
      setPreview(PLACEHOLDER);
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('请上传图片文件');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  });
  setPreview(PLACEHOLDER);
}

function init() {
  setupTabs();
  toggleRoleFields();
  setupPreview();
  $('reg-role').onchange = toggleRoleFields;
  $('login-btn').onclick = handleLogin;
  $('register-btn').onclick = handleRegister;
  $('logout-btn').onclick = () => {
    clearUser();
    showToast('已退出登录');
  };
  $('product-form').addEventListener('submit', saveProduct);
  $('product-reset').onclick = resetProductForm;
  $('detail-back').onclick = () => {
    window.location.hash = '';
    hideDetailPage();
  };
  window.addEventListener('hashchange', handleRoute);
  loadUser();
  loadProducts();
  handleRoute();
}

document.addEventListener('DOMContentLoaded', init);

