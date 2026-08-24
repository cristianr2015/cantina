const APP_CONFIG = window.APP_CONFIG || {};
const API_BASE_URL = normalizeBaseUrl(APP_CONFIG.API_BASE_URL || localStorage.getItem('apiBaseUrl') || '');
const CAPACITOR_HTTP = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp;
const ROLE_LABELS = {
  admin: 'Administrador',
  seller: 'Vendedor',
  puerta: 'Puerta'
};

function getUserRoles(user) {
  const roles = Array.isArray(user?.roles) && user.roles.length ? user.roles : (user?.role ? [user.role] : []);
  return [...new Set(roles.filter(role => Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)))];
}

function userHasRole(user, role) {
  return getUserRoles(user).includes(role);
}

const ALL_APP_PAGES = ['dashboard', 'sales', 'tickets', 'partners', 'products', 'reports', 'config'];

function getAllowedPages(user) {
  if (userHasRole(user, 'admin')) return ALL_APP_PAGES;
  const pages = [];
  if (userHasRole(user, 'seller')) pages.push('sales');
  if (userHasRole(user, 'puerta')) pages.push('tickets');
  return pages;
}

function getDefaultPage(user) {
  if (userHasRole(user, 'admin')) return 'dashboard';
  if (userHasRole(user, 'seller')) return 'sales';
  if (userHasRole(user, 'puerta')) return 'tickets';
  return 'dashboard';
}

function userCanAccessPage(user, page) {
  return getAllowedPages(user).includes(page);
}

function formatUserRoles(user) {
  return getUserRoles(user).map(role => ROLE_LABELS[role]).join(' · ');
}
const TICKET_TYPE_LABELS = {
  anticipada: '🎟️ Anticipada',
  puerta: '🚪 En puerta',
  cortesia: '🎁 Cortesía'
};
let ticketSettings = {
  ticket_price_advance: 10000,
  ticket_price_door: 12000
};
const ACTIVE_EVENT_STORAGE_KEY = 'activeEventId';
let eventsCache = [];

function getActiveEventId() {
  const eventId = Number(localStorage.getItem(ACTIVE_EVENT_STORAGE_KEY));
  return Number.isInteger(eventId) && eventId > 0 ? eventId : null;
}

function getActiveEvent() {
  const eventId = getActiveEventId();
  return eventsCache.find(event => Number(event.id) === eventId) || null;
}

function addActiveEventHeader(headers) {
  const eventId = getActiveEventId();
  if (eventId) headers['X-Event-Id'] = String(eventId);
  return headers;
}

function normalizeBaseUrl(value) {
  if (!value) return '';
  return String(value).trim().replace(/\/+$/, '');
}

function buildUrl(path) {
  if (!path) return API_BASE_URL || window.location.origin;
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : '/' + path;
  return API_BASE_URL ? API_BASE_URL + normalizedPath : normalizedPath;
}

function assetUrl(path, fallback = '') {
  if (!path) return fallback ? buildUrl(fallback) : '';
  return buildUrl(path);
}

function applyCompanyBranding(settings = {}) {
  const companyName = settings.company_name || 'Cantina';
  const logoPath = settings.logo_path || '';
  const resolvedLogo = assetUrl(logoPath, '/uploads/default-logo.png');

  const loginName = document.getElementById('login-company-name');
  if (loginName) loginName.textContent = companyName;

  const loginLogo = document.getElementById('login-logo');
  if (loginLogo) {
    if (logoPath) {
      loginLogo.src = resolvedLogo;
      loginLogo.style.display = 'inline-block';
    } else {
      loginLogo.style.display = 'none';
    }
  }

  const sidebarName = document.getElementById('sidebar-company-name');
  if (sidebarName) sidebarName.textContent = companyName;

  const sidebarLogo = document.getElementById('sidebar-logo');
  if (sidebarLogo) sidebarLogo.src = resolvedLogo;
}

function setSessionCookie(name, value) {
  document.cookie = name + "=" + (value || "") + "; path=/; SameSite=Lax";
}
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i=0;i < ca.length;i++) {
    let c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}
function deleteCookie(name) {
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function getSessionToken() {
  return localStorage.getItem('token') || getCookie('token');
}

function setSessionToken(token) {
  if (!token) return;
  localStorage.setItem('token', token);
  setSessionCookie('token', token);
}

function clearSession() {
  deleteCookie('token');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

function showDebugInfo(lines = []) {
  const box = document.getElementById('debug-info');
  if (!box) return;
  if (!lines.length) {
    box.style.display = 'none';
    box.textContent = '';
    return;
  }
  box.style.display = 'block';
  box.textContent = lines.join('\n');
}

function isMobileViewport() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function getSidebarElements() {
  return {
    sidebar: document.getElementById('main-sidebar'),
    overlay: document.getElementById('sidebar-overlay'),
    toggle: document.getElementById('mobile-menu-btn')
  };
}

function setSidebarOpen(open) {
  const { sidebar, overlay, toggle } = getSidebarElements();
  if (!sidebar || !overlay) return;
  const shouldOpen = !!open && isMobileViewport();
  sidebar.classList.toggle('open', shouldOpen);
  overlay.style.display = shouldOpen ? 'block' : 'none';
  document.body.classList.toggle('mobile-nav-open', shouldOpen);
  if (toggle) toggle.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function closeSidebar() {
  setSidebarOpen(false);
}

function enhanceResponsiveTables(root = document) {
  root.querySelectorAll('table').forEach((table) => {
    const headerCells = Array.from(table.querySelectorAll('thead th'));
    const firstRow = table.querySelector('tr');
    const fallbackHeaders = headerCells.length ? headerCells : Array.from(firstRow?.querySelectorAll('th') || []);
    if (!fallbackHeaders.length) return;

    const headers = fallbackHeaders.map((cell) => (cell.textContent || '').trim());
    table.classList.add('responsive-table');

    Array.from(table.querySelectorAll('tr')).forEach((row) => {
      const isHeaderRow = !!row.querySelector('th') && !row.querySelector('td');
      if (isHeaderRow) {
        row.classList.add('table-head-row');
        return;
      }
      Array.from(row.children).forEach((cell, index) => {
        if (cell.tagName === 'TD') {
          cell.setAttribute('data-label', headers[index] || '');
        }
      });
    });
  });
}

function syncMobileChrome() {
  const { toggle } = getSidebarElements();
  if (toggle) toggle.setAttribute('aria-expanded', 'false');
  if (!isMobileViewport()) closeSidebar();
}

function initMobileUI() {
  const { overlay, toggle } = getSidebarElements();
  if (toggle && !toggle.dataset.mobileBound) {
    toggle.dataset.mobileBound = 'true';
    toggle.addEventListener('click', () => {
      const { sidebar } = getSidebarElements();
      setSidebarOpen(!(sidebar && sidebar.classList.contains('open')));
    });
  }
  if (overlay && !overlay.dataset.mobileBound) {
    overlay.dataset.mobileBound = 'true';
    overlay.addEventListener('click', closeSidebar);
  }
  if (!window.__cantinaMobileBound) {
    window.__cantinaMobileBound = true;
    window.addEventListener('resize', syncMobileChrome);
  }
  syncMobileChrome();
  enhanceResponsiveTables();
}

function isNativeHttpAvailable() {
  return !!CAPACITOR_HTTP && !!window.Capacitor && typeof window.Capacitor.getPlatform === 'function' && window.Capacitor.getPlatform() !== 'web';
}

async function requestJson(url, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = Object.assign({}, opts.headers || {});
  const rawBody = opts.body;

  if (isNativeHttpAvailable()) {
    const requestOptions = {
      url,
      method,
      headers,
      connectTimeout: 15000,
      readTimeout: 15000
    };

    if (rawBody != null) {
      if (headers['Content-Type'] === 'application/json' && typeof rawBody === 'string') {
        try {
          requestOptions.data = JSON.parse(rawBody);
        } catch (e) {
          requestOptions.data = rawBody;
        }
      } else {
        requestOptions.data = rawBody;
      }
    }

    const response = await CAPACITOR_HTTP.request(requestOptions);
    let data = response.data;
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        // keep raw string
      }
    }
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      data
    };
  }

  const response = await fetch(url, Object.assign({ cache: 'no-store' }, opts, { headers }));
  const text = await response.text();
  let data = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    // keep raw text
  }
  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

// Funciones de formato de fecha y hora
function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  // Usar UTC para fechas puras (evitar desfase de zona horaria)
  if (typeof val === 'string' && (val.indexOf('T00:00:00.000Z') !== -1 || val.length === 10)) {
    return String(d.getUTCDate()).padStart(2,'0') + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + d.getUTCFullYear();
  }
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear();
}

function formatDateTime(val) {
  if (!val) return '';
  const d = new Date(val);
  return String(d.getDate()).padStart(2,'0') + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + d.getFullYear() + ' ' +
         String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}

function formatMoney(val) {
  return '$' + parseFloat(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ticketPrice(type, row = null) {
  if (row && row.price_paid !== undefined && row.price_paid !== null) return Number(row.price_paid);
  if (type === 'anticipada') return Number(ticketSettings.ticket_price_advance || 0);
  if (type === 'puerta') return Number(ticketSettings.ticket_price_door || 0);
  return 0;
}

function ticketTypeLabel(type) {
  return TICKET_TYPE_LABELS[type] || type;
}

// Toast notification function
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <span class="close" onclick="this.parentElement.remove()">×</span>
  `;
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

// Confirm modal function
function showConfirm(message, callback, title = 'Confirmar Acción') {
  const modal = document.getElementById('confirm-modal');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  modal.classList.remove('hidden');
  
  const okBtn = document.getElementById('confirm-ok');
  const cancelBtn = document.getElementById('confirm-cancel');
  
  const closeModal = () => modal.classList.add('hidden');
  
  okBtn.onclick = () => {
    closeModal();
    callback();
  };
  
  cancelBtn.onclick = closeModal;
}

let pendingAdminApproval = null;

function closeAdminApprovalModal(result = null) {
  const modal = document.getElementById('admin-approval-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  }
  document.getElementById('admin-approval-form')?.reset();
  if (pendingAdminApproval) {
    const resolve = pendingAdminApproval.resolve;
    pendingAdminApproval = null;
    resolve(result);
  }
}

function requestAdminApproval(action, message) {
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  if (userHasRole(currentUser, 'admin')) return Promise.resolve('');
  if (pendingAdminApproval) closeAdminApprovalModal(null);

  const modal = document.getElementById('admin-approval-modal');
  document.getElementById('admin-approval-message').textContent = message;
  document.getElementById('admin-approval-error').textContent = '';
  document.getElementById('admin-approval-form').reset();
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('admin-approval-username').focus(), 0);

  return new Promise(resolve => {
    pendingAdminApproval = { action, resolve };
  });
}

document.getElementById('admin-approval-cancel')?.addEventListener('click', () => closeAdminApprovalModal(null));
document.getElementById('admin-approval-modal')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closeAdminApprovalModal(null);
});
document.getElementById('admin-approval-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!pendingAdminApproval) return;
  const submitButton = document.getElementById('admin-approval-submit');
  const errorOutput = document.getElementById('admin-approval-error');
  submitButton.disabled = true;
  errorOutput.textContent = '';
  const result = await api('/auth/admin-approval', {
    method: 'POST',
    body: JSON.stringify({
      username: document.getElementById('admin-approval-username').value.trim(),
      password: document.getElementById('admin-approval-password').value,
      action: pendingAdminApproval.action
    })
  });
  submitButton.disabled = false;
  if (result.error) {
    errorOutput.textContent = result.error;
    document.getElementById('admin-approval-password').value = '';
    document.getElementById('admin-approval-password').focus();
    return;
  }
  closeAdminApprovalModal(result.approvalToken);
});

function approvalHeaders(approvalToken) {
  return approvalToken ? { 'X-Admin-Approval': approvalToken } : {};
}

async function api(path, opts = {}){
  const headers = addActiveEventHeader(Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}));
  const token = getSessionToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const url = buildUrl('/api' + path);

  let res;
  try {
    res = await requestJson(url, Object.assign({}, opts, { headers }));
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error('Error de red en API', path, error);
    showDebugInfo([
      'Diagnostico de conexion',
      'API_BASE_URL: ' + (API_BASE_URL || '(vacia)'),
      'Request: ' + url,
      'Error: ' + message
    ]);
    return { error: 'No se pudo conectar con el servidor remoto' };
  }
  
  if (!res.ok) {
    showDebugInfo([
      'Diagnostico de conexion',
      'API_BASE_URL: ' + (API_BASE_URL || '(vacia)'),
      'Request: ' + url,
      'HTTP: ' + res.status
    ]);
    if (res.status === 413) return { error: 'El archivo es demasiado grande para el servidor' };
    if (res.status === 401) {
      clearSession();
      location.reload();
      return { error: 'Sesión expirada' };
    }
    if (res.data && typeof res.data === 'object') return res.data;
    return { error: `Error ${res.status}: Solicitud fallida` };
  }

  showDebugInfo([]);
  return res.data;
}

async function printTicketPdf(ids) {
  const response = await fetch(buildUrl('/api/tickets/pdf'), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + getSessionToken(),
      ...(getActiveEventId() ? { 'X-Event-Id': String(getActiveEventId()) } : {})
    },
    body: JSON.stringify({ ids })
  });
  if (!response.ok) {
    let message = 'No se pudo generar el PDF';
    try {
      const data = await response.json();
      if (data.error) message = data.error;
    } catch (_) {}
    throw new Error(message);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
  frame.onload = () => {
    setTimeout(() => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (_) {
        window.open(url, '_blank', 'noopener');
      }
    }, 300);
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60000);
  };
  frame.src = url;
  document.body.appendChild(frame);
}

const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base = dataUrl.split(',')[1];
      resolve({ filename: file.name, data: base });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

async function loadProducts(){
  const prods = await api('/products');
  if (!Array.isArray(prods)) {
    showToast(prods.error || 'No se pudieron cargar los productos', 'error');
    return;
  }
  
  // 1. Renderizar lista de administración (si existe)
  const list = document.getElementById('products-list');
  if (list) {
    list.innerHTML = '';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = userHasRole(user, 'admin');

    prods.forEach(p => {
      const card = document.createElement('div');
      card.className = 'prod-card';
      const imgHtml = p.image_path 
        ? `<img src="${assetUrl(p.image_path)}" class="prod-img">` 
        : `<div class="prod-img" style="display:flex;align-items:center;justify-content:center;color:rgba(100,116,139,0.35)"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

      card.innerHTML = `
        ${imgHtml}
        <div class="prod-info">
          <h4 class="prod-name" title="${p.name}">${p.name}</h4>
          <div class="prod-meta" style="gap:10px">
            <span class="prod-cost" title="Costo">Costo: ${formatMoney(p.price_cost)}</span>
            <span class="prod-price" title="Precio Venta">${formatMoney(p.price_sale)}</span>
          </div>
          <div style="margin-top:8px;font-size:13px;font-weight:600;color:${p.stock <= 5 ? '#ef4444' : 'var(--muted)'}">
            Stock actual: ${p.stock || 0}
          </div>
          <div class="prod-actions" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
            <button onclick="editProduct(${p.id})" style="flex:1;padding:8px 12px;font-size:12px;font-weight:600;background:var(--accent);color:white;border:none;border-radius:6px;cursor:pointer;transition:all .2s">Editar</button>
            <button onclick="deleteProduct(${p.id})" style="flex:1;padding:8px 12px;font-size:12px;font-weight:600;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;transition:all .2s">Borrar</button>
          </div>
        </div>
      `;

      if (isAdmin) {
        // keep right-click context menu for power users
        card.title = "Opciones: editar/borrar";
        card.addEventListener('contextmenu', (e) => { e.preventDefault(); showProdContextMenu(e, p); });
      }
      list.appendChild(card);
    });
  }

  // 2. Renderizar Grid de Punto de Venta (POS)
  const posGrid = document.getElementById('pos-grid-modal');
  if (posGrid) {
    posGrid.innerHTML = prods.map(p => `
      <div class="pos-card">
        <div onclick="addToCart(${p.id}, 1)">
          <img src="${assetUrl(p.image_path)}" class="pos-img" onerror="this.style.display='none'">
          <div class="pos-content">
            <h4 class="pos-title">${p.name}</h4>
            <div style="display:flex; justify-content:space-between; align-items:center; padding: 0 12px 12px 12px">
              <div class="pos-price">${formatMoney(p.price_sale)}</div>
              <div style="font-size:11px; color:${p.stock <= 5 ? '#ef4444' : 'var(--text-secondary)'}; font-weight:700">Stock: ${p.stock || 0}</div>
            </div>
          </div>
          <div class="pos-actions" style="padding: 0 12px 12px 12px">
            <button class="pos-btn" onclick="addToCart(${p.id})">Agregar</button>
          </div>
        </div>
      </div>
    `).join('');
  }
}

