class SidebarMenu extends HTMLElement {
  connectedCallback() {
    const defaultLogo = (window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL)
      ? window.APP_CONFIG.API_BASE_URL.replace(/\/+$/, '') + '/uploads/default-logo.png'
      : 'uploads/default-logo.png';
    this.style.display = 'contents';
    this.innerHTML = `
      <div id="sidebar-overlay" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:999"></div>
      <aside id="main-sidebar" class="sidebar">
        <div class="sidebar-header" style="padding: 10px 14px; margin-bottom: 20px; text-align: center; border-bottom: 1px solid rgba(15,23,42,0.05)">
          <img id="sidebar-logo" src="${defaultLogo}" style="max-width: 80px; max-height: 80px; object-fit: contain; margin-bottom: 8px; border-radius: 8px">
          <div id="sidebar-company-name" style="font-weight: 700; font-size: 16px; color: var(--accent)">Nombre Empresa</div>
        </div>
        <nav>
          <ul>
            <li><a href="#dashboard" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h7v7H3V3zM14 3h7v7h-7V3zM14 14h7v7h-7v-7zM3 14h7v7H3v-7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Dashboard</span>
            </a></li>
            <li><a href="#sales" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h18v4H3V3zM5 11h14v10H5V11z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Registrar venta</span>
            </a></li>
            <li><a href="#tickets" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 8h14v8H5V8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 6v12" stroke="currentColor" stroke-width="1.5"/><path d="M20 6v12" stroke="currentColor" stroke-width="1.5"/></svg>
              <span>Entradas vendidas</span>
            </a></li>
            <li><a href="#partners" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 1v22M5 5h14M5 19h14M2 9h20M2 15h20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Gestión de gastos</span>
            </a></li>
            <li><a href="#products" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 7h18M7 3v4M17 3v4M4 11h16v10H4z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Productos</span>
            </a></li>
            <li><a href="#reports" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3v18h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 7l-8 8-5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Reportes</span>
            </a></li>
            <li class="admin-only"><a href="#config" data-nav>
              <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.3 17.3l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09c.7 0 1.3-.4 1.51-1a1.65 1.65 0 0 0-.33-1.82L4.3 4.3A2 2 0 1 1 7.12 1.47l.06.06c.45.45 1.08.6 1.66.4.51-.17 1.06-.26 1.6-.26h.33c.54 0 1.09.09 1.6.26.58.2 1.21.05 1.66-.4l.06-.06A2 2 0 0 1 20 4.3l-.06.06a1.65 1.65 0 0 0-.33 1.82c.2.58.05 1.21-.4 1.66-.17.17-.26.72-.26 1.26v.33c0 .54.09 1.09.26 1.6.2.58.05 1.21.4 1.66l.06.06A2 2 0 0 1 20 19.7l-.06.06c-.45.45-1.08.6-1.66.4-.51-.17-1.06-.26-1.6-.26H16.4c-.54 0-1.09.09-1.6.26-.58.2-1.21.05-1.66-.4l-.06-.06A2 2 0 0 1 7.7 20.7l.06-.06c.45-.45.6-1.08.4-1.66-.17-.51-.26-1.06-.26-1.6v-.33c0-.54-.09-1.09-.26-1.6-.2-.58-.05-1.21.4-1.66l.06-.06A2 2 0 0 1 7 4.3l.06-.06c.45-.45 1.08-.6 1.66-.4.51.17 1.06.26 1.6.26h.33c.54 0 1.09-.09 1.6-.26.58-.2 1.21-.05 1.66.4l.06.06A2 2 0 0 1 19.7 7l-.06.06c-.45.45-.6 1.08-.4 1.66.17.51.26 1.06.26 1.6v.33c0 .54-.09 1.09-.26 1.6-.2.58-.05 1.21.4 1.66l.06.06A2 2 0 0 1 19.4 15z" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <span>Configuración</span>
            </a></li>
          </ul>
        </nav>
      </aside>
    `;
  }
}
customElements.define('sidebar-menu', SidebarMenu);
