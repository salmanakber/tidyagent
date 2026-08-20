(() => {
  const script =
    document.currentScript ||
    document.querySelector('script[src*="/widget.js"]') ||
    document.querySelector("script[data-instance], script[data-token]");
  if (!script || !script.src) return;

  const origin = new URL(script.src).origin;
  const token = script.getAttribute("data-token") || "";
  const rawInstance = script.getAttribute("data-instance") || "";
  const instance = rawInstance.includes("{") ? "" : rawInstance;

  const boot = () => {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", boot, { once: true });
      return;
    }
    if (document.getElementById("tidyagent-widget-root")) return;
    const loader = document.createElement("script");
    loader.src = `${origin}/widget/embed.js?v=20260820h`;
    loader.async = true;
    if (token) loader.dataset.token = token;
    if (instance) loader.dataset.instance = instance;
    loader.dataset.origin = origin;
    loader.dataset.site = window.location.hostname;
    document.body.appendChild(loader);
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(boot, { timeout: 2500 });
  } else {
    window.addEventListener("load", () => setTimeout(boot, 1));
  }
})();