function eventLabel(event) {
  return `${event.name} (${formatDateTime(event.date)})`;
}

function populateEventSelect(select) {
  if (!select) return;
  const activeEventId = getActiveEventId();
  select.innerHTML = '';
  if (!eventsCache.length) {
    const option = document.createElement('option');
    option.textContent = 'No hay eventos disponibles';
    option.value = '';
    select.appendChild(option);
    select.disabled = true;
    return;
  }
  select.disabled = false;
  eventsCache.forEach(event => {
    const option = document.createElement('option');
    option.value = event.id;
    option.textContent = eventLabel(event);
    select.appendChild(option);
  });
  select.value = String(activeEventId || eventsCache[0].id);
}

function renderEventSelectors() {
  populateEventSelect(document.getElementById('topbar-event-select'));
  populateEventSelect(document.getElementById('dashboard-event-select'));
  const activeEvent = getActiveEvent();
  const dateOutput = document.getElementById('dashboard-event-date');
  if (dateOutput) {
    dateOutput.textContent = activeEvent
      ? `Comienza: ${formatDateTime(activeEvent.date)}`
      : 'Seleccione el evento que desea administrar';
  }
  const priceEventName = document.getElementById('ticket-price-event-name');
  if (priceEventName) priceEventName.textContent = activeEvent?.name || '-';
}

function renderEventManagement() {
  const tbody = document.getElementById('events-config-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  const activeEventId = getActiveEventId();
  eventsCache.forEach(event => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(15,23,42,0.08)';
    const nameCell = document.createElement('td');
    nameCell.style.padding = '10px';
    nameCell.textContent = event.name;
    const dateCell = document.createElement('td');
    dateCell.style.padding = '10px';
    dateCell.textContent = formatDateTime(event.date);
    const statusCell = document.createElement('td');
    statusCell.style.cssText = 'padding:10px;text-align:center';
    statusCell.textContent = Number(event.id) === activeEventId ? 'Activo' : '-';
    const actionsCell = document.createElement('td');
    actionsCell.style.cssText = 'padding:10px;text-align:right;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap';

    const selectButton = document.createElement('button');
    selectButton.textContent = Number(event.id) === activeEventId ? 'Seleccionado' : 'Seleccionar';
    selectButton.disabled = Number(event.id) === activeEventId;
    selectButton.style.cssText = 'padding:6px 10px;font-size:12px';
    selectButton.addEventListener('click', () => setActiveEvent(event.id));
    actionsCell.appendChild(selectButton);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Eliminar';
    deleteButton.style.cssText = 'padding:6px 10px;font-size:12px;background:#ef4444;color:#fff';
    deleteButton.addEventListener('click', () => deleteEvent(event.id));
    actionsCell.appendChild(deleteButton);

    tr.append(nameCell, dateCell, statusCell, actionsCell);
    tbody.appendChild(tr);
  });
  enhanceResponsiveTables(tbody.closest('.table-wrap') || document);
}

async function loadEvents() {
  const events = await api('/events');
  if (!Array.isArray(events)) {
    showToast(events.error || 'No se pudieron cargar los eventos', 'error');
    return [];
  }
  eventsCache = events;
  const storedEventId = getActiveEventId();
  if (!eventsCache.some(event => Number(event.id) === storedEventId)) {
    if (eventsCache[0]) localStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, String(eventsCache[0].id));
    else localStorage.removeItem(ACTIVE_EVENT_STORAGE_KEY);
  }
  renderEventSelectors();
  renderEventManagement();
  return eventsCache;
}

async function refreshActiveEventPage() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const requestedHash = location.hash.replace('#', '') || getDefaultPage(user);
  const hash = userCanAccessPage(user, requestedHash) ? requestedHash : getDefaultPage(user);
  if (hash === 'dashboard') await loadDashboard();
  if (hash === 'products') await loadProducts();
  if (hash === 'sales') await Promise.all([loadProducts(), loadSales()]);
  if (hash === 'tickets') await loadTickets();
  if (hash === 'partners') await loadExpenses();
  if (hash === 'reports' && activeReportType) await loadReport(activeReportType);
  if (hash === 'config') await Promise.all([loadSettings(), loadDiscountsForMgmt()]);
}

async function setActiveEvent(eventId, notify = true) {
  const parsedId = Number(eventId);
  const event = eventsCache.find(item => Number(item.id) === parsedId);
  if (!event) return showToast('El evento seleccionado ya no está disponible', 'error');
  localStorage.setItem(ACTIVE_EVENT_STORAGE_KEY, String(parsedId));
  if (typeof cart !== 'undefined') cart = [];
  if (typeof allProductsCache !== 'undefined') allProductsCache = [];
  if (typeof allDiscountsCache !== 'undefined') allDiscountsCache = [];
  if (typeof renderCart === 'function') renderCart();
  renderEventSelectors();
  renderEventManagement();
  await loadSettings();
  await refreshActiveEventPage();
  if (notify) showToast(`Evento activo: ${event.name}`, 'success');
}

async function deleteEvent(eventId) {
  const event = eventsCache.find(item => Number(item.id) === Number(eventId));
  if (!event) return;
  showConfirm(`¿Eliminar el evento "${event.name}"? Solo se permite si todavía no tiene datos.`, async () => {
    const result = await api('/events/' + event.id, { method: 'DELETE' });
    if (result.error) return showToast(result.error, 'error');
    await loadEvents();
    await setActiveEvent(getActiveEventId(), false);
    showToast('Evento eliminado', 'success');
  }, 'Eliminar evento');
}

['topbar-event-select', 'dashboard-event-select'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', event => setActiveEvent(event.target.value));
});

document.getElementById('create-event-btn')?.addEventListener('click', async () => {
  const name = document.getElementById('event-name').value.trim();
  const date = document.getElementById('event-date').value;
  const ticket_price_advance = Number(document.getElementById('event-price-advance').value);
  const ticket_price_door = Number(document.getElementById('event-price-door').value);
  if (!name || !date || !Number.isFinite(ticket_price_advance) || ticket_price_advance < 0 ||
      !Number.isFinite(ticket_price_door) || ticket_price_door < 0) {
    return showToast('Complete el nombre, la fecha, la hora y los precios del evento', 'error');
  }
  const result = await api('/events', {
    method: 'POST',
    body: JSON.stringify({ name, date, ticket_price_advance, ticket_price_door })
  });
  if (result.error) return showToast(result.error, 'error');
  document.getElementById('event-name').value = '';
  document.getElementById('event-date').value = '';
  await loadEvents();
  await setActiveEvent(result.id, false);
  showToast(`Evento "${result.name}" creado y seleccionado`, 'success');
});

async function loadSales(){
  const rows = await api('/sales');
  const div = document.getElementById('sales-list');
  if (!Array.isArray(rows)) {
    if (div) div.innerHTML = '<p style="color:#ef4444">No se pudieron cargar las ventas del evento.</p>';
    return;
  }
  div.innerHTML = '';
  const table = document.createElement('table');
  
  // Crear cabecera
  const thead = document.createElement('tr');
  thead.innerHTML = '<th>ID Venta</th><th>Items (Resumen)</th><th>Vendedor</th><th>Pago</th><th>Total</th><th>Fecha</th><th>Acciones</th>';
  table.appendChild(thead);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = userHasRole(user, 'admin');
  const canDeleteSales = isAdmin || userHasRole(user, 'seller');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    const pm = r.payment_method === 'mercadopago' ? '📱 MP' : '💵 Efec';
    tr.innerHTML = `<td>#${r.id}</td><td>${r.items_summary || 'Sin items'}</td><td>${r.sold_by || '-'}</td><td>${pm}</td><td>${formatMoney(r.total)}</td><td>${formatDateTime(r.created_at)}</td>`;
    const actionsCell = document.createElement('td');
    if (canDeleteSales) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'sale-delete-button';
      deleteButton.textContent = 'Eliminar';
      deleteButton.addEventListener('click', () => confirmSaleDeletion(r));
      actionsCell.appendChild(deleteButton);
    }
    tr.appendChild(actionsCell);
    // Administradores y vendedores pueden abrir acciones; el vendedor requiere aprobación para eliminar.
    if (canDeleteSales) {
      tr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, r);
      });
    }
    table.appendChild(tr);
  });

  div.appendChild(table);
  enhanceResponsiveTables(div);
}

let currentTicketEditId = null;

async function populateTicketUserSelect(select, selectedUser = null) {
  if (!select) return;
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  if (!currentUser) return;

  if (userHasRole(currentUser, 'admin')) {
    const users = await api('/users');
    if (!Array.isArray(users)) throw new Error('No se pudo cargar la lista de usuarios');
    select.disabled = false;
    select.innerHTML = '<option value="">-- Seleccionar Vendedor --</option>';
    users.forEach(user => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = `${user.username} (${formatUserRoles(user)})`;
      select.appendChild(option);
    });
    select.value = selectedUser?.id || currentUser.id;
    return;
  }

  const assignedUser = selectedUser?.id
    ? selectedUser
    : { id: currentUser.id, username: currentUser.username };
  select.innerHTML = '';
  const option = document.createElement('option');
  option.value = assignedUser.id;
  option.textContent = assignedUser.username || currentUser.username;
  select.appendChild(option);
  select.value = assignedUser.id;
  select.disabled = true;
}

