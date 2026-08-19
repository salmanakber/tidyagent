(() => {
  const script = document.currentScript;
  const token = script?.getAttribute("data-token");
  const src = script?.getAttribute("data-src") || "/widget/embed.js";
  if (!token) return;
  const boot = () => {
    const loader = document.createElement("script");
    loader.src = src;
    loader.async = true;
    loader.dataset.token = token;
    document.body.appendChild(loader);
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(boot, { timeout: 2500 });
  } else {
    window.addEventListener("load", () => setTimeout(boot, 1));
  }
})();
