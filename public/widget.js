(() => {
  const script = document.currentScript;
  if (!script || !script.src) return;

  const origin = new URL(script.src).origin;
  const token = script.getAttribute("data-token") || "";
  const instance = script.getAttribute("data-instance") || "";

  const boot = () => {
    if (document.getElementById("tidyagent-widget-root")) return;
    const loader = document.createElement("script");
    loader.src = `${origin}/widget/embed.js`;
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