async function loadTickets(search = '') {
  const tbody = document.getElementById('tickets-body');
  if (!tbody) return;
  try {
    const rows = await api('/tickets' + (search ? '?search=' + encodeURIComponent(search) : ''));
    if (!Array.isArray(rows)) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:red">Error al cargar datos del servidor</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--muted)">No se encontraron entradas con ese criterio</td></tr>';
      return;
    }

  const grouped = rows.reduce((acc, r) => {
    const key = `${r.dni}-${r.ticket_type}-${r.price_paid}`;
    if (!acc[key]) {
      acc[key] = { ...r, qty: 0, entered_count: 0, ticket_ids: [] };
    }
    acc[key].qty++;
    acc[key].ticket_ids.push({ id: r.id, entered: !!r.entered, qr_token: r.qr_token });
    if (r.entered) acc[key].entered_count++;
    return acc;
  }, {});

  Object.values(grouped).forEach(r => {
      const price = ticketPrice(r.ticket_type, r);
      const typeStr = ticketTypeLabel(r.ticket_type);
      const tr = document.createElement('tr');
      const nextUnentered = r.ticket_ids.find(t => !t.entered);
    const statusIngreso = r.qty > 1 ? `${r.entered_count}/${r.qty}` : (r.entered ? 'SI' : 'NO');

      tr.innerHTML = `
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2)">${r.first_name}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2)">${r.last_name}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2)">${r.dni}</td>
      <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);text-align:center;font-weight:700">${r.qty}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);font-size:12px">${typeStr}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);font-weight:600">${formatMoney(price)}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);font-weight:600">${formatMoney(price * r.qty)}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2)">${r.sold_by || '-'}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);text-align:center">${statusIngreso}</td>
        <td style="padding:8px;border-bottom:1px solid rgba(120,120,120,0.2);display:flex;gap:8px;justify-content:flex-start;flex-wrap:wrap">
          <button onclick="editTicket(${r.id})" style="padding:6px 12px;font-size:12px;font-weight:600;background:var(--accent);color:white;border:none;border-radius:6px;cursor:pointer;transition:all .2s">Editar</button>
          ${r.ticket_type === 'anticipada' && nextUnentered ? `<button onclick="showTicketQR(${nextUnentered.id})" style="padding:6px 12px;font-size:12px;font-weight:600;background:#6366f1;color:#fff;border:none;border-radius:6px;cursor:pointer;transition:all .2s">QR</button>` : ''}
          ${r.ticket_type === 'anticipada' ? `<button onclick="printTicketPdf([${r.ticket_ids.map(t => t.id).join(',')}]).catch(err => showToast(err.message, 'error'))" style="padding:6px 12px;font-size:12px;font-weight:600;background:#0f172a;color:#fff;border:none;border-radius:6px;cursor:pointer;transition:all .2s">PDF</button>` : ''}
          ${nextUnentered ? `<button onclick="toggleEntry(${nextUnentered.id}, true)" style="padding:6px 12px;font-size:12px;font-weight:600;background:#10b981;color:white;border:none;border-radius:6px;cursor:pointer;transition:all .2s">Entró</button>` : ''}
          <button onclick="deleteTicket([${r.ticket_ids.map(t => t.id).join(',')}])" style="padding:6px 12px;font-size:12px;font-weight:600;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer;transition:all .2s">Eliminar</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
    enhanceResponsiveTables(document.getElementById('ticket-table-wrapper') || document);
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:red">Error de conexión con el servidor</td></tr>';
  }
}

window.showTicketQR = async function(id) {
  try {
    const rows = await api('/tickets');
    const ticket = rows.find(t => t.id === id);
    if (!ticket) return;
    if (ticket.ticket_type !== 'anticipada' || !ticket.qr_token) {
      return showToast('Esta entrada no posee QR de ingreso', 'error');
    }
    if (ticket.entered) {
      return showToast('Esta entrada ya fue utilizada', 'error');
    }

    document.getElementById('qr-viewer-title').textContent = `${ticket.first_name} ${ticket.last_name}`;
    document.getElementById('qr-viewer-desc').textContent = `DNI: ${ticket.dni} - Tipo: ${ticket.ticket_type}`;
    
    const container = document.getElementById('qrcode-container');
    container.innerHTML = '';
    new QRCode(container, { text: `PENA_TICKET:${ticket.qr_token}`, width: 200, height: 200 });
    
    document.getElementById('qr-viewer-modal').classList.remove('hidden');
  } catch (err) {
    showToast('Error al generar QR', 'error');
  }
};

window.editTicket = async function(id) {
  try {
    const rows = await api('/tickets');
    if (!Array.isArray(rows)) return showToast('Error al obtener lista de entradas', 'error');
    const ticket = rows.find(t => t.id === id);
    if (!ticket) return showToast('Entrada no encontrada', 'error');

    // Guardar metadata para poder crear duplicados exactos si se aumenta la cantidad
    const modal = document.getElementById('edit-ticket-modal');
    modal.dataset.paymentMethod = ticket.payment_method;
    modal.dataset.ticketType = ticket.ticket_type;

    document.getElementById('edit-ticket-id').value = ticket.id;
    document.getElementById('edit-ticket-firstname').value = ticket.first_name;
    document.getElementById('edit-ticket-lastname').value = ticket.last_name;
    document.getElementById('edit-ticket-dni').value = ticket.dni;

    const userSel = document.getElementById('edit-ticket-user');
    if (userSel) {
      await populateTicketUserSelect(userSel, {
        id: ticket.user_id,
        username: ticket.sold_by
      });
    }

    document.getElementById('edit-ticket-qty').value = 1;
    document.getElementById('edit-ticket-modal').classList.remove('hidden');
  } catch (err) {
    showToast('Error al cargar datos de la entrada', 'error');
  }
};

document.getElementById('edit-ticket-cancel').addEventListener('click', () => {
  document.getElementById('edit-ticket-modal').classList.add('hidden');
});

document.getElementById('edit-ticket-save').addEventListener('click', async () => {
  const id = document.getElementById('edit-ticket-id').value;
  const firstName = document.getElementById('edit-ticket-firstname').value.trim();
  const lastName = document.getElementById('edit-ticket-lastname').value.trim();
  const dni = document.getElementById('edit-ticket-dni').value.trim();
  const userId = document.getElementById('edit-ticket-user').value;
  const qty = parseInt(document.getElementById('edit-ticket-qty').value) || 1;

  if (!firstName || !lastName || !dni || !userId) {
    return showToast('Completa todos los campos', 'error');
  }

  // 1. Actualizar la entrada original
  const res = await api('/tickets/' + id, {
    method: 'PUT',
    body: JSON.stringify({ first_name: firstName, last_name: lastName, dni, user_id: userId })
  });

  if (res.error) return showToast(res.error, 'error');

  // 2. Si se pidió más de 1, crear las adicionales en una operación atómica.
  if (qty > 1) {
    const modal = document.getElementById('edit-ticket-modal');
    const payment = modal.dataset.paymentMethod || 'cash';
    const type = modal.dataset.ticketType || 'anticipada';
    
    const created = await api('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        first_name: firstName, last_name: lastName, dni,
        payment_method: payment, ticket_type: type, user_id: userId, quantity: qty - 1
      })
    });
    if (created.error) return showToast(created.error, 'error');
    if (type === 'anticipada') {
      try {
        await printTicketPdf(created.tickets.map(ticket => ticket.id));
      } catch (error) {
        showToast('Las entradas se crearon, pero no se pudo imprimir el PDF: ' + error.message, 'error');
      }
    }
  }

  document.getElementById('edit-ticket-modal').classList.add('hidden');
  const searchInput = document.getElementById('ticket-search');
  await loadTickets(searchInput ? searchInput.value.trim() : '');
  showToast(qty > 1 ? `Entrada actualizada y ${qty-1} adicionales creadas` : 'Entrada actualizada correctamente', 'success');
});

window.toggleEntry = async function(id) {
  try {
    const result = await api('/tickets/' + id + '/enter', { method: 'PATCH', body: JSON.stringify({ entered: true }) });
    if (result.error) return showToast(result.error, 'error');
    const searchInput = document.getElementById('ticket-search');
    await loadTickets(searchInput ? searchInput.value.trim() : '');
    showToast('Estado de ingreso actualizado', 'success');
  } catch (err) {
    showToast('Error al marcar ingreso', 'error');
  }
};

let pendingTicketDeleteIds = [];

function closeDeleteTicketModal() {
  document.getElementById('delete-ticket-modal')?.classList.add('hidden');
  pendingTicketDeleteIds = [];
}

window.deleteTicket = function(ids) {
  const normalizedIds = (Array.isArray(ids) ? ids : [ids])
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value > 0);
  pendingTicketDeleteIds = Array.from(new Set(normalizedIds));
  if (!pendingTicketDeleteIds.length) {
    return showToast('No se encontraron entradas para eliminar', 'error');
  }

  const total = pendingTicketDeleteIds.length;
  const qtyInput = document.getElementById('delete-ticket-qty');
  document.getElementById('delete-ticket-message').textContent = total === 1
    ? 'Esta venta contiene 1 entrada. Indique cuántas desea eliminar.'
    : `Esta venta contiene ${total} entradas. Indique cuántas desea eliminar.`;
  qtyInput.max = String(total);
  qtyInput.value = String(total);
  document.getElementById('delete-ticket-modal').classList.remove('hidden');
  window.requestAnimationFrame(() => {
    qtyInput.focus();
    qtyInput.select();
  });
};

document.getElementById('delete-ticket-cancel')?.addEventListener('click', closeDeleteTicketModal);

document.getElementById('delete-ticket-confirm')?.addEventListener('click', async () => {
  const total = pendingTicketDeleteIds.length;
  const quantity = Number.parseInt(document.getElementById('delete-ticket-qty').value, 10);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > total) {
    return showToast(`La cantidad debe estar entre 1 y ${total}`, 'error');
  }

  const ids = pendingTicketDeleteIds.slice(0, quantity);
  const confirmButton = document.getElementById('delete-ticket-confirm');
  confirmButton.disabled = true;
  try {
    const approvalToken = await requestAdminApproval(
      'delete:ticket',
      `Para eliminar ${quantity} entrada(s), ingresá las credenciales de un administrador.`
    );
    if (approvalToken === null) return;
    const res = await api('/tickets/delete-batch', {
      method: 'POST',
      headers: approvalHeaders(approvalToken),
      body: JSON.stringify({ ids })
    });
    if (res.error) return showToast(res.error, 'error');
    closeDeleteTicketModal();
    const searchInput = document.getElementById('ticket-search');
    await loadTickets(searchInput ? searchInput.value.trim() : '');
    showToast(`${res.deleted} entrada(s) eliminada(s) correctamente`, 'success');
  } catch (err) {
    showToast('Error al eliminar entradas', 'error');
  } finally {
    confirmButton.disabled = false;
  }
});

// Funciones heredadas del formulario inline (ya no se usan)
/*
async function clearTicketForm() {
  currentTicketEditId = null;
  document.getElementById('ticket-firstname').value = '';
  document.getElementById('ticket-lastname').value = '';
  document.getElementById('ticket-dni').value = '';
  document.getElementById('ticket-update-btn').disabled = true;
  document.getElementById('ticket-cancel-btn').style.display = 'none';
}

async function addTicket() {
  const first_name = document.getElementById('ticket-firstname').value.trim();
  const last_name = document.getElementById('ticket-lastname').value.trim();
  const dni = document.getElementById('ticket-dni').value.trim();
  if (!first_name || !last_name || !dni) return showToast('Complete nombre, apellido y dni', 'error');

  const res = await api('/tickets', { method: 'POST', body: JSON.stringify({ first_name, last_name, dni }) });
  if (res.error) return showToast(res.error, 'error');

  await clearTicketForm();
  await loadTickets(document.getElementById('ticket-search').value.trim());
  showToast('Entrada vendida agregada', 'success');
}

async function updateTicket() {
  if (!currentTicketEditId) return showToast('Seleccione una entrada para modificar', 'error');

  const first_name = document.getElementById('ticket-firstname').value.trim();
  const last_name = document.getElementById('ticket-lastname').value.trim();
  const dni = document.getElementById('ticket-dni').value.trim();
  if (!first_name || !last_name || !dni) return showToast('Complete nombre, apellido y dni', 'error');

  const res = await api('/tickets/' + currentTicketEditId, { method: 'PUT', body: JSON.stringify({ first_name, last_name, dni }) });
  if (res.error) return showToast(res.error, 'error');

  await clearTicketForm();
  await loadTickets(document.getElementById('ticket-search').value.trim());
  showToast('Entrada vendida actualizada', 'success');
}
*/

async function initTicketControls() {
  const search = document.getElementById('ticket-search');
  search.addEventListener('input', () => loadTickets(search.value.trim()));
}

// iniciar controles de tickets vendidos
initTicketControls();

function showLoginError(msg){ document.getElementById('login-error').textContent = msg; }

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  showLoginError('');
  showDebugInfo([
    'Diagnostico de conexion',
    'API_BASE_URL: ' + (API_BASE_URL || '(vacia)'),
    'Request: ' + buildUrl('/api/auth/login')
  ]);
  const res = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  if (res.token) {
    setSessionToken(res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
    showDebugInfo([]);
    initAfterLogin();
  } else {
    showLoginError(res.error || 'Login falló');
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearSession();
  location.reload();
});

// Actualizar texto del input file personalizado
document.getElementById('prod-image').addEventListener('change', function() {
  document.getElementById('file-name-display').textContent = this.files[0] ? this.files[0].name : '📷 Subir imagen...';
});

let productEditMode = false;

function resetProductForm() {
  productEditMode = false;
  document.getElementById('prod-id').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-cost').value = '';
  document.getElementById('prod-sale').value = '';
  document.getElementById('prod-image').value = '';
  if (document.getElementById('prod-stock')) document.getElementById('prod-stock').value = '';
  document.getElementById('file-name-display').textContent = '📷 Seleccionar imagen';
  document.getElementById('prod-form-title').textContent = 'Agregar nuevo producto';
  document.getElementById('prod-save-btn').textContent = 'Guardar producto';
}

async function setProductFormToEdit(product) {
  productEditMode = true;
  document.getElementById('prod-id').value = product.id;
  document.getElementById('prod-name').value = product.name;
  document.getElementById('prod-cost').value = product.price_cost || 0;
  document.getElementById('prod-sale').value = product.price_sale || 0;
  if (document.getElementById('prod-stock')) document.getElementById('prod-stock').value = product.stock || 0;
  document.getElementById('file-name-display').textContent = '📷 Seleccionar nueva imagen';
  document.getElementById('prod-form-title').textContent = 'Editar producto';
  document.getElementById('prod-save-btn').textContent = 'Guardar cambios';
  document.getElementById('product-modal').classList.remove('hidden');
}

async function submitProductForm() {
  const id = document.getElementById('prod-id').value;
  const name = document.getElementById('prod-name').value.trim();
  const cost = parseFloat(document.getElementById('prod-cost').value) || 0;
  const sale = parseFloat(document.getElementById('prod-sale').value) || 0;
  const stock = parseInt(document.getElementById('prod-stock')?.value) || 0;
  const fileInput = document.getElementById('prod-image');

  if (!name) return showToast('Ingrese el nombre del producto', 'error');
  if (sale <= 0) return showToast('Ingrese un precio de venta válido', 'error');

  const payload = { name, price_cost: cost, price_sale: sale, stock };
  if (fileInput.files.length > 0) {
    if (fileInput.files[0].size > 5 * 1024 * 1024) return showToast('La imagen es muy pesada (máximo 5MB)', 'error');
    const fileData = await readFileAsBase64(fileInput.files[0]);
    payload.image_name = fileData.filename;
    payload.image_data = fileData.data;
  }

  if (productEditMode && id) {
    const res = await api('/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    if (res.error) return showToast('Error: ' + res.error, 'error');
    showToast('Producto actualizado', 'success');
  } else {
    const res = await api('/products', { method: 'POST', body: JSON.stringify(payload) });
    if (res.error) return showToast('Error: ' + res.error, 'error');
    showToast('Producto agregado', 'success');
  }

  document.getElementById('product-modal').classList.add('hidden');
  resetProductForm();
  await loadProducts();
  await loadDashboard();
}

async function editProduct(id) {
  const products = await api('/products');
  const prod = products.find(p => p.id === id);
  if (!prod) return showToast('Producto no encontrado', 'error');
  setProductFormToEdit(prod);
}

async function deleteProduct(id) {
  if (!confirm('¿Confirmas eliminar este producto?')) return;
  await api('/products/' + id, { method: 'DELETE' });
  showToast('Producto eliminado', 'success');
  await loadProducts();
}

function bindProductHandlers() {
  // Botón para abrir modal
  document.getElementById('open-add-product-btn').addEventListener('click', () => {
    resetProductForm();
    document.getElementById('product-modal').classList.remove('hidden');
  });

  // Botones del modal
  document.getElementById('prod-save-btn').addEventListener('click', submitProductForm);
  document.getElementById('prod-cancel-modal-btn').addEventListener('click', () => {
    document.getElementById('product-modal').classList.add('hidden');
    resetProductForm();
  });

  // Cambio de imagen
  document.getElementById('prod-image').addEventListener('change', function () {
    document.getElementById('file-name-display').textContent = this.files[0] ? this.files[0].name : '📷 Seleccionar imagen';
  });
}

bindProductHandlers();

// --- POS / Cart Logic ---
let cart = [];
let allProductsCache = []; // Para buscar info del producto al agregar al carrito
let allDiscountsCache = [];

// Cachear productos al cargar
async function refreshProductsCache() {
  allProductsCache = await api('/products');
}

async function addToCart(product_id, manualQty = null) {
  if (allProductsCache.length === 0) await refreshProductsCache();
  const product = allProductsCache.find(p => p.id === product_id);
  if (!product) return;

  let quantity;
  if (manualQty !== null) {
    quantity = manualQty;
  } else {
    const qtyInput = document.getElementById('qty-' + product_id);
    quantity = parseInt(qtyInput.value) || 1;
  }

  if (product.stock !== undefined && product.stock < quantity) {
    return showToast(`Stock insuficiente para ${product.name} (Disponible: ${product.stock})`, 'error');
  }

  // Verificar si ya está en el carrito
  const existing = cart.find(item => item.product_id === product_id);
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      product_id: product.id,
      name: product.name,
      price: parseFloat(product.price_sale),
      quantity: quantity
    });
  }

  // Reset UI del producto
  if (manualQty === null) {
    const qtyInput = document.getElementById('qty-' + product_id);
    if (qtyInput) qtyInput.value = 1;
    const qtyBtn = document.getElementById('qty-btn-' + product_id);
    if (qtyBtn) qtyBtn.textContent = '1';
  }

  renderCart();
}

function renderCart() {
  const tbody = document.getElementById('cart-body');
  const emptyState = document.getElementById('cart-empty-state');
  const itemsCountDisplay = document.getElementById('cart-items-count-display');
  const itemsQtyDisplay = document.getElementById('cart-items-qty-display');
  const subtotalDisplay = document.getElementById('cart-subtotal-display');
  tbody.innerHTML = '';
  let subtotal = 0;
  let totalUnits = 0;
  
  cart.forEach((item, index) => {
    const itemSubtotal = item.price * item.quantity;
    subtotal += itemSubtotal;
    totalUnits += item.quantity;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="padding: 12px 0;">
        <div style="font-weight:700; color:var(--text-primary);">${item.name}</div>
        <div style="font-size:12px; color:var(--text-secondary);">${formatMoney(item.price)} / un.</div>
      </td>
      <td style="text-align:center;">
        <div style="display:inline-flex; align-items:center; background:#f1f5f9; border-radius:8px; padding:2px;">
          <button class="btn-qty-mini" onclick="updateCartQty(${index}, -1)" style="border:none; background:transparent;">-</button>
          <span style="min-width:30px; font-weight:800; font-size:14px;">${item.quantity}</span>
          <button class="btn-qty-mini" onclick="updateCartQty(${index}, 1)" style="border:none; background:transparent;">+</button>
        </div>
      </td>
      <td style="text-align:right; font-weight:700; color:var(--text-primary);">${formatMoney(itemSubtotal)}</td>
      <td style="text-align:right; padding-left:10px;"><button class="btn-ghost" onclick="removeFromCart(${index})" style="color:#ef4444; padding:4px;">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  // Aplicar descuento visual
  const dscId = document.getElementById('pos-discount').value;
  const dsc = allDiscountsCache.find(d => d.id == dscId);
  const finalTotal = subtotal * (1 - ((dsc ? dsc.percentage : 0) / 100));

  if (emptyState) emptyState.style.display = cart.length ? 'none' : 'flex';
  if (itemsCountDisplay) itemsCountDisplay.textContent = String(cart.length);
  if (itemsQtyDisplay) itemsQtyDisplay.textContent = String(totalUnits);
  if (subtotalDisplay) subtotalDisplay.textContent = formatMoney(subtotal);
  document.getElementById('cart-total-display').textContent = formatMoney(finalTotal);
}

document.getElementById('pos-discount')?.addEventListener('change', renderCart);

window.removeFromCart = function(index) {
  cart.splice(index, 1);
  renderCart();
}

window.updateCartQty = function(index, delta) {
  const item = cart[index];
  const product = allProductsCache.find(p => p.id === item.product_id);
  const newQty = item.quantity + delta;

  if (newQty <= 0) {
    removeFromCart(index);
    return;
  }

  if (product && product.stock !== undefined && product.stock < newQty) {
    return showToast('No hay más stock disponible', 'error');
  }

  item.quantity = newQty;
  renderCart();
};

document.getElementById('btn-finalize-sale').addEventListener('click', async () => {
  if (cart.length === 0) return showToast('El carrito está vacío', 'error');
  
  const userSel = document.getElementById('sale-user-modal');
  const userId = (userSel && userSel.value) ? parseInt(userSel.value) : null;
  const paymentMethod = document.getElementById('pos-payment-method').value;
  const discountId = document.getElementById('pos-discount').value;

  // Enviar carrito completo como una sola orden
  const body = { 
    items: cart.map(i => ({ product_id: i.product_id, quantity: i.quantity })), 
    user_id: userId,
    payment_method: paymentMethod,
    discount_id: discountId || null
  };
  const res = await api('/sales', { method: 'POST', body: JSON.stringify(body) });

  if (res.error) return showToast(res.error, 'error');

  cart = [];
  renderCart();
  document.getElementById('pos-modal').classList.add('hidden');
  await loadSales();
  await loadDashboard();
  showToast('Venta registrada correctamente', 'success');
});

// Abrir/Cerrar Modal POS
document.getElementById('open-pos-btn').addEventListener('click', async () => {
  await refreshProductsCache();
  // Cargar descuentos
  allDiscountsCache = await api('/settings/discounts');
  const dscSel = document.getElementById('pos-discount');
  if (dscSel) {
    dscSel.innerHTML = '<option value="">Sin descuento</option>';
    allDiscountsCache.forEach(d => {
      dscSel.innerHTML += `<option value="${d.id}">${d.name} (${d.percentage}%)</option>`;
    });
  }

  await loadProducts(); // Recargar grid dentro del modal
  // Cargar usuarios en el select del modal si es admin
  const userSel = document.getElementById('sale-user-modal');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (userSel && userHasRole(user, 'admin')) {
    try {
      const users = await api('/users');
      userSel.innerHTML = '<option value="">-- Vendedor actual --</option>';
      users.forEach(u => { const opt = document.createElement('option'); opt.value = u.id; opt.textContent = u.username; userSel.appendChild(opt); });
    } catch(e){}
  }
  document.getElementById('pos-modal').classList.remove('hidden');
  
  // Foco en el buscador
  const searchInput = document.getElementById('pos-search');
  if (searchInput) {
    searchInput.value = '';
    setTimeout(() => searchInput.focus(), 100);
  }
  renderCart();
});

document.getElementById('pos-search')?.addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const cards = document.querySelectorAll('#pos-grid-modal .pos-card');
  cards.forEach(card => {
    const title = card.querySelector('.pos-title').textContent.toLowerCase();
    card.style.display = title.includes(term) ? '' : 'none';
  });
});

document.getElementById('close-pos').addEventListener('click', () => {
  document.getElementById('pos-modal').classList.add('hidden');
});

// Modal Entrada Rápida
document.getElementById('open-quick-ticket-btn').addEventListener('click', async () => {
  const userSel = document.getElementById('quick-ticket-user');
  await populateTicketUserSelect(userSel);
  updateQuickTicketPrice();
  document.getElementById('quick-ticket-modal').classList.remove('hidden');
});

function updateQuickTicketPrice() {
  const type = document.getElementById('quick-ticket-type')?.value || 'anticipada';
  const output = document.getElementById('quick-ticket-price');
  if (output) output.textContent = `Valor unitario: ${formatMoney(ticketPrice(type))}`;
}

document.getElementById('quick-ticket-type')?.addEventListener('change', updateQuickTicketPrice);

document.getElementById('quick-ticket-cancel').addEventListener('click', () => {
  document.getElementById('quick-ticket-modal').classList.add('hidden');
});

document.getElementById('quick-ticket-confirm').addEventListener('click', async () => {
  const firstName = document.getElementById('quick-ticket-firstname').value.trim();
  const lastName = document.getElementById('quick-ticket-lastname').value.trim();
  const dni = document.getElementById('quick-ticket-dni').value.trim();
  const payment = document.getElementById('quick-ticket-payment').value;
  const type = document.getElementById('quick-ticket-type').value;
  const userId = document.getElementById('quick-ticket-user').value;
  const qty = parseInt(document.getElementById('quick-ticket-qty').value) || 1;

  if (!firstName || !lastName || !dni || !payment || !type || !userId) {
    showToast('Completa todos los campos', 'error');
    return;
  }

  if (qty < 1) {
    showToast('La cantidad debe ser al menos 1', 'error');
    return;
  }

  try {
    const res = await api('/tickets', {
      method: 'POST',
      body: JSON.stringify({
        first_name: firstName, last_name: lastName, dni,
        payment_method: payment, ticket_type: type, user_id: userId, quantity: qty
      })
    });
    if (res.error) return showToast(res.error, 'error');
    const successCount = res.quantity || 0;
    
    if (successCount > 0) {
      showToast(`${successCount} entrada(s) agregada(s) correctamente`, 'success');
      document.getElementById('quick-ticket-modal').classList.add('hidden');
      await loadTickets(); // Esperar a que cargue la lista actualizada
      
      // Limpiar formulario
      document.getElementById('quick-ticket-firstname').value = '';
      document.getElementById('quick-ticket-lastname').value = '';
      document.getElementById('quick-ticket-dni').value = '';
      document.getElementById('quick-ticket-qty').value = 1;
      if (type === 'anticipada') {
        try {
          await printTicketPdf(res.tickets.map(ticket => ticket.id));
        } catch (error) {
          showToast('La venta quedó registrada, pero no se pudo imprimir el PDF: ' + error.message, 'error');
        }
      }
    } else {
      showToast('Error al agregar entradas', 'error');
    }
  } catch (err) {
    showToast('Error al agregar entrada', 'error');
  }
});

// --- REPORTES PROFESIONALES ---
let currentReportData = [];
let activeReportType = null;
let currentReportTitle = '';

// Inyectar estilos y estructura nueva para reportes al iniciar
(function initReportsUI() {
  // Aplicar estilos
  const style = document.createElement('style');
  style.textContent = `
    .btn-rep { background: #ffffff; border: 1px solid rgba(15,23,42,0.12); color: #000000; padding: 12px 16px; border-radius: 8px; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-rep:hover { border-color: var(--accent); background: rgba(255,107,53,0.05); color: var(--accent); }
    .btn-rep.active { background: var(--accent); color: #08101b; border-color: var(--accent); }
    .btn-rep { justify-content: center; }
  `;
  document.head.appendChild(style);

  // Cargar eventos de botones
  setTimeout(() => {
    document.getElementById('btn-rep-sales-detail')?.addEventListener('click', () => { activeReportType = 'sales-detail'; loadReport('sales-detail'); });
    document.getElementById('btn-rep-tickets-detail')?.addEventListener('click', () => { activeReportType = 'tickets-detail'; loadReport('tickets-detail'); });
    document.getElementById('btn-rep-attendance')?.addEventListener('click', () => { activeReportType = 'attendance'; loadReport('attendance'); });
    document.getElementById('btn-rep-sales-recon')?.addEventListener('click', () => { activeReportType = 'sales-recon'; loadReport('sales-recon'); });
    document.getElementById('btn-rep-tickets-recon')?.addEventListener('click', () => { activeReportType = 'tickets-recon'; loadReport('tickets-recon'); });
    document.getElementById('btn-rep-expenses-detail')?.addEventListener('click', () => { activeReportType = 'expenses-detail'; loadReport('expenses-detail'); });
    document.getElementById('btn-export')?.addEventListener('click', exportReport);
  }, 100);
})();

async function loadReport(type) {
  // UI Updates
  document.querySelectorAll('.btn-rep').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-rep-${type}`)?.classList.add('active');
  const output = document.getElementById('report-output');
  output.innerHTML = '<div style="padding:20px;text-align:center">Cargando...</div>';
  document.getElementById('rep-empty-state').style.display = 'none';

  let endpoint = '';
  let renderFn = null;
  let title = '';

  // Obtener filtros de fecha
  const startDate = document.getElementById('r-start')?.value || '';
  const endDate = document.getElementById('r-end')?.value || '';
  const params = new URLSearchParams();
  if (startDate) params.append('start', startDate);
  if (endDate) params.append('end', endDate);
  const queryStr = params.toString();

  if (type === 'sales-detail') {
    currentReportTitle = 'Reporte de Ventas de Productos';
    endpoint = '/reports/sales-detail' + (queryStr ? '?' + queryStr : '');
    title = 'Reporte Integral de Ventas de Productos';
    renderFn = (rows) => {
      const totalVentas = rows.reduce((sum, r) => sum + parseFloat(r.subtotal || 0), 0);
      const totalGanancia = rows.reduce((sum, r) => sum + parseFloat(r.ganancia || 0), 0);
      const totalCant = rows.reduce((sum, r) => sum + parseInt(r.cantidad || 0), 0);

      return '<tr><th>Fecha/Hora</th><th>Orden</th><th>Vendedor</th><th>Pago</th><th>Producto</th><th>Cant.</th><th>Costo Unit.</th><th>P. Unitario</th><th>Desc. %</th><th>Motivo</th><th>Subtotal</th><th>Ganancia</th></tr>' +
      rows.map(r => `
        <tr>
          <td>${r.fecha}</td>
          <td>#${r.orden_id}</td>
          <td>${r.vendedor || 'N/A'}</td>
          <td>${r.metodo_pago === 'mercadopago' ? '📱 MP' : '💵 Efec'}</td>
          <td style="font-weight:600">${r.producto}</td>
          <td>${r.cantidad}</td>
          <td style="color:#6b7280">${formatMoney(r.costo_unitario)}</td>
          <td>${formatMoney(r.precio_unitario)}</td>
          <td style="text-align:center">${r.descuento_porcentaje}%</td>
          <td style="font-size:12px">${r.descuento_detalle}</td>
          <td style="font-weight:600">${formatMoney(r.subtotal)}</td>
          <td style="font-weight:600;color:#10b981">${formatMoney(r.ganancia)}</td>
        </tr>`).join('') + 
      `<tr style="background:rgba(15,23,42,0.05);font-weight:700">
        <td colspan="5" style="text-align:right">TOTALES:</td>
        <td>${totalCant}</td>
        <td colspan="4"></td>
        <td>${formatMoney(totalVentas)}</td>
        <td style="color:#10b981">${formatMoney(totalGanancia)}</td>
      </tr>`;
    };
  } else if (type === 'tickets-detail') {
    currentReportTitle = 'Reporte de Ventas de Entradas';
    endpoint = '/reports/tickets-detail' + (queryStr ? '?' + queryStr : '');
    title = 'Reporte Integral de Ventas de Entradas';
    renderFn = (rows) => {
      const totalRecaudado = rows.reduce((sum, r) => sum + ticketPrice(r.ticket_type, r), 0);
      return '<tr><th>Fecha/Hora</th><th>Vendedor</th><th>Cliente (Nombre y DNI)</th><th>Tipo Entrada</th><th>Método Pago</th><th>Precio</th><th>Estado Ingreso</th></tr>' +
      rows.map(r => {
        const pm = r.payment_method === 'mercadopago' ? '📱 MercadoPago' : '💵 Efectivo';
        const tt = ticketTypeLabel(r.ticket_type);
        const price = ticketPrice(r.ticket_type, r);
        const ing = r.entered ? '<span style="color:#10b981;font-weight:bold">✓ INGRESÓ</span>' : '<span style="color:#6b7280">NO INGRESÓ</span>';
        return `
          <tr>
            <td>${r.fecha}</td>
            <td>${r.vendedor || 'N/A'}</td>
            <td>${r.first_name} ${r.last_name} <br><small style="color:var(--muted)">DNI: ${r.dni}</small></td>
            <td>${tt}</td>
            <td>${pm}</td>
            <td style="font-weight:600">${formatMoney(price)}</td>
            <td>${ing}</td>
          </tr>`;
      }).join('') + 
      `<tr style="background:rgba(15,23,42,0.05);font-weight:700">
        <td colspan="5" style="text-align:right">TOTAL RECAUDADO:</td>
        <td colspan="2" style="color:#10b981">${formatMoney(totalRecaudado)}</td>
      </tr>`;
    };
  } else if (type === 'attendance') {
    currentReportTitle = 'Resumen de Asistencia';
    endpoint = '/reports/attendance-summary' + (queryStr ? '?' + queryStr : '');
    title = 'Resumen de Asistencia y Afluencia';
    renderFn = (rows) => {
      const r = rows[0] || { anticipadas: 0, puerta: 0, cortesias: 0, total: 0 };
      return `
        <thead>
          <tr style="background:rgba(15,23,42,0.05)">
            <th style="padding:12px;text-align:left">Categoría de Ingreso (Personas adentro)</th>
            <th style="padding:12px;text-align:center">Cantidad</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08)">🎟️ Entradas Anticipadas (Ingresadas)</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:center;font-weight:700;font-size:18px">${r.anticipadas}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08)">🚪 Entradas de Puerta (Ingresadas)</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:center;font-weight:700;font-size:18px">${r.puerta}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08)">🎁 Entradas de Cortesía (Ingresadas)</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:center;font-weight:700;font-size:18px">${r.cortesias}</td>
          </tr>
          <tr style="background:rgba(16,185,129,0.1);font-weight:800;font-size:20px">
            <td style="padding:16px;text-align:right">TOTAL ASISTENTES ACTUALES:</td>
            <td style="padding:16px;text-align:center;color:#059669">${r.total}</td>
          </tr>
        </tbody>`;
    };
  } else if (type === 'sales-recon' || type === 'tickets-recon') {
    const isTickets = type === 'tickets-recon';
    currentReportTitle = isTickets ? 'Arqueo Caja Entradas' : 'Arqueo Caja Productos';
    endpoint = (isTickets ? '/reports/tickets-by-payment' : '/reports/sales-by-payment') + (queryStr ? '?' + queryStr : '');
    title = isTickets ? 'Arqueo de Caja: Entradas Vendidas' : 'Arqueo de Caja: Ventas de Productos';
    renderFn = (rows) => {
      const totalGral = rows.reduce((sum, r) => sum + parseFloat(r.total_revenue || 0), 0);
      const cash = rows.find(r => r.payment_method === 'cash') || { total_revenue: 0, total_count: 0, total_items_sold: 0 };
      const mp = rows.find(r => r.payment_method === 'mercadopago') || { total_revenue: 0, total_count: 0, total_items_sold: 0 };
      
      return `
        <thead>
          <tr style="background:rgba(15,23,42,0.05)">
            <th style="padding:12px;text-align:left">Método de Pago</th>
            <th style="padding:12px;text-align:center">${isTickets ? 'Cant. Entradas' : 'Cant. Productos'}</th>
            <th style="padding:12px;text-align:right">Total Recaudado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08)">💵 Efectivo</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:center">${isTickets ? cash.total_count : cash.total_items_sold}</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:right;font-weight:600">${formatMoney(cash.total_revenue)}</td>
          </tr>
          <tr>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08)">📱 MercadoPago</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:center">${isTickets ? mp.total_count : mp.total_items_sold}</td>
            <td style="padding:12px;border-bottom:1px solid rgba(15,23,42,0.08);text-align:right;font-weight:600">${formatMoney(mp.total_revenue)}</td>
          </tr>
          <tr style="background:rgba(255,107,53,0.1);font-weight:800;font-size:18px">
            <td colspan="2" style="padding:16px;text-align:right">TOTAL GENERAL:</td>
            <td style="padding:16px;text-align:right;color:var(--accent)">${formatMoney(totalGral)}</td>
          </tr>
        </tbody>`;
    };
  } else if (type === 'expenses-detail') {
    currentReportTitle = 'Reporte de Gastos';
    endpoint = '/reports/expenses-detail' + (queryStr ? '?' + queryStr : '');
    title = 'Detalle de gastos';
    renderFn = (rows) => {
      const total = rows.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      const totalPendiente = rows.reduce((sum, r) => sum + (r.status === 'pending' ? parseFloat(r.amount || 0) : 0), 0);
      
      return '<tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th><th>Responsable</th><th>Pago</th><th>Estado</th><th>Importe</th></tr>' +
      rows.map(r => {
        const responsible = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username || 'Sin asignar';
        const estado = r.status === 'paid' ? '<span style="color:#10b981;font-weight:bold">PAGADO</span>' : '<span style="color:#f59e0b;font-weight:bold">PENDIENTE</span>';
        return `
          <tr>
            <td>${r.fecha}</td>
            <td style="font-weight:600">${escapeUserText(r.description)}</td>
            <td>${escapeUserText(r.category)}</td>
            <td>${escapeUserText(r.supplier || '-')}</td>
            <td>${escapeUserText(responsible)}</td>
            <td>${expensePaymentLabel(r.payment_method)}</td>
            <td>${estado}</td>
            <td style="font-weight:700;text-align:right">${formatMoney(r.amount)}</td>
          </tr>`;
      }).join('') + 
      `<tr style="background:rgba(15,23,42,0.05);font-weight:700">
        <td colspan="7" style="text-align:right">TOTAL REGISTRADO:</td>
        <td style="color:var(--accent);text-align:right">${formatMoney(total)}</td>
      </tr>
      <tr style="background:rgba(245,158,11,0.08);font-weight:700">
        <td colspan="7" style="text-align:right">TOTAL PENDIENTE:</td>
        <td style="color:#b45309;text-align:right">${formatMoney(totalPendiente)}</td>
      </tr>`;
    };
  }

  document.getElementById('rep-title').textContent = title;
  try {
    const rows = await api(endpoint);
    
    if (rows.error) throw new Error(rows.error);
    if (!Array.isArray(rows)) throw new Error('Formato de datos inválido');

    document.getElementById('rep-results-area').style.display = 'block';
    currentReportData = rows; // Guardar para exportar

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;background:#fff;font-size:14px';
    table.innerHTML = renderFn(rows);
    output.innerHTML = '';
    if (rows.length === 0) output.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted)">No hay datos para este rango.</div>';
    else output.appendChild(table);
    enhanceResponsiveTables(output);
  } catch (e) {
    document.getElementById('rep-results-area').style.display = 'none';
    output.innerHTML = '<div style="padding:20px;text-align:center;color:#ef4444">Error al cargar el reporte: ' + e.message + '</div>';
  }
}

function exportReport() {
  if (!currentReportData || !currentReportData.length) return showToast('No hay datos para exportar', 'error');
  
  const format = document.getElementById('export-format').value;
  const filename = `${currentReportTitle || 'reporte'}_${new Date().toISOString().slice(0,10)}.${format}`;

  // Mapeo y traducción de datos según el reporte activo
  const translatedData = currentReportData.map(r => {
    if (activeReportType === 'sales-detail') {
      return {
        'Fecha/Hora': r.fecha,
        'Orden ID': `#${r.orden_id}`,
        'Vendedor': r.vendedor || 'N/A',
        'Método Pago': r.metodo_pago === 'mercadopago' ? 'MercadoPago' : 'Efectivo',
        'Producto': r.producto,
        'Cantidad': r.cantidad,
        'Costo Unit.': r.costo_unitario,
        'Precio Unit.': r.precio_unitario,
        'Descuento %': r.descuento_porcentaje,
        'Motivo Descuento': r.descuento_detalle,
        'Subtotal': r.subtotal,
        'Ganancia': r.ganancia
      };
    } else if (activeReportType === 'tickets-detail') {
      return {
        'Fecha/Hora': r.fecha,
        'Vendedor': r.vendedor || 'N/A',
        'Nombre': r.first_name,
        'Apellido': r.last_name,
        'DNI': r.dni,
        'Tipo Entrada': ticketTypeLabel(r.ticket_type).replace(/^\S+\s/, ''),
        'Precio': ticketPrice(r.ticket_type, r),
        'Método Pago': r.payment_method === 'mercadopago' ? 'MercadoPago' : 'Efectivo',
        'Ingresó': r.entered ? 'SI' : 'NO'
      };
    } else if (activeReportType === 'attendance') {
      return {
        'Anticipadas Ingresadas': r.anticipadas,
        'Puerta Ingresadas': r.puerta,
        'Cortesías Ingresadas': r.cortesias,
        'Total Asistentes': r.total
      };
    } else if (activeReportType === 'sales-recon' || activeReportType === 'tickets-recon') {
      return {
        'Método de Pago': r.payment_method === 'mercadopago' ? 'MercadoPago' : 'Efectivo',
        'Cantidad Operaciones': r.total_count,
        'Items/Entradas Vendidas': r.total_items_sold || r.total_count,
        'Recaudación Total': r.total_revenue
      };
    } else if (activeReportType === 'expenses-detail') {
      const responsible = [r.first_name, r.last_name].filter(Boolean).join(' ') || r.username || 'Sin asignar';
      return {
        'Fecha': r.fecha,
        'Descripción': r.description,
        'Categoría': r.category,
        'Proveedor': r.supplier || '-',
        'Responsable': responsible,
        'Medio de pago': expensePaymentLabel(r.payment_method),
        'Estado': r.status === 'paid' ? 'Pagado' : 'Pendiente',
        'Importe': r.amount
      };
    }
    return r;
  });
  
  if (!translatedData || translatedData.length === 0) return showToast('No hay datos procesados para exportar', 'error');

  if (format === 'csv') {
    // Exportar como CSV
    const headers = Object.keys(translatedData[0]);
    const csvRows = [];
    csvRows.push(headers.join(','));
    for (const row of translatedData) {
      const values = headers.map(header => {
        const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }
    const csvString = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else if (format === 'xlsx') {
    // Exportar como Excel
    const ws = XLSX.utils.json_to_sheet(translatedData);
    
    // Ajuste básico de ancho de columnas
    const wscols = Object.keys(translatedData[0]).map(() => ({ wch: 20 }));
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
    XLSX.writeFile(wb, filename);
  }
  
  showToast('Reporte exportado correctamente', 'success');
}

async function loadUsersSelect(){
  // only for admin (to assign sales to a user)
  try {
    const users = await api('/users');
    const sel = document.getElementById('sale-user');
    if (!sel) return;
    sel.innerHTML = '';
    users.forEach(u => { const opt = document.createElement('option'); opt.value = u.id; opt.textContent = u.username; sel.appendChild(opt); });
  } catch (e) {
    // ignore
  }
}

let dashboardChart = null;
let dashboardLoading = false;
const DASHBOARD_REFRESH_INTERVAL_MS = 10000;

function operationLabel(value) {
  const count = Number(value || 0);
  return `${count} ${count === 1 ? 'operación' : 'operaciones'}`;
}

function renderLowStockItems(items) {
  const container = document.getElementById('low-stock-list');
  if (!container) return;
  container.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:24px;text-align:center;color:var(--muted);background:#f8fafc;border-radius:10px';
    empty.textContent = 'No hay productos con stock bajo.';
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 14px;margin-bottom:8px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px';
    const name = document.createElement('span');
    name.style.cssText = 'font-weight:600;color:#374151';
    name.textContent = item.name;
    const stock = document.createElement('strong');
    stock.style.cssText = 'min-width:38px;text-align:center;padding:4px 8px;border-radius:999px;background:#ef4444;color:#fff';
    stock.textContent = Number(item.stock || 0);
    row.append(name, stock);
    container.appendChild(row);
  });
}

async function loadDashboard(){
  if (dashboardLoading || !getActiveEventId()) return;
  dashboardLoading = true;
  try {
    const stats = await api('/reports/dashboard-stats');
    if (!stats || stats.error) {
      console.error('Dashboard error:', stats?.error || 'Respuesta inválida');
      return;
    }

    const paymentIncome = stats.payment_income || {};
    const cash = paymentIncome.cash || {};
    const mercadoPago = paymentIncome.mercadopago || {};
    document.getElementById('dash-people-entered').textContent = Number(stats.people_entered || 0);
    document.getElementById('dash-income-cash').textContent = formatMoney(cash.amount || 0);
    document.getElementById('dash-income-cash-count').textContent = operationLabel(cash.operations);
    document.getElementById('dash-income-mercadopago').textContent = formatMoney(mercadoPago.amount || 0);
    document.getElementById('dash-income-mercadopago-count').textContent = operationLabel(mercadoPago.operations);
    document.getElementById('dash-low-stock').textContent = stats.low_stock_count;
    renderLowStockItems(stats.low_stock_items);

    const ctx = document.getElementById('topProductsChart');
    if (ctx) {
      const chartLabels = stats.top_products.map(product => product.name);
      const chartValues = stats.top_products.map(product => product.total_qty);
      if (dashboardChart) {
        dashboardChart.data.labels = chartLabels;
        dashboardChart.data.datasets[0].data = chartValues;
        dashboardChart.update('none');
      } else dashboardChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartLabels,
          datasets: [{
            label: 'Unidades',
            data: chartValues,
            backgroundColor: ['#ff6b35', '#ffd166', '#06d6a0', '#118ab2', '#ef476f'],
            borderWidth: 0,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#000000' }, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { ticks: { color: '#000000' }, grid: { display: false } }
          }
        }
      });
    }
    const updatedAt = document.getElementById('dashboard-last-update');
    if (updatedAt) {
      updatedAt.textContent = `Actualizado: ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    }
  } catch (e) {
    console.error("Error cargando dashboard", e);
  } finally {
    dashboardLoading = false;
  }
}

setInterval(() => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const activePage = location.hash.replace('#', '') || 'dashboard';
  if (user && activePage === 'dashboard' && document.visibilityState === 'visible') loadDashboard();
}, DASHBOARD_REFRESH_INTERVAL_MS);

// --- Settings and users management ---
async function loadSettings(){
  try {
    const cfg = await api('/settings');
    if (!cfg || cfg.error) {
      if (cfg?.error) showToast(cfg.error, 'error');
      return;
    }
    
    // Actualizar campos en el modal de configuración
    document.getElementById('cfg-cuit').value = cfg.cuit || '';
    document.getElementById('cfg-company-name').value = cfg.company_name || '';
    document.getElementById('cfg-address').value = cfg.address || '';
    document.getElementById('cfg-phone').value = cfg.phone || '';
    document.getElementById('cfg-email').value = cfg.email || '';
    document.getElementById('cfg-ticket-price-advance').value = Number(cfg.ticket_price_advance || 0);
    document.getElementById('cfg-ticket-price-door').value = Number(cfg.ticket_price_door || 0);
    const eventAdvanceInput = document.getElementById('event-price-advance');
    const eventDoorInput = document.getElementById('event-price-door');
    if (eventAdvanceInput && !eventAdvanceInput.value) eventAdvanceInput.value = Number(cfg.ticket_price_advance || 0);
    if (eventDoorInput && !eventDoorInput.value) eventDoorInput.value = Number(cfg.ticket_price_door || 0);
    ticketSettings = Object.assign({}, ticketSettings, cfg);
    updateQuickTicketPrice();
    
    const logo = cfg.logo_path || '';
    const name = cfg.company_name || 'Mi Empresa';
    
    const img = document.getElementById('logo-preview');
    if (logo) { img.src = assetUrl(logo); img.style.display = 'block'; } else { img.style.display = 'none'; }
    applyCompanyBranding({ company_name: name, logo_path: logo });

  } catch (e) {
    console.error(e);
  }
}

async function loadDiscountsForMgmt() {
  const dscs = await api('/settings/discounts');
  const tbody = document.getElementById('discounts-body');
  if (!tbody) return;
  if (!Array.isArray(dscs)) {
    tbody.innerHTML = '<tr><td colspan="3" style="padding:12px;color:#ef4444">No se pudieron cargar los descuentos.</td></tr>';
    return;
  }
  tbody.innerHTML = dscs.map(d => `
    <tr style="border-bottom:1px solid rgba(15,23,42,0.08)">
      <td style="padding:12px">${d.name}</td>
      <td style="padding:12px;text-align:center;font-weight:700">${d.percentage}%</td>
      <td style="padding:12px;text-align:right">
        <button onclick="deleteDiscount(${d.id})" style="padding:6px 12px;background:#ef4444;color:white;border:none;border-radius:6px;cursor:pointer">Borrar</button>
      </td>
    </tr>
  `).join('');
  enhanceResponsiveTables(tbody.closest('.table-wrap') || document);
}

window.deleteDiscount = async (id) => {
  if (!confirm('¿Eliminar este tipo de descuento?')) return;
  await api('/settings/discounts/' + id, { method: 'DELETE' });
  loadDiscountsForMgmt();
};

document.getElementById('add-dsc-btn')?.addEventListener('click', async () => {
  const name = document.getElementById('dsc-name').value.trim();
  const percentage = document.getElementById('dsc-pct').value;
  if (!name || !percentage) return showToast('Completa ambos campos', 'error');
  await api('/settings/discounts', { method: 'POST', body: JSON.stringify({ name, percentage }) });
  document.getElementById('dsc-name').value = ''; document.getElementById('dsc-pct').value = '';
  loadDiscountsForMgmt();
});

document.getElementById('save-cfg').addEventListener('click', async () => {
  const cuit = document.getElementById('cfg-cuit').value;
  const company_name = document.getElementById('cfg-company-name').value;
  const address = document.getElementById('cfg-address').value;
  const phone = document.getElementById('cfg-phone').value;
  const email = document.getElementById('cfg-email').value;
  const ticket_price_advance = Number(document.getElementById('cfg-ticket-price-advance').value);
  const ticket_price_door = Number(document.getElementById('cfg-ticket-price-door').value);
  if (!company_name || !Number.isFinite(ticket_price_advance) || ticket_price_advance < 0 ||
      !Number.isFinite(ticket_price_door) || ticket_price_door < 0) {
    return showToast('Ingresá un nombre y precios válidos', 'error');
  }
  
  const result = await api('/settings', {
    method: 'PUT',
    body: JSON.stringify({
      cuit, company_name, address, phone, email,
      ticket_price_advance, ticket_price_door
    })
  });
  if (result.error) return showToast(result.error, 'error');
  await loadSettings();
  showToast('Configuración guardada', 'success');
});

document.getElementById('save-ticket-prices')?.addEventListener('click', () => {
  document.getElementById('save-cfg').click();
});

document.getElementById('upload-logo').addEventListener('click', async () => {
  const fileEl = document.getElementById('logo-file');
  if (!fileEl.files.length) return showToast('Seleccioná un archivo', 'error');
  const file = fileEl.files[0];
  if (file.size > 5 * 1024 * 1024) return showToast('El logo es muy pesado (máximo 5MB)', 'error');

  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result;
    const base = dataUrl.split(',')[1];
    const data = await api('/settings/logo', { 
      method: 'POST', 
      body: JSON.stringify({ filename: file.name, data: base }) 
    });

    if (data && data.logo_path) {
      document.getElementById('logo-preview').src = data.logo_path;
      document.getElementById('logo-preview').style.display = 'block';
      showToast('Logo subido', 'success');
    } else {
      showToast(data.error || 'Error al subir logo', 'error');
    }
  };
  reader.readAsDataURL(file);
});

async function loadUsersForMgmt(){
  try {
    const users = await api('/users');
    const grid = document.getElementById('users-grid');
    const count = document.getElementById('users-count');
    if (!grid || !Array.isArray(users)) return;

    if (count) count.textContent = `${users.length} ${users.length === 1 ? 'usuario' : 'usuarios'}`;
    grid.innerHTML = users.length ? users.map(u => {
      const safeUsername = escapeUserText(u.username);
      const fullName = [u.first_name, u.last_name].map(value => String(value || '').trim()).filter(Boolean).join(' ');
      const safeFullName = escapeUserText(fullName || u.username);
      const roles = getUserRoles(u);
      const safeRoles = roles.length ? roles : ['seller'];
      const roleLabels = safeRoles.map(role => ROLE_LABELS[role]);
      const roleBadges = safeRoles.map(role => `<span class="user-role-badge user-role-${role}">${ROLE_LABELS[role]}</span>`).join('');
      const initials = fullName
        ? fullName.split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('')
        : String(u.username || '?').charAt(0);
      const safeInitials = escapeUserText(initials || '?');
      return `
        <article class="user-card">
          <div class="user-card-top">
            <div class="user-avatar" aria-hidden="true">${safeInitials}</div>
            <div class="user-card-identity">
              <h4 class="user-card-name" title="${safeFullName}">${safeFullName}</h4>
              <p class="user-card-access"><span aria-hidden="true"></span> @${safeUsername}</p>
            </div>
            <div class="user-role-badges">${roleBadges}</div>
          </div>
          <div class="user-card-details">
            <span>${safeRoles.length === 1 ? 'Rol asignado' : 'Roles asignados'}</span>
            <strong>${roleLabels.join(' · ')}</strong>
          </div>
          <div class="user-card-actions">
            <button class="user-card-button user-card-edit edit-user" data-id="${u.id}" type="button">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              Editar usuario
            </button>
            <button class="user-card-button user-card-delete del-user" data-id="${u.id}" type="button" aria-label="Eliminar a ${safeUsername}" title="Eliminar usuario">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5M14 11v5"/></svg>
            </button>
          </div>
        </article>`;
    }).join('') : '<div class="users-empty">Todavía no hay usuarios para mostrar.</div>';

    grid.querySelectorAll('.del-user').forEach(b => b.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      showConfirm('¿Confirmar borrado del usuario?', async () => {
        try {
          const result = await api('/users/' + id, { method: 'DELETE' });
          if (result?.error) throw new Error(result.error);
          showToast('Usuario eliminado correctamente', 'success');
          await loadUsersForMgmt();
          await loadUsersSelect();
        } catch (e) {
          console.error(e);
          showToast('Error al eliminar usuario', 'error');
        }
      });
    }));
    grid.querySelectorAll('.edit-user').forEach(b => b.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const user = users.find(u => u.id == id);
      if (!user) return;
      openUserModal(user);
    }));
  } catch (e) { console.error(e); }
}

function escapeUserText(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[char]);
}

function openUserModal(user = null) {
  const modal = document.getElementById('user-modal');
  const form = document.getElementById('user-form');
  const submit = document.getElementById('create-user');
  const password = document.getElementById('user-password');
  const editing = Boolean(user);
  form.reset();
  if (editing) {
    document.getElementById('user-first-name').value = user.first_name || '';
    document.getElementById('user-last-name').value = user.last_name || '';
    document.getElementById('user-username').value = user.username;
    const selectedRoles = getUserRoles(user);
    document.querySelectorAll('input[name="user-roles"]').forEach(input => {
      input.checked = selectedRoles.includes(input.value);
    });
    submit.dataset.editId = user.id;
  } else {
    delete submit.dataset.editId;
  }
  password.required = !editing;
  password.placeholder = editing ? 'Dejar vacía para conservar la actual' : 'Ingresá una contraseña';
  document.getElementById('user-password-help').textContent = editing
    ? 'Opcional: completala solamente si querés cambiarla.'
    : 'Obligatoria para crear un usuario nuevo.';
  document.getElementById('user-modal-title').textContent = editing ? 'Editar usuario' : 'Crear usuario';
  document.getElementById('user-modal-subtitle').textContent = editing
    ? 'Actualizá sus datos de acceso y permisos.'
    : 'Completá los datos para dar acceso a una persona.';
  submit.textContent = editing ? 'Guardar cambios' : 'Crear usuario';
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('user-first-name').focus(), 0);
}

function closeUserModal() {
  const modal = document.getElementById('user-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

document.getElementById('open-user-modal')?.addEventListener('click', () => openUserModal());
document.getElementById('close-user-modal')?.addEventListener('click', closeUserModal);
document.getElementById('cancel-user-modal')?.addEventListener('click', closeUserModal);
document.getElementById('user-modal')?.addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeUserModal();
});
async function closeAllOpenPopups() {
  const scannerWasOpen = !document.getElementById('qr-scanner-modal')?.classList.contains('hidden');
  closeAdminApprovalModal(null);
  closeDeleteTicketModal();
  closeUserModal();
  document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.context-menu:not(.hidden)').forEach(menu => menu.classList.add('hidden'));
  closeSidebar();
  if (scannerWasOpen) await stopQrScanner();
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  closeAllOpenPopups().catch(error => console.error('No se pudieron cerrar todos los formularios', error));
});

document.getElementById('user-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const firstName = document.getElementById('user-first-name').value.trim();
  const lastName = document.getElementById('user-last-name').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const password = document.getElementById('user-password').value;
  const roles = Array.from(document.querySelectorAll('input[name="user-roles"]:checked')).map(input => input.value);
  const editId = document.getElementById('create-user').dataset.editId;
  
  if (!firstName || !lastName) return showToast('El nombre y el apellido son requeridos', 'error');
  if (!username) return showToast('El usuario para iniciar sesión es requerido', 'error');
  if (!editId && !password) return showToast('La contraseña es requerida para usuarios nuevos', 'error');
  if (!roles.length) return showToast('Seleccioná al menos un rol', 'error');

  const action = editId ? 'actualizar' : 'crear';
  const message = `¿Confirmar ${action} el usuario "${username}"?`;

  showConfirm(message, async () => {
    try {
      if (editId) {
        const body = { first_name: firstName, last_name: lastName, username, roles };
        if (password) body.password = password;
        const result = await api('/users/' + editId, { method: 'PUT', body: JSON.stringify(body) });
        if (result?.error) throw new Error(result.error);
        showToast('Usuario actualizado correctamente', 'success');
      } else {
        const result = await api('/users', {
          method: 'POST',
          body: JSON.stringify({ first_name: firstName, last_name: lastName, username, password, roles })
        });
        if (result?.error) throw new Error(result.error);
        showToast('Usuario creado correctamente', 'success');
      }
      closeUserModal();
      await loadUsersForMgmt(); await loadUsersSelect();
    } catch (e) {
      console.error(e);
      showToast(e.message || ('Error al ' + action + ' usuario'), 'error');
    }
  });
});

// Extend initAfterLogin to load settings and users management
async function initAfterLogin(){
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!user) return;
  showAppForUser(user);
  await loadEvents();
  if (!getActiveEventId()) {
    showToast('Cree o seleccione un evento para comenzar', 'error');
    location.hash = userHasRole(user, 'admin') ? '#config' : '#' + getDefaultPage(user);
    navigateToHash();
    return;
  }
  await loadSettings();
  if (userHasRole(user, 'admin')) {
    await loadProducts();
    await loadSales();
    await loadUsersSelect();
    await loadDashboard();
    await loadUsersForMgmt();
    await loadDiscountsForMgmt();
  } else {
    if (userHasRole(user, 'seller')) {
      await loadProducts();
      await loadSales();
    }
    if (userHasRole(user, 'puerta')) await loadTickets();
  }
  navigateToHash();
}

// --- simple client-side navigation (hash-based) ---
function showPage(id){
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (!userCanAccessPage(user, id)) id = getDefaultPage(user);
  // hide others
  document.querySelectorAll('.page').forEach(p => {
    if (p.id === 'page-' + id) return;
    p.classList.remove('show');
    p.classList.add('hidden');
  });
  const el = document.getElementById('page-' + id);
  if (!el) return;
  // reveal with transition
  el.classList.remove('hidden');
  // force reflow then add show
  void el.offsetWidth;
  el.classList.add('show');
  // update active link
  document.querySelectorAll('.sidebar a').forEach(a => a.classList.remove('active'));
  const link = document.querySelector('.sidebar a[href="#' + id + '"]');
  if (link) link.classList.add('active');
  closeSidebar();
  enhanceResponsiveTables(el);
}

function navigateToHash(){
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  let hash = location.hash.replace('#','') || getDefaultPage(user);
  if (!userCanAccessPage(user, hash)) {
    hash = getDefaultPage(user);
    history.replaceState(null, '', '#' + hash);
  }
  // load data for page
  if (hash === 'dashboard') { loadDashboard(); }
  if (hash === 'products') { loadProducts(); }
  if (hash === 'sales') { loadProducts(); loadEvents(); loadSales(); }
  if (hash === 'tickets') { loadTickets(); }
  if (hash === 'partners') { loadExpenses(); }
  if (hash === 'reports') { /* nothing extra */ }
  if (hash === 'config') { loadEvents(); loadSettings(); loadUsersForMgmt(); loadDiscountsForMgmt(); }
  showPage(hash);
}

window.addEventListener('hashchange', navigateToHash);

// wire sidebar nav links
document.addEventListener('click', (e) => {
  const link = e.target.closest('[data-nav]');
  if (link) {
    e.preventDefault();
    closeSidebar();
    const targetHash = link.getAttribute('href') || '#dashboard';
    if (location.hash === targetHash) {
      navigateToHash();
    } else {
      location.hash = targetHash;
      setTimeout(navigateToHash, 0);
    }
  }
});

// after login show app and navigate
async function showAppForUser(user){
  document.getElementById('login-area').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('current-user').textContent = user.username + ' (' + formatUserRoles(user) + ')';
  // hide admin-only elements for non-admins
  if (!userHasRole(user, 'admin')){
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  } else {
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'block');
  }
  document.querySelectorAll('.sidebar a[data-nav]').forEach(link => {
    const menuItem = link.closest('li');
    const page = (link.getAttribute('href') || '').replace('#', '');
    if (menuItem) menuItem.style.display = userCanAccessPage(user, page) ? '' : 'none';
  });
}

// --- Gestión de gastos ---
let expensesCache = [];
const DEFAULT_EXPENSE_CATEGORIES = ['Mercadería e insumos', 'Servicios', 'Logística', 'Mantenimiento', 'Personal', 'Otros'];

function expensePaymentLabel(method) {
  return ({ cash: 'Efectivo', mercadopago: 'MercadoPago', transfer: 'Transferencia' })[method] || method || '-';
}

function expenseResponsible(expense) {
  return [expense.first_name, expense.last_name].filter(Boolean).join(' ') || expense.username || 'Sin asignar';
}

function expenseDateValue(value) {
  return String(value || '').slice(0, 10);
}

function currentLocalDateValue() {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
}

function closeExpenseModal() {
  const modal = document.getElementById('expense-modal');
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

async function populateExpenseUsers(selectedId = '') {
  const select = document.getElementById('expense-user');
  const users = await api('/users');
  if (!select || !Array.isArray(users)) return;
  select.innerHTML = '<option value="">Sin asignar</option>';
  users.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
    option.textContent = fullName ? `${fullName} (@${user.username})` : user.username;
    select.appendChild(option);
  });
  select.value = selectedId ? String(selectedId) : '';
}

async function openExpenseModal(expense = null) {
  const form = document.getElementById('expense-form');
  const modal = document.getElementById('expense-modal');
  if (!form || !modal) return;
  form.reset();
  document.getElementById('expense-id').value = expense?.id || '';
  document.getElementById('expense-modal-title').textContent = expense ? 'Editar gasto' : 'Registrar gasto';
  document.getElementById('expense-save').textContent = expense ? 'Guardar cambios' : 'Guardar gasto';
  document.getElementById('expense-description').value = expense?.description || '';
  document.getElementById('expense-category').value = expense?.category || DEFAULT_EXPENSE_CATEGORIES[0];
  document.getElementById('expense-supplier').value = expense?.supplier || '';
  document.getElementById('expense-amount').value = expense?.amount || '';
  document.getElementById('expense-date').value = expenseDateValue(expense?.expense_date) || currentLocalDateValue();
  document.getElementById('expense-payment-method').value = expense?.payment_method || 'cash';
  document.getElementById('expense-status').value = expense?.status || 'paid';
  await populateExpenseUsers(expense?.user_id || '');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  setTimeout(() => document.getElementById('expense-description')?.focus(), 0);
}

function updateExpenseSummary() {
  const total = expensesCache.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const paid = expensesCache.reduce((sum, expense) => sum + (expense.status === 'paid' ? Number(expense.amount || 0) : 0), 0);
  const pending = total - paid;
  document.getElementById('expense-total').textContent = formatMoney(total);
  document.getElementById('expense-paid').textContent = formatMoney(paid);
  document.getElementById('expense-pending').textContent = formatMoney(pending);
  document.getElementById('expense-count').textContent = String(expensesCache.length);
}

function updateExpenseCategoryFilter() {
  const select = document.getElementById('expense-category-filter');
  if (!select) return;
  const selected = select.value;
  const categories = [...new Set([...DEFAULT_EXPENSE_CATEGORIES, ...expensesCache.map(expense => expense.category).filter(Boolean)])];
  select.innerHTML = '<option value="">Todas</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
  if (categories.includes(selected)) select.value = selected;
}

function renderExpenses() {
  const tbody = document.getElementById('expenses-body');
  if (!tbody) return;
  const search = (document.getElementById('expense-search')?.value || '').trim().toLocaleLowerCase('es');
  const category = document.getElementById('expense-category-filter')?.value || '';
  const status = document.getElementById('expense-status-filter')?.value || '';
  const filtered = expensesCache.filter(expense => {
    const searchable = [expense.description, expense.supplier, expense.category, expenseResponsible(expense)].join(' ').toLocaleLowerCase('es');
    return (!search || searchable.includes(search)) && (!category || expense.category === category) && (!status || expense.status === status);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="expense-empty">${expensesCache.length ? 'No hay gastos que coincidan con los filtros.' : 'Todavía no hay gastos registrados en este evento.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(expense => `
    <tr>
      <td>${escapeUserText(expenseDateValue(expense.expense_date).split('-').reverse().join('/'))}</td>
      <td><strong>${escapeUserText(expense.description)}</strong></td>
      <td><span class="expense-badge expense-category-badge">${escapeUserText(expense.category)}</span></td>
      <td>${escapeUserText(expense.supplier || '-')}</td>
      <td>${escapeUserText(expenseResponsible(expense))}</td>
      <td>${escapeUserText(expensePaymentLabel(expense.payment_method))}</td>
      <td><span class="expense-badge expense-badge-${expense.status === 'paid' ? 'paid' : 'pending'}">${expense.status === 'paid' ? 'Pagado' : 'Pendiente'}</span></td>
      <td class="expense-amount">${formatMoney(expense.amount)}</td>
      <td><div class="expense-actions"><button class="expense-action edit-expense" type="button" data-id="${expense.id}">Editar</button><button class="expense-action expense-action-delete delete-expense" type="button" data-id="${expense.id}">Eliminar</button></div></td>
    </tr>
  `).join('');
  enhanceResponsiveTables(tbody.closest('.table-wrap') || document);
}

async function loadExpenses() {
  const tbody = document.getElementById('expenses-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="9" class="expense-empty">Cargando gastos...</td></tr>';
  const rows = await api('/expenses');
  if (!Array.isArray(rows)) {
    expensesCache = [];
    tbody.innerHTML = `<tr><td colspan="9" class="expense-empty">${escapeUserText(rows?.error || 'No se pudieron cargar los gastos')}</td></tr>`;
    updateExpenseSummary();
    return;
  }
  expensesCache = rows;
  updateExpenseSummary();
  updateExpenseCategoryFilter();
  renderExpenses();
}

document.getElementById('open-expense-modal-btn')?.addEventListener('click', () => openExpenseModal());
document.getElementById('expense-cancel')?.addEventListener('click', closeExpenseModal);
document.getElementById('expense-close')?.addEventListener('click', closeExpenseModal);
document.getElementById('expense-modal')?.addEventListener('click', event => {
  if (event.target === event.currentTarget) closeExpenseModal();
});
document.getElementById('expense-search')?.addEventListener('input', renderExpenses);
document.getElementById('expense-category-filter')?.addEventListener('change', renderExpenses);
document.getElementById('expense-status-filter')?.addEventListener('change', renderExpenses);

document.getElementById('expense-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const id = document.getElementById('expense-id').value;
  const payload = {
    description: document.getElementById('expense-description').value,
    category: document.getElementById('expense-category').value,
    supplier: document.getElementById('expense-supplier').value,
    amount: document.getElementById('expense-amount').value,
    expense_date: document.getElementById('expense-date').value,
    payment_method: document.getElementById('expense-payment-method').value,
    status: document.getElementById('expense-status').value,
    user_id: document.getElementById('expense-user').value
  };
  if (!payload.description.trim() || !payload.category || !payload.amount || !payload.expense_date) {
    return showToast('Completá descripción, categoría, importe y fecha', 'error');
  }
  const result = await api(id ? `/expenses/${id}` : '/expenses', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
  if (result.error) return showToast(result.error, 'error');
  closeExpenseModal();
  showToast(id ? 'Gasto actualizado' : 'Gasto registrado', 'success');
  await loadExpenses();
});

document.getElementById('expenses-body')?.addEventListener('click', event => {
  const editButton = event.target.closest('.edit-expense');
  const deleteButton = event.target.closest('.delete-expense');
  if (editButton) {
    const expense = expensesCache.find(item => Number(item.id) === Number(editButton.dataset.id));
    if (expense) openExpenseModal(expense);
  }
  if (deleteButton) {
    const expense = expensesCache.find(item => Number(item.id) === Number(deleteButton.dataset.id));
    if (!expense) return;
    showConfirm(`¿Eliminar el gasto "${expense.description}"?`, async () => {
      const result = await api(`/expenses/${expense.id}`, { method: 'DELETE' });
      if (result.error) return showToast(result.error, 'error');
      showToast('Gasto eliminado', 'success');
      await loadExpenses();
    });
  }
});

async function loadMySales(){
  const rows = await api('/sales');
  const div = document.getElementById('my-sales-list');
  const table = document.createElement('table');
  table.innerHTML = '<tr><th>ID Venta</th><th>Items</th><th>Pago</th><th>Total</th><th>Fecha</th></tr>' +
    rows.map(r => {
      const pm = r.payment_method === 'mercadopago' ? '📱 MP' : '💵 Efec';
      return `<tr><td>#${r.id}</td><td>${r.items_summary}</td><td>${pm}</td><td>${formatMoney(r.total)}</td><td>${formatDateTime(r.created_at)}</td></tr>`;
    }).join('');
  div.innerHTML = '';
  div.appendChild(table);
}

// Inicializar: si ya hay token y user en localStorage, entrar
(async function(){
  const token = getSessionToken();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (token && user) {
    await initAfterLogin();
  } else {
    if (user) localStorage.removeItem('user');
  }
})();

// --- Context Menu & Edit Logic ---
let currentContextSale = null;
const ctxMenu = document.getElementById('context-menu');
const editModal = document.getElementById('edit-modal');
const ctxMenuProd = document.getElementById('ctx-menu-prod');

// Ocultar menú al hacer click en cualquier lado
document.addEventListener('click', () => {
  if (ctxMenu) ctxMenu.classList.add('hidden');
  if (ctxMenuProd) ctxMenuProd.classList.add('hidden');
});

function showContextMenu(e, sale) {
  currentContextSale = sale;
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const editAction = document.getElementById('ctx-edit');
  if (editAction) editAction.style.display = userHasRole(currentUser, 'admin') ? '' : 'none';
  // Posicionar menú donde fue el click
  ctxMenu.style.top = e.pageY + 'px';
  ctxMenu.style.left = e.pageX + 'px';
  ctxMenu.classList.remove('hidden');
}

function confirmSaleDeletion(sale) {
  if (!sale) return;
  showConfirm(`¿Estás seguro de eliminar la ORDEN #${sale.id} completa?`, async () => {
    const approvalToken = await requestAdminApproval(
      'delete:sale',
      `Para eliminar la orden #${sale.id}, ingresá las credenciales de un administrador.`
    );
    if (approvalToken === null) return;
    const result = await api('/sales/' + sale.id, {
      method: 'DELETE',
      headers: approvalHeaders(approvalToken)
    });
    if (result.error) return showToast(result.error, 'error');
    await loadSales();
    const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (userHasRole(currentUser, 'admin')) await loadDashboard();
    showToast('Venta eliminada correctamente', 'success');
  });
}

// Acción Eliminar
document.getElementById('ctx-delete').addEventListener('click', () => {
  confirmSaleDeletion(currentContextSale);
});

// Acción Editar (Abrir Modal)
document.getElementById('ctx-edit').addEventListener('click', () => {
  if (!currentContextSale) return;
  document.getElementById('edit-id').value = currentContextSale.id;
  document.getElementById('edit-total').value = currentContextSale.total;
  document.getElementById('edit-payment-method').value = currentContextSale.payment_method || 'cash';
  editModal.classList.remove('hidden');
});

// Guardar Edición
document.getElementById('save-edit').addEventListener('click', async () => {
  const id = document.getElementById('edit-id').value;
  const total = parseFloat(document.getElementById('edit-total').value) || 0;
  const payment_method = document.getElementById('edit-payment-method').value;

  const res = await api('/sales/' + id, { method: 'PUT', body: JSON.stringify({ total, payment_method }) });

  if (res.error) return showToast(res.error, 'error');

  editModal.classList.add('hidden');
  await loadSales();
  await loadDashboard();
});

document.getElementById('cancel-edit').addEventListener('click', () => {
  editModal.classList.add('hidden');
});

// --- Context Menu & Edit Logic (Products) ---
let currentContextProd = null;
const editProdModal = document.getElementById('edit-prod-modal');

function showProdContextMenu(e, prod) {
  currentContextProd = prod;
  ctxMenuProd.style.top = e.pageY + 'px';
  ctxMenuProd.style.left = e.pageX + 'px';
  ctxMenuProd.classList.remove('hidden');
}

document.getElementById('ctx-prod-delete').addEventListener('click', async () => {
  if (!currentContextProd) return;
  showConfirm(`¿Eliminar producto "${currentContextProd.name}"?`, async () => {
    await api('/products/' + currentContextProd.id, { method: 'DELETE' });
    await loadProducts();
  });
});

document.getElementById('ctx-prod-edit').addEventListener('click', () => {
  if (!currentContextProd) return;
  setProductFormToEdit(currentContextProd);
  ctxMenuProd.classList.add('hidden');
});

document.getElementById('save-prod-edit').addEventListener('click', async () => {
  const id = document.getElementById('edit-prod-id').value;
  const name = document.getElementById('edit-prod-name').value;
  const price_cost = parseFloat(document.getElementById('edit-prod-cost').value) || 0;
  const price_sale = parseFloat(document.getElementById('edit-prod-sale').value) || 0;
  const stock = parseInt(document.getElementById('edit-prod-stock')?.value, 10);
  const fileInput = document.getElementById('edit-prod-image');

  let payload = {
    name,
    price_cost,
    price_sale,
    stock: Number.isFinite(stock) ? stock : 0
  };
  if (fileInput.files.length > 0) {
    const fileData = await readFileAsBase64(fileInput.files[0]);
    payload.image_name = fileData.filename;
    payload.image_data = fileData.data;
  }
  const res = await api('/products/' + id, { method: 'PUT', body: JSON.stringify(payload) });
  if (res.error) return showToast('Error: ' + res.error, 'error');

  editProdModal.classList.add('hidden');
  await loadProducts();
  await loadDashboard();
});

document.getElementById('cancel-prod-edit').addEventListener('click', () => {
  editProdModal.classList.add('hidden');
});

// --- Logic for Wheel Quantity Picker ---
let currentQtyProdId = null;
const qtyModal = document.getElementById('qty-modal');
const qtyWheel = document.getElementById('qty-wheel');
let currentWheelValue = 1;

function initQtyWheel() {
  qtyWheel.innerHTML = '';
  // Padding para centrar el primer y último elemento (altura contenedor 200px, item 50px -> padding 75px)
  const padTop = document.createElement('li');
  padTop.className = 'wheel-item';
  padTop.style.height = '75px';
  padTop.style.pointerEvents = 'none';
  qtyWheel.appendChild(padTop);

  for (let i = 1; i <= 50; i++) {
    const li = document.createElement('li');
    li.className = 'wheel-item';
    li.textContent = i;
    li.onclick = function(){ 
      if (currentQtyProdId) {
        document.getElementById('qty-' + currentQtyProdId).value = i;
        document.getElementById('qty-btn-' + currentQtyProdId).textContent = i;
      }
      qtyModal.classList.add('hidden');
    };
    qtyWheel.appendChild(li);
  }
  
  const padBottom = document.createElement('li');
  padBottom.className = 'wheel-item';
  padBottom.style.height = '75px';
  padBottom.style.pointerEvents = 'none';
  qtyWheel.appendChild(padBottom);
}

window.openQtyPicker = function(prodId) {
  currentQtyProdId = prodId;
  const currentVal = parseInt(document.getElementById('qty-' + prodId).value) || 1;
  qtyModal.classList.remove('hidden');
  
  // Scroll al valor actual (item height 50px)
  setTimeout(() => {
    qtyWheel.scrollTop = (currentVal - 1) * 50;
  }, 10);
}

qtyWheel.addEventListener('scroll', () => {
  const index = Math.round(qtyWheel.scrollTop / 50);
  const val = index + 1;
  currentWheelValue = val > 50 ? 50 : (val < 1 ? 1 : val);
  
  document.querySelectorAll('.wheel-item').forEach(el => el.classList.remove('selected'));
  // +1 porque el primer hijo es el padding
  const selectedEl = qtyWheel.children[index + 1];
  if (selectedEl) selectedEl.classList.add('selected');
});

document.getElementById('confirm-qty').addEventListener('click', () => {
  if (currentQtyProdId) {
    document.getElementById('qty-' + currentQtyProdId).value = currentWheelValue;
    document.getElementById('qty-btn-' + currentQtyProdId).textContent = currentWheelValue;
  }
  qtyModal.classList.add('hidden');
});

document.getElementById('cancel-qty').addEventListener('click', () => { qtyModal.classList.add('hidden'); });

initQtyWheel();

// Registro de venta rápida en puerta
document.getElementById('btn-door-sale')?.addEventListener('click', async () => {
  const modal = document.getElementById('door-sale-modal');
  const input = document.getElementById('door-sale-qty-input');
  if (modal) {
    input.value = 1;
    modal.classList.remove('hidden');
    input.focus();
  }
});

document.getElementById('door-sale-cancel')?.addEventListener('click', () => {
  document.getElementById('door-sale-modal').classList.add('hidden');
});

document.getElementById('door-sale-continue')?.addEventListener('click', () => {
  const qty = parseInt(document.getElementById('door-sale-qty-input').value);
  if (isNaN(qty) || qty <= 0) return showToast('Ingrese una cantidad válida', 'error');
  
  document.getElementById('door-sale-modal').classList.add('hidden');

  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  if (!currentUser) return showToast('Sesión inválida', 'error');

  showConfirm(`¿Registrar ${qty} venta(s) rápida(s) en puerta? (Vendedor: ${currentUser.username})`, async () => {
    try {
      const res = await api('/tickets', {
        method: 'POST',
        body: JSON.stringify({
          first_name: 'Venta',
          last_name: 'en Puerta',
          dni: '0',
          payment_method: 'cash',
          ticket_type: 'puerta',
          user_id: currentUser.id,
          quantity: qty,
          entered: true
        })
      });
      if (res.error) return showToast(res.error, 'error');
      const successCount = res.quantity || 0;

      if (successCount > 0) {
        showToast(`${successCount} entrada(s) registrada(s) correctamente`, 'success');
        await loadTickets(document.getElementById('ticket-search')?.value.trim());
        await loadDashboard();
      }
    } catch (err) {
      showToast('Error de conexión', 'error');
    }
  }, 'Venta Rápida');
});

// --- QR Scanner Logic ---
let html5QrCode = null;
let qrScanInProgress = false;

async function stopQrScanner() {
  const scanner = html5QrCode;
  const reader = document.getElementById('reader');
  const videos = Array.from(reader?.querySelectorAll('video') || []);
  const streams = videos.map(video => video.srcObject).filter(Boolean);
  html5QrCode = null;

  try {
    if (scanner) {
      const state = scanner.getState();
      if (state === 2 || state === 3) {
        const stopAttempt = scanner.stop().catch(error => {
          console.warn('La librería no pudo detener el lector QR', error);
        });
        await Promise.race([
          stopAttempt,
          new Promise(resolve => setTimeout(resolve, 1200))
        ]);
      }
    }
  } catch (error) {
    console.warn('No se pudo detener el lector QR', error);
  } finally {
    // Algunos navegadores móviles no liberan la cámara al pausar/cerrar
    // la librería. Se detienen también las pistas MediaStream directamente.
    streams.forEach(stream => {
      if (typeof stream.getTracks === 'function') {
        stream.getTracks().forEach(track => track.stop());
      }
    });
    videos.forEach(video => {
      try {
        video.pause();
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      } catch (_) {}
    });
  }
  try {
    if (scanner) scanner.clear();
  } catch (_) {}
  if (reader) reader.replaceChildren();
}

async function closeQrScanner() {
  document.getElementById('qr-scanner-modal').classList.add('hidden');
  await stopQrScanner();
}

function showQrScanResult({ ok, title, message, detail }) {
  document.getElementById('qr-result-icon').textContent = ok ? '✅' : '⛔';
  document.getElementById('qr-result-title').textContent = title;
  document.getElementById('qr-result-message').textContent = message;
  document.getElementById('qr-result-detail').textContent = detail || '';
  document.getElementById('qr-result-modal').classList.remove('hidden');
}

document.getElementById('btn-scan-qr')?.addEventListener('click', async () => {
  qrScanInProgress = false;
  document.getElementById('qr-scanner-modal').classList.remove('hidden');
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }
  
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };

  try {
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config, 
      async (decodedText) => {
        // El QR contiene un token aleatorio; nunca expone ni acepta un ID secuencial.
        if (!qrScanInProgress && decodedText.startsWith('PENA_TICKET:')) {
          const token = decodedText.slice('PENA_TICKET:'.length);
          await processQRScan(token);
        }
      }
    );
  } catch (err) {
    showToast('Error al iniciar cámara: ' + err, 'error');
    await closeQrScanner();
  }
});

