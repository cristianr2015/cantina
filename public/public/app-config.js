(function initAppConfig() {
  const isNativeApp = !!window.Capacitor
    && typeof window.Capacitor.getPlatform === 'function'
    && window.Capacitor.getPlatform() !== 'web';
  const isFileProtocol = window.location.protocol === 'file:';
  const defaultApiBaseUrl = (isNativeApp || isFileProtocol)
    ? 'https://pescadevolucionynaturaleza.com.ar'
    : '';

  window.APP_CONFIG = Object.assign(
    {
      // En web usamos mismo origen; en la app nativa mantenemos el backend remoto.
      API_BASE_URL: defaultApiBaseUrl
    },
    window.APP_CONFIG || {}
  );
})();
