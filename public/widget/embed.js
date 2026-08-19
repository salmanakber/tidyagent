(() => {
  const script = document.currentScript;
  const origin = script?.getAttribute("data-origin") || (script?.src ? new URL(script.src).origin : "");
  const token = script?.getAttribute("data-token") || "";
  const instance = script?.getAttribute("data-instance") || "";
  const site = script?.getAttribute("data-site") || window.location.hostname;
  if (!origin || (!token && !instance && !site)) return;
  if (document.getElementById("tidyagent-widget-root")) return;

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (instance) params.set("instanceId", instance);
  if (site) params.set("site", site);

  const root = document.createElement("div");
  root.id = "tidyagent-widget-root";
  document.body.appendChild(root);

  fetch(`${origin}/api/widget/config?${params.toString()}`)
    .then((response) => response.json())
    .then((config) => {
      if (!config?.name || config.status === "PAUSED") return;

      const side = config.position === "BOTTOM_LEFT" ? "left" : "right";
      const color = config.primaryColor || "#1F3A5F";
      let open = false;

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Open chat");
      button.textContent = (config.name || "AI").slice(0, 2).toUpperCase();
      button.style.cssText = `position:fixed;${side}:16px;bottom:16px;height:56px;width:56px;border-radius:999px;border:0;color:#fff;background:${color};z-index:2147483000;font:600 13px/1 ui-sans-serif,system-ui;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.18)`;

      const panel = document.createElement("div");
      panel.hidden = true;
      panel.style.cssText = `position:fixed;${side}:16px;bottom:80px;width:min(360px,calc(100vw - 32px));border-radius:24px;background:#fff;color:#102033;z-index:2147483000;box-shadow:0 18px 50px rgba(0,0,0,.2);overflow:hidden;font:14px/1.45 ui-sans-serif,system-ui`;
      panel.innerHTML = `<div style="padding:16px 18px;background:${color};color:#fff;font-weight:600">${escapeHtml(config.name)}</div><div style="padding:18px">${escapeHtml(config.greeting || "Hi! How can I help you today?")}</div>`;

      button.addEventListener("click", () => {
        open = !open;
        panel.hidden = !open;
      });

      document.body.appendChild(panel);
      document.body.appendChild(button);
    })
    .catch(() => undefined);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
})();