async function processQRScan(token) {
  if (qrScanInProgress) return;
  qrScanInProgress = true;
  try {
    // qrScanInProgress bloquea nuevas lecturas sin dejar la cámara pausada.
    const res = await api('/tickets/validate', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    await closeQrScanner();
    
    if (res.ok) {
      // Sonido o vibración podría ir aquí
      if (navigator.vibrate) navigator.vibrate(200);
      showQrScanResult({
        ok: true,
        title: 'Ingreso registrado',
        message: `${res.ticket.first_name} ${res.ticket.last_name}`,
        detail: `DNI: ${res.ticket.dni}`
      });
      loadTickets();
    } else {
      showQrScanResult({
        ok: false,
        title: 'Entrada rechazada',
        message: res.error || 'Ticket inválido',
        detail: res.entered_at ? `Ingreso anterior: ${formatDateTime(res.entered_at)}` : ''
      });
    }
    
    // Queda listo para iniciar un nuevo escaneo desde la app.
    qrScanInProgress = false;
  } catch (e) {
    await closeQrScanner();
    showQrScanResult({
      ok: false,
      title: 'No se pudo validar',
      message: 'Ocurrió un error al procesar la entrada',
      detail: 'Volvé a intentarlo.'
    });
  }
}

document.getElementById('close-scanner')?.addEventListener('click', async () => {
  await closeQrScanner();
  qrScanInProgress = false;
});

document.getElementById('qr-result-close')?.addEventListener('click', () => {
  document.getElementById('qr-result-modal').classList.add('hidden');
  qrScanInProgress = false;
});

// --- Inicialización Pública (Carga antes de Login) ---
async function initPublicInfo() {
  try {
    showDebugInfo([
      'Diagnostico de conexion',
      'API_BASE_URL: ' + (API_BASE_URL || '(vacia)'),
      'Ping: ' + buildUrl('/ping')
    ]);
    // 1. Verificar conexión a Base de Datos
    const pingRes = await requestJson(buildUrl('/ping'));
    const pingData = pingRes.data || {};
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    
    if (pingData.ok && pingData.db) {
      dot.style.background = '#4ade80'; // Verde
      text.textContent = 'Servidor en línea';
    } else {
      dot.style.background = '#f87171'; // Rojo
      text.textContent = 'Error de Base de Datos';
    }

    // 2. Cargar Logo y Nombre Público
    const settingsRes = await requestJson(buildUrl('/api/public-settings'));
    const settings = settingsRes.data || {};
    applyCompanyBranding(settings);
    showDebugInfo([]);
  } catch (e) {
    console.error('Error en inicialización pública:', e);
    showDebugInfo([
      'Diagnostico de conexion',
      'API_BASE_URL: ' + (API_BASE_URL || '(vacia)'),
      'Error publico: ' + (e && e.message ? e.message : String(e))
    ]);
  }
}

initMobileUI();
initPublicInfo();
