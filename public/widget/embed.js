(() => {
  const script = document.currentScript;
  const origin = script?.getAttribute("data-origin") || (script?.src ? new URL(script.src).origin : "");
  const token = script?.getAttribute("data-token") || "";
  const instanceRaw = script?.getAttribute("data-instance") || "";
  const instance = instanceRaw.includes("{") ? "" : instanceRaw;
  const site = script?.getAttribute("data-site") || window.location.hostname;
  if (!origin || (!token && !instance && !site)) return;
  if (document.getElementById("tidyagent-widget-root")) return;

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (instance) params.set("instanceId", instance);
  if (site) params.set("site", site);

  fetch(`${origin}/api/widget/config?${params.toString()}`)
    .then((response) => response.json())
    .then((config) => {
      if (!config?.name || config.status === "PAUSED" || config.status === "LOCKED" || config.status !== "ACTIVE") return;
      mountWidget(config);
    })
    .catch(() => undefined);

  function mountWidget(config) {
    const left = config.position === "BOTTOM_LEFT";
    const color = config.primaryColor || "#1F3A5F";
    const greeting = String(config.greeting || "Hi! How can I help you today?");
    const name = String(config.name || "Assistant");
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AI";
    const avatarUrl = absoluteUrl(config.avatarUrl, origin);
    const host = document.documentElement || document.body;

    const root = document.createElement("div");
    root.id = "tidyagent-widget-root";
    root.setAttribute("data-tidyagent", "launcher");
    root.style.cssText = [
      "all:initial",
      "display:block",
      "position:fixed",
      "z-index:2147483646",
      `bottom:max(20px, calc(env(safe-area-inset-bottom, 0px) + 16px))`,
      left
        ? "left:max(16px, env(safe-area-inset-left, 0px));right:auto"
        : "right:max(16px, env(safe-area-inset-right, 0px));left:auto",
      "width:auto",
      "max-width:min(380px, calc(100vw - 32px))",
      "pointer-events:none",
      "transform:translateZ(0)",
    ].join(";");
    host.appendChild(root);

    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${widgetCss(color, left)}</style>
      <div class="ta ${left ? "left" : "right"}">
        <div class="panel" hidden>
          <div class="head">
            <div class="ava">${avatarMarkup(avatarUrl, initials)}</div>
            <div class="meta">
              <p class="nm">${escapeHtml(name)}</p>
              <p class="st"><span class="dot"></span> Online now</p>
            </div>
            <button type="button" class="x" aria-label="Close chat">×</button>
          </div>
          <div class="thread">
            <div class="msg agent">${escapeHtml(greeting)}</div>
          </div>
          <form class="composer">
            <input class="box" type="text" maxlength="1200" placeholder="Ask a question" aria-label="Message">
            <button type="submit" class="go" aria-label="Send">Send</button>
          </form>
        </div>
        <div class="teaser" hidden>
          <p class="teaser-label">${escapeHtml(name)}</p>
          <p class="teaser-text"></p>
        </div>
        <button type="button" class="launch" aria-label="Open chat with ${escapeHtml(name)}">
          <span class="ring"></span>
          <span class="face">${avatarMarkup(avatarUrl, initials)}</span>
        </button>
      </div>
    `;

    const panel = shadow.querySelector(".panel");
    const teaser = shadow.querySelector(".teaser");
    const teaserText = shadow.querySelector(".teaser-text");
    const launch = shadow.querySelector(".launch");
    const close = shadow.querySelector(".x");
    const thread = shadow.querySelector(".thread");
    const composer = shadow.querySelector(".composer");
    const box = shadow.querySelector(".box");
    const storageKey = `tidyagent:${instance || site || "local"}`;
    let conversationId = "";
    try {
      conversationId = window.localStorage.getItem(`${storageKey}:conv`) || "";
    } catch {
      conversationId = "";
    }
    let visitorId = "";
    try {
      visitorId = window.localStorage.getItem(`${storageKey}:vid`) || "";
      if (!visitorId) {
        visitorId = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
        window.localStorage.setItem(`${storageKey}:vid`, visitorId);
      }
    } catch {
      visitorId = `v_${Date.now()}`;
    }
    shadow.querySelectorAll("img").forEach((img) => {
      img.addEventListener("error", () => {
        const span = document.createElement("span");
        span.className = "fallback";
        span.textContent = initials;
        img.replaceWith(span);
      });
    });
    let open = false;
    let typed = false;
    let soundPlayed = false;
    let audioCtx = null;

    function setOpen(next) {
      open = next;
      panel.hidden = !open;
      teaser.hidden = open || !typed;
      launch.setAttribute("aria-expanded", String(open));
    }

    launch.addEventListener("click", () => {
      unlockAudio();
      setOpen(!open);
    });
    close.addEventListener("click", () => setOpen(false));
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendChat();
    });

    requestAnimationFrame(() => {
      launch.classList.add("in");
      window.setTimeout(() => {
        typeTeaser(teaserText, greeting, () => {
          typed = true;
          if (!open) teaser.hidden = false;
          teaser.classList.add("in");
          playPopupSound();
        });
      }, 420);
    });

    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);

    function unlockAudio() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === "suspended") void audioCtx.resume();
      } catch {
        /* browsers may block until a gesture */
      }
    }

    function playPopupSound() {
      if (soundPlayed) return;
      soundPlayed = true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === "suspended") {
          void audioCtx.resume().then(() => chime(audioCtx));
          return;
        }
        chime(audioCtx);
      } catch {
        /* ignore autoplay restrictions */
      }
    }

    function addMsg(role, text) {
      const node = document.createElement("div");
      node.className = `msg ${role}`;
      node.textContent = text;
      thread.appendChild(node);
      thread.scrollTop = thread.scrollHeight;
    }

    async function sendChat() {
      const text = String(box.value || "").trim();
      if (!text || box.disabled) return;
      box.value = "";
      addMsg("visitor", text);
      box.disabled = true;
      const thinking = document.createElement("div");
      thinking.className = "msg agent dim";
      thinking.textContent = "Checking that for you…";
      thread.appendChild(thinking);
      thread.scrollTop = thread.scrollHeight;
      try {
        const response = await fetch(`${origin}/api/widget/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: conversationId || undefined,
            visitorId,
            token,
            instanceId: instance,
            site,
          }),
        });
        const data = await response.json();
        thinking.remove();
        if (data.conversationId) {
          conversationId = data.conversationId;
          try {
            window.localStorage.setItem(`${storageKey}:conv`, conversationId);
          } catch {
            /* ignore */
          }
        }
        addMsg("agent", data.text || data.error || "I couldn’t reply just then. Please try again.");
      } catch {
        thinking.remove();
        addMsg("agent", "I couldn’t reach the team just then. Please try again.");
      } finally {
        box.disabled = false;
        box.focus();
      }
    }
  }

  function chime(ctx) {
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.11, now + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    master.connect(ctx.destination);

    const pop = ctx.createOscillator();
    pop.type = "sine";
    pop.frequency.setValueAtTime(740, now);
    pop.frequency.exponentialRampToValueAtTime(1180, now + 0.07);
    pop.connect(master);
    pop.start(now);
    pop.stop(now + 0.22);

    const tone = ctx.createOscillator();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(988, now + 0.06);
    tone.frequency.exponentialRampToValueAtTime(1318, now + 0.2);
    tone.connect(master);
    tone.start(now + 0.05);
    tone.stop(now + 0.4);
  }

  function typeTeaser(el, text, done) {
    const max = 92;
    const value = text.length > max ? `${text.slice(0, max).trim()}…` : text;
    el.textContent = "";
    el.parentElement.hidden = false;
    let i = 0;
    const tick = () => {
      i += 1;
      el.textContent = value.slice(0, i);
      if (i < value.length) window.setTimeout(tick, 18 + Math.random() * 22);
      else done();
    };
    tick();
  }

  function avatarMarkup(url, initials) {
    if (url) {
      return `<img src="${escapeAttr(url)}" alt="" referrerpolicy="no-referrer">`;
    }
    return `<span class="fallback">${escapeHtml(initials)}</span>`;
  }

  function absoluteUrl(value, appOrigin) {
    if (!value || typeof value !== "string") return "";
    if (value.startsWith("//")) return `https:${value}`;
    if (value.startsWith("/")) return `${appOrigin}${value}`;
    if (value.startsWith("http://")) return `https://${value.slice(7)}`;
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function widgetCss(color, left) {
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      .ta {
        display: flex;
        flex-direction: column;
        align-items: ${left ? "flex-start" : "flex-end"};
        gap: 12px;
        pointer-events: none;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .ta > * { pointer-events: auto; }
      .launch {
        position: relative;
        height: 64px;
        width: 64px;
        border: 0;
        padding: 0;
        border-radius: 999px;
        cursor: pointer;
        background: ${color};
        color: #fff;
        box-shadow: 0 14px 36px rgba(16, 24, 40, 0.28), 0 0 0 1px rgba(255,255,255,0.12) inset;
        transform: translateY(18px) scale(0.86);
        opacity: 0;
        animation: ta-in 520ms cubic-bezier(.22,1.2,.36,1) forwards;
      }
      .launch.in { opacity: 1; transform: none; }
      .launch:hover { transform: translateY(-2px) scale(1.03); }
      .face, .face img, .ava, .ava img {
        display: block;
        height: 100%;
        width: 100%;
        border-radius: 999px;
        object-fit: cover;
      }
      .face {
        overflow: hidden;
        height: 64px;
        width: 64px;
      }
      .fallback {
        display: flex;
        height: 100%;
        width: 100%;
        align-items: center;
        justify-content: center;
        font: 700 15px/1 ui-sans-serif, system-ui;
        letter-spacing: 0.04em;
      }
      .ring {
        position: absolute;
        inset: -7px;
        border-radius: 999px;
        border: 2px solid ${color};
        opacity: 0.45;
        animation: ta-pulse 2.4s ease-out infinite;
        pointer-events: none;
      }
      .teaser {
        max-width: min(280px, calc(100vw - 96px));
        background: #fff;
        color: #122033;
        border-radius: ${left ? "18px 18px 18px 6px" : "18px 18px 6px 18px"};
        padding: 12px 14px 13px;
        box-shadow: 0 18px 50px rgba(16,24,40,.22);
        transform-origin: ${left ? "bottom left" : "bottom right"};
        transform: translateY(10px) scale(0.96);
        opacity: 0;
        transition: transform 420ms cubic-bezier(.22,1.2,.36,1), opacity 280ms ease;
      }
      .teaser.in { transform: none; opacity: 1; }
      .teaser-label {
        margin: 0 0 4px;
        font: 650 11px/1.2 ui-sans-serif, system-ui;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: ${color};
      }
      .teaser-text {
        margin: 0;
        font: 500 14px/1.45 ui-sans-serif, system-ui;
        min-height: 1.45em;
      }
      .teaser-text::after {
        content: "";
        display: inline-block;
        width: 2px;
        height: 0.95em;
        margin-left: 1px;
        background: ${color};
        animation: ta-caret 0.9s steps(1) infinite;
        vertical-align: -2px;
      }
      .teaser.in .teaser-text::after { display: none; }
      .panel {
        width: min(360px, calc(100vw - 32px));
        height: min(520px, calc(100vh - 120px));
        display: flex;
        flex-direction: column;
        border-radius: 24px;
        overflow: hidden;
        background: #fff;
        color: #122033;
        box-shadow: 0 24px 70px rgba(16,24,40,.28);
        animation: ta-panel 380ms cubic-bezier(.22,1.15,.36,1);
      }
      .thread {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        background: #f6f8fb;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .msg {
        max-width: 85%;
        border-radius: 16px;
        padding: 10px 12px;
        font: 500 14px/1.5 ui-sans-serif, system-ui;
        box-shadow: 0 1px 2px rgba(16,24,40,.06);
        animation: ta-msg 420ms ease both;
      }
      .msg.agent { background: #fff; color: #122033; border-radius: 16px 16px 16px 6px; }
      .msg.visitor { margin-left: auto; background: ${color}; color: #fff; border-radius: 16px 16px 6px 16px; }
      .msg.dim { color: #64748b; }
      .composer {
        display: flex;
        gap: 8px;
        padding: 10px;
        border-top: 1px solid #e8eef5;
        background: #fff;
      }
      .box {
        flex: 1;
        border: 0;
        border-radius: 999px;
        background: #f1f5f9;
        padding: 10px 14px;
        font: 500 14px/1.3 ui-sans-serif, system-ui;
        outline: none;
        color: #122033;
      }
      .go {
        border: 0;
        border-radius: 999px;
        background: ${color};
        color: #fff;
        padding: 0 14px;
        font: 650 12px/1 ui-sans-serif, system-ui;
        cursor: pointer;
      }
      .head {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        background: ${color};
        color: #fff;
      }
      .ava { height: 38px; width: 38px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); flex: none; }
      .nm { margin: 0; font: 650 14px/1.2 ui-sans-serif, system-ui; }
      .st { margin: 3px 0 0; font: 500 11px/1 ui-sans-serif, system-ui; opacity: .86; display: flex; align-items: center; gap: 6px; }
      .dot { height: 7px; width: 7px; border-radius: 999px; background: #86efac; box-shadow: 0 0 0 4px rgba(134,239,172,.18); }
      .x {
        margin-left: auto;
        border: 0;
        background: transparent;
        color: #fff;
        font: 400 22px/1 ui-sans-serif, system-ui;
        cursor: pointer;
        opacity: .85;
      }
      @keyframes ta-in {
        to { opacity: 1; transform: none; }
      }
      @keyframes ta-pulse {
        0% { transform: scale(0.92); opacity: .5; }
        100% { transform: scale(1.18); opacity: 0; }
      }
      @keyframes ta-caret {
        50% { opacity: 0; }
      }
      @keyframes ta-panel {
        from { opacity: 0; transform: translateY(12px) scale(.98); }
      }
      @keyframes ta-msg {
        from { opacity: 0; transform: translateY(6px); }
      }
    `;
  }
})();
