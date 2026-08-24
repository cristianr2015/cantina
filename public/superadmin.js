const SA_TOKEN_KEY = 'superadminToken';
let companies = [];

function token() { return sessionStorage.getItem(SA_TOKEN_KEY); }
async function request(path, options = {}) {
  const response = await fetch(`/api/superadmin${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function showToast(message) {
  const toast = document.getElementById('sa-toast');
  toast.textContent = message; toast.hidden = false;
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function formatDate(value) {
  if (!value) return 'Sin vencimiento';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function licenseLabel(license) {
  if (!license?.type) return 'Sin licencia';
  return license.type === 'full' ? 'Pro' : 'Free';
}

function escapeHtml(value) {
  const element = document.createElement('div'); element.textContent = String(value || ''); return element.innerHTML;
}

function render() {
  const query = document.getElementById('sa-search').value.trim().toLowerCase();
  const visible = companies.filter(company => `${company.name} ${company.code}`.toLowerCase().includes(query));
  document.getElementById('sa-stat-companies').textContent = companies.length;
  document.getElementById('sa-stat-active').textContent = companies.filter(company => company.active).length;
  document.getElementById('sa-stat-pro').textContent = companies.filter(company => company.license.type === 'full' && company.license.active).length;
  const inThirtyDays = Date.now() + 30 * 86400000;
  document.getElementById('sa-stat-expiring').textContent = companies.filter(company => {
    const expiry = company.license.expiresAt ? new Date(company.license.expiresAt).getTime() : 0;
    return company.license.active && expiry > Date.now() && expiry <= inThirtyDays;
  }).length;
  const grid = document.getElementById('sa-companies');
  grid.innerHTML = visible.length ? visible.map(company => `
    <article class="sa-company-card ${company.active ? '' : 'is-suspended'}">
      <div class="sa-company-top"><div class="sa-company-title"><span class="sa-company-avatar">${escapeHtml(company.name.slice(0,2).toUpperCase())}</span><div><h3>${escapeHtml(company.name)}</h3><code>${escapeHtml(company.code)}</code></div></div><span class="sa-status ${company.active ? 'sa-status-active' : 'sa-status-suspended'}">${company.active ? 'Activa' : 'Suspendida'}</span></div>
      <div class="sa-company-meta"><div><span>Usuarios</span><strong>${company.users_count}</strong></div><div><span>Eventos</span><strong>${company.events_count}</strong></div><div><span>Alta</span><strong>${formatDate(company.created_at)}</strong></div></div>
      <div class="sa-license-line"><div><strong>${licenseLabel(company.license)}</strong><small>${company.license.state === 'expired' ? 'Vencida el ' : company.license.expiresAt ? 'Vence el ' : ''}${formatDate(company.license.expiresAt)}</small></div><span class="sa-status ${company.license.active ? 'sa-status-active' : 'sa-status-expired'}">${company.license.active ? 'Vigente' : 'Vencida'}</span></div>
      <div class="sa-company-actions"><button data-license="${company.id}" type="button">Gestionar licencia</button><button class="sa-secondary" data-toggle="${company.id}" type="button">${company.active ? 'Suspender' : 'Reactivar'}</button></div>
    </article>`).join('') : '<div class="sa-empty">No hay empresas para mostrar.</div>';
  grid.querySelectorAll('[data-license]').forEach(button => button.addEventListener('click', () => openLicense(Number(button.dataset.license))));
  grid.querySelectorAll('[data-toggle]').forEach(button => button.addEventListener('click', () => toggleCompany(Number(button.dataset.toggle))));
}

async function loadCompanies() { companies = await request('/companies'); render(); }

function setLicenseDurationOptions(typeSelect, durationSelect) {
  const isFree = typeSelect.value === 'free';
  durationSelect.innerHTML = isFree
    ? '<option value="forever">Sin vencimiento</option>'
    : '<option value="1y">1 año</option><option value="3y">3 años</option><option value="forever">Sin vencimiento</option><option value="custom">Fecha personalizada</option>';
  toggleCustomExpiry(durationSelect);
}

function toggleCustomExpiry(durationSelect) {
  const prefix = durationSelect.id === 'sa-license-duration' ? 'sa-license' : 'sa-company-custom';
  const wrapper = document.getElementById(`${prefix}-expiry-wrap`);
  if (wrapper) wrapper.hidden = durationSelect.value !== 'custom';
}

function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }

function openLicense(companyId) {
  const company = companies.find(item => item.id === companyId); if (!company) return;
  document.getElementById('sa-license-company-id').value = company.id;
  document.getElementById('sa-license-company-name').textContent = `Licencia de ${company.name}`;
  const type = document.getElementById('sa-license-type'); type.value = company.license.type || 'free';
  setLicenseDurationOptions(type, document.getElementById('sa-license-duration'));
  openModal('sa-license-modal');
}

async function toggleCompany(companyId) {
  const company = companies.find(item => item.id === companyId); if (!company) return;
  if (!confirm(`${company.active ? 'Suspender' : 'Reactivar'} el acceso de ${company.name}?`)) return;
  await request(`/companies/${company.id}`, { method: 'PUT', body: JSON.stringify({ name: company.name, code: company.code, active: !company.active }) });
  await loadCompanies(); showToast(company.active ? 'Empresa suspendida' : 'Empresa reactivada');
}

document.getElementById('superadmin-login-form').addEventListener('submit', async event => {
  event.preventDefault(); const error = document.getElementById('sa-login-error'); error.textContent = '';
  error.classList.remove('sa-success');
  try {
    const result = await request('/login', { method: 'POST', body: JSON.stringify({ username: document.getElementById('sa-username').value, password: document.getElementById('sa-password').value }) });
    sessionStorage.setItem(SA_TOKEN_KEY, result.token); await start(result.user);
  } catch (exception) { error.textContent = exception.message; }
});

async function start(user) {
  document.getElementById('superadmin-login').hidden = true; document.getElementById('superadmin-app').hidden = false;
  document.getElementById('sa-session-user').textContent = user.username; await loadCompanies();
}

document.getElementById('sa-open-company').addEventListener('click', () => {
  document.getElementById('sa-company-form').reset();
  delete document.getElementById('sa-company-code').dataset.edited;
  setLicenseDurationOptions(document.getElementById('sa-company-license-type'), document.getElementById('sa-company-license-duration'));
  openModal('sa-company-modal');
});
document.getElementById('sa-open-password').addEventListener('click', () => {
  document.getElementById('sa-password-form').reset();
  document.getElementById('sa-password-form-error').textContent = '';
  openModal('sa-password-modal');
  document.getElementById('sa-current-password').focus();
});
document.getElementById('sa-company-name').addEventListener('input', event => { const code = document.getElementById('sa-company-code'); if (!code.dataset.edited) code.value = event.target.value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); });
document.getElementById('sa-company-code').addEventListener('input', event => { event.target.dataset.edited = 'true'; });
document.getElementById('sa-search').addEventListener('input', render);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeModal(button.dataset.close)));

for (const [typeId, durationId] of [['sa-company-license-type','sa-company-license-duration'],['sa-license-type','sa-license-duration']]) {
  const type = document.getElementById(typeId), duration = document.getElementById(durationId);
  type.addEventListener('change', () => setLicenseDurationOptions(type, duration));
  duration.addEventListener('change', () => toggleCustomExpiry(duration));
}

document.getElementById('sa-company-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter, error = document.getElementById('sa-company-form-error'); error.textContent = ''; button.disabled = true;
  try {
    await request('/companies', { method: 'POST', body: JSON.stringify({
      name: document.getElementById('sa-company-name').value, code: document.getElementById('sa-company-code').value,
      admin_first_name: document.getElementById('sa-admin-first-name').value, admin_last_name: document.getElementById('sa-admin-last-name').value,
      admin_username: document.getElementById('sa-admin-username').value, admin_password: document.getElementById('sa-admin-password').value,
      license_type: document.getElementById('sa-company-license-type').value, license_duration: document.getElementById('sa-company-license-duration').value,
      expires_at: document.getElementById('sa-company-custom-expiry').value
    }) });
    closeModal('sa-company-modal'); await loadCompanies(); showToast('Empresa creada correctamente');
  } catch (exception) { error.textContent = exception.message; } finally { button.disabled = false; }
});

document.getElementById('sa-license-form').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter, error = document.getElementById('sa-license-form-error'); error.textContent = ''; button.disabled = true;
  try {
    const companyId = document.getElementById('sa-license-company-id').value;
    await request(`/companies/${companyId}/license`, { method: 'POST', body: JSON.stringify({ license_type: document.getElementById('sa-license-type').value, license_duration: document.getElementById('sa-license-duration').value, expires_at: document.getElementById('sa-license-custom-expiry').value }) });
    closeModal('sa-license-modal'); await loadCompanies(); showToast('Licencia asignada correctamente');
  } catch (exception) { error.textContent = exception.message; } finally { button.disabled = false; }
});

document.getElementById('sa-password-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  const error = document.getElementById('sa-password-form-error');
  const newPassword = document.getElementById('sa-new-password').value;
  const confirmation = document.getElementById('sa-confirm-password').value;
  error.textContent = '';
  if (newPassword !== confirmation) {
    error.textContent = 'La confirmación no coincide con la nueva contraseña';
    return;
  }
  button.disabled = true;
  try {
    const username = document.getElementById('sa-session-user').textContent;
    await request('/password', { method: 'PUT', body: JSON.stringify({
      current_password: document.getElementById('sa-current-password').value,
      new_password: newPassword,
      confirm_password: confirmation
    }) });
    sessionStorage.removeItem(SA_TOKEN_KEY);
    closeModal('sa-password-modal');
    document.getElementById('superadmin-app').hidden = true;
    document.getElementById('superadmin-login').hidden = false;
    document.getElementById('superadmin-login-form').reset();
    document.getElementById('sa-username').value = username;
    const loginMessage = document.getElementById('sa-login-error');
    loginMessage.textContent = 'Contraseña actualizada. Ingresá nuevamente con la nueva contraseña.';
    loginMessage.classList.add('sa-success');
    document.getElementById('sa-password').focus();
  } catch (exception) {
    error.textContent = exception.message;
  } finally {
    button.disabled = false;
  }
});

document.getElementById('sa-logout').addEventListener('click', () => { sessionStorage.removeItem(SA_TOKEN_KEY); location.reload(); });

(async () => { if (!token()) return; try { const session = await request('/session'); await start(session.user); } catch (_error) { sessionStorage.removeItem(SA_TOKEN_KEY); } })();
