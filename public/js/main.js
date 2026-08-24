console.log("EventGes - sistema iniciado");

document.addEventListener('DOMContentLoaded', () => {
  const toasts = document.querySelectorAll('[data-toast]');

  toasts.forEach((toast) => {
    let removeTimer = null;
    let hideTimer = null;

    function clearTimers() {
      if (hideTimer) window.clearTimeout(hideTimer);
      if (removeTimer) window.clearTimeout(removeTimer);
    }

    function stripQueryParam() {
      const paramName = toast.getAttribute('data-toast-query-param');
      if (!paramName) return;

      const url = new URL(window.location.href);
      if (!url.searchParams.has(paramName)) return;
      url.searchParams.delete(paramName);
      window.history.replaceState({}, '', url.toString());
    }

    function dismissToast() {
      if (toast.classList.contains('is-hiding')) return;
      toast.classList.add('is-hiding');
      stripQueryParam();
      clearTimers();
      removeTimer = window.setTimeout(() => {
        toast.remove();
      }, 320);
    }

    window.requestAnimationFrame(() => {
      toast.classList.add('is-visible');
    });

    hideTimer = window.setTimeout(dismissToast, 3800);

    toast.querySelector('[data-toast-close]')?.addEventListener('click', dismissToast);
  });

  const navToggle = document.querySelector('[data-nav-toggle]');
  const navPanel = document.querySelector('[data-nav-panel]');

  if (navToggle && navPanel) {
    function closeNav() {
      navPanel.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    }

    navToggle.addEventListener('click', () => {
      const willOpen = !navPanel.classList.contains('open');
      navPanel.classList.toggle('open', willOpen);
      navToggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      document.body.classList.toggle('nav-open', willOpen);
    });

    navPanel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', closeNav);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 980) {
        closeNav();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navPanel.classList.contains('open')) {
        closeNav();
      }
    });
  }

  const galleries = document.querySelectorAll('[data-product-gallery]');

  galleries.forEach((gallery) => {
    const slides = Array.from(gallery.querySelectorAll('[data-gallery-slide]'));
    const dots = Array.from(gallery.querySelectorAll('[data-gallery-dot]'));
    const prevButton = gallery.querySelector('[data-gallery-prev]');
    const nextButton = gallery.querySelector('[data-gallery-next]');

    if (slides.length <= 1) return;

    let currentIndex = slides.findIndex((slide) => slide.classList.contains('is-active'));
    if (currentIndex < 0) currentIndex = 0;

    function renderGallery(index) {
      currentIndex = (index + slides.length) % slides.length;

      slides.forEach((slide, slideIndex) => {
        slide.classList.toggle('is-active', slideIndex === currentIndex);
      });

      dots.forEach((dot, dotIndex) => {
        dot.classList.toggle('is-active', dotIndex === currentIndex);
      });
    }

    prevButton?.addEventListener('click', () => renderGallery(currentIndex - 1));
    nextButton?.addEventListener('click', () => renderGallery(currentIndex + 1));

    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        renderGallery(Number(dot.dataset.galleryIndex || 0));
      });
    });
  });

  const modal = document.querySelector('[data-product-modal]');
  if (modal) {
    const openButtons = document.querySelectorAll('[data-open-product-modal]');
    const closeButtons = document.querySelectorAll('[data-close-product-modal]');
    const form = document.getElementById('product-form-modal');

    const defaultValues = {
      id: '',
      name: '',
      description: '',
      price: '',
      stock: '',
      active: true,
      existing_image_1: '',
      existing_image_2: '',
      existing_image_3: '',
      existing_image_4: '',
      existing_image_5: ''
    };

    function setValue(name, value) {
      const field = form?.elements.namedItem(name);
      if (!field) return;

      if (field.type === 'checkbox') {
        field.checked = Boolean(value);
        return;
      }

      if (field.type === 'file') {
        field.value = '';
        return;
      }

      field.value = value ?? '';
    }

    function fillForm(values) {
      const data = { ...defaultValues, ...values };
      Object.keys(defaultValues).forEach((key) => setValue(key, data[key]));

      const title = document.getElementById('product-modal-title');
      if (title) {
        title.textContent = data.id ? 'Editar producto' : 'Nuevo producto';
      }
    }

    function openModal(values) {
      if (values) fillForm(values);
      modal.classList.add('open');
      document.body.classList.add('modal-open');
    }

    function closeModal() {
      modal.classList.remove('open');
      document.body.classList.remove('modal-open');
      const url = new URL(window.location.href);
      if (url.searchParams.has('editProductId')) {
        url.searchParams.delete('editProductId');
        window.history.replaceState({}, '', url.toString());
      }
      if (!window.location.search.includes('editProductId=')) {
        fillForm(defaultValues);
      }
    }

    openButtons.forEach((button) => {
      button.addEventListener('click', () => {
        fillForm(defaultValues);
        openModal();
      });
    });

    closeButtons.forEach((button) => {
      button.addEventListener('click', closeModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && modal.classList.contains('open')) {
        closeModal();
      }
    });
  }

  const userModal = document.querySelector('[data-user-modal]');
  if (userModal) {
    const closeButtons = document.querySelectorAll('[data-close-user-modal]');

    function closeUserModal() {
      userModal.classList.remove('open');
      document.body.classList.remove('modal-open');
      const url = new URL(window.location.href);
      if (url.searchParams.has('editUserId')) {
        url.searchParams.delete('editUserId');
        window.history.replaceState({}, '', url.toString());
      }
    }

    closeButtons.forEach((button) => {
      button.addEventListener('click', closeUserModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && userModal.classList.contains('open')) {
        closeUserModal();
      }
    });
  }

  const orderModal = document.querySelector('[data-order-modal]');
  if (orderModal) {
    const orderRows = document.querySelectorAll('[data-order-row]');
    const closeButtons = document.querySelectorAll('[data-close-order-modal]');

    const quoteItemsContainer = orderModal.querySelector('[data-quote-items]');
    const quoteItemTemplate = document.getElementById('quote-item-template');
    const addQuoteItemButton = orderModal.querySelector('[data-add-quote-item]');
    const quoteTotal = orderModal.querySelector('[data-quote-total]');

    function closeOrderModal() {
      orderModal.classList.remove('open');
      document.body.classList.remove('modal-open');
      const url = new URL(window.location.href);
      if (url.searchParams.has('editOrderId')) {
        url.searchParams.delete('editOrderId');
      }
      if (url.searchParams.has('newOrder')) {
        url.searchParams.delete('newOrder');
      }
      window.history.replaceState({}, '', url.toString());
    }

    closeButtons.forEach((button) => {
      button.addEventListener('click', closeOrderModal);
    });

    orderRows.forEach((row) => {
      row.addEventListener('click', (event) => {
        const interactiveTarget = event.target instanceof Element
          ? event.target.closest('a, button, input, select, textarea, label')
          : null;

        if (interactiveTarget) return;

        const href = row.getAttribute('data-href');
        if (href) {
          window.location.href = href;
        }
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && orderModal.classList.contains('open')) {
        closeOrderModal();
      }
    });

    function updateRemoveButtons() {
      if (!quoteItemsContainer) return;
      const rows = Array.from(quoteItemsContainer.querySelectorAll('[data-quote-item-row]'));
      rows.forEach((row) => {
        const removeButton = row.querySelector('[data-remove-quote-item]');
        if (!removeButton) return;
        removeButton.disabled = rows.length <= 1;
      });
    }

    function formatCurrency(value) {
      return `$${Number(value || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }

    function recalculateQuoteTotals() {
      if (!quoteItemsContainer) return;

      let total = 0;
      const rows = quoteItemsContainer.querySelectorAll('[data-quote-item-row]');

      rows.forEach((row) => {
        const qtyInput = row.querySelector('[data-quote-qty]');
        const priceInput = row.querySelector('[data-quote-price]');
        const subtotalInput = row.querySelector('[data-quote-subtotal]');
        const qty = Math.max(1, Number(qtyInput?.value || 1));
        const price = Math.max(0, Number(priceInput?.value || 0));
        const subtotal = qty * price;

        if (subtotalInput) {
          subtotalInput.value = subtotal.toFixed(2);
        }

        total += subtotal;
      });

      if (quoteTotal) {
        quoteTotal.textContent = formatCurrency(total);
      }

      updateRemoveButtons();
    }

    if (quoteItemsContainer) {
      quoteItemsContainer.addEventListener('input', (event) => {
        if (
          event.target instanceof HTMLInputElement &&
          (event.target.matches('[data-quote-qty]') || event.target.matches('[data-quote-price]'))
        ) {
          recalculateQuoteTotals();
        }
      });

      quoteItemsContainer.addEventListener('click', (event) => {
        const target = event.target instanceof Element ? event.target.closest('[data-remove-quote-item]') : null;
        if (!target) return;

        const row = target.closest('[data-quote-item-row]');
        if (!row) return;

        const rows = quoteItemsContainer.querySelectorAll('[data-quote-item-row]');
        if (rows.length <= 1) return;

        row.remove();
        recalculateQuoteTotals();
      });

      addQuoteItemButton?.addEventListener('click', () => {
        if (!quoteItemTemplate?.content) return;
        const fragment = quoteItemTemplate.content.cloneNode(true);
        quoteItemsContainer.appendChild(fragment);
        recalculateQuoteTotals();
      });

      recalculateQuoteTotals();
    }
  }

  const quoteModal = document.querySelector('[data-quote-modal]');
  if (quoteModal) {
    const openButtons = document.querySelectorAll('[data-open-quote-modal]');
    const closeButtons = document.querySelectorAll('[data-close-quote-modal]');

    function openQuoteModal() {
      quoteModal.classList.add('open');
      document.body.classList.add('modal-open');
    }

    function closeQuoteModal() {
      quoteModal.classList.remove('open');
      document.body.classList.remove('modal-open');
    }

    openButtons.forEach((button) => {
      button.addEventListener('click', openQuoteModal);
    });

    closeButtons.forEach((button) => {
      button.addEventListener('click', closeQuoteModal);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && quoteModal.classList.contains('open')) {
        closeQuoteModal();
      }
    });
  }
});
