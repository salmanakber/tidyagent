(() => {
  const token =
    document.currentScript?.getAttribute("data-token") ||
    document.querySelector("script[data-token]")?.getAttribute("data-token");
  if (!token) return;

  const root = document.createElement("div");
  root.id = "tidyagent-widget-root";
  document.body.appendChild(root);

  fetch(`/api/widget/config?token=${encodeURIComponent(token)}`)
    .then((response) => response.json())
    .then((config) => {
      if (!config?.name) return;
      const button = document.createElement("button");
      button.setAttribute("aria-label", "Open chat");
      button.textContent = (config.name || "AI").slice(0, 2).toUpperCase();
      button.style.cssText = `position:fixed;${config.position === "BOTTOM_LEFT" ? "left" : "right"}:16px;bottom:16px;height:56px;width:56px;border-radius:999px;border:0;color:#fff;background:${config.primaryColor || "#1F3A5F"};z-index:2147483000;font:600 13px/1 ui-sans-serif,system-ui`;
      document.body.appendChild(button);
    })
    .catch(() => undefined);
})();
