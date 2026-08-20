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
      if (!config?.name || config.status !== "ACTIVE") return;
      mountWidget(config);
    })
    .catch(() => undefined);

  function mountWidget(config) {
    const left = config.position === "BOTTOM_LEFT";
    const color = config.primaryColor || "#1F3A5F";
    const greeting = String(config.greeting || "Hi! How can I help you today?");
    const name = String(config.name || "Assistant");
    const template = String(config.template || "CLASSIC").toUpperCase();
    const voiceOffered = Boolean(config.voiceEnabled);
    const initials = name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AI";
    const avatarUrl = absoluteUrl(config.avatarUrl, origin);
    const host = document.documentElement || document.body;
    const mobile = () => window.matchMedia("(max-width: 640px)").matches;

    const root = document.createElement("div");
    root.id = "tidyagent-widget-root";
    root.setAttribute("data-tidyagent", "launcher");
    placeRoot(false);
    host.appendChild(root);

    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${widgetCss(color, left, template)}</style>
      <div class="ta ${left ? "left" : "right"} tpl-${template.toLowerCase()}">
        <div class="panel" hidden>
          <div class="head">
            <div class="ava">${avatarMarkup(avatarUrl, initials)}</div>
            <div class="meta">
              <p class="nm">${escapeHtml(name)}</p>
              <p class="st"><span class="dot"></span> <span class="st-label">Online now</span></p>
            </div>
            ${voiceOffered ? `<button type="button" class="voice-tog on" aria-pressed="true" title="Voice">Voice</button>` : ""}
            <button type="button" class="x" aria-label="Close chat">×</button>
          </div>
          <div class="thread">
            <div class="msg agent">${escapeHtml(greeting)}</div>
          </div>
          <form class="composer">
            ${voiceOffered ? `<button type="button" class="mic" aria-label="Speak">Mic</button>` : ""}
            <input class="box" type="text" maxlength="1200" placeholder="Ask a question" aria-label="Message" enterkeyhint="send">
            <button type="submit" class="go" aria-label="Send">Send</button>
          </form>
        </div>
        <div class="teaser" hidden>
          <button type="button" class="teaser-x" aria-label="Dismiss greeting">×</button>
          <p class="teaser-label">${escapeHtml(name)}</p>
          <p class="teaser-text"></p>
        </div>
        <button type="button" class="launch" aria-label="Open chat with ${escapeHtml(name)}" aria-expanded="false">
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
    const teaserClose = shadow.querySelector(".teaser-x");
    const thread = shadow.querySelector(".thread");
    const composer = shadow.querySelector(".composer");
    const box = shadow.querySelector(".box");
    const voiceTog = shadow.querySelector(".voice-tog");
    const micBtn = shadow.querySelector(".mic");
    const nameEl = shadow.querySelector(".nm");
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
    let teaserDismissed = false;
    let soundPlayed = false;
    let audioCtx = null;
    let voiceOn = voiceOffered;
    let listening = false;
    let recorder = null;
    let chunks = [];
    let puterReady = null;

    function placeRoot(isOpen) {
      const full = isOpen && mobile();
      root.style.cssText = full
        ? [
            "all:initial",
            "display:block",
            "position:fixed",
            "z-index:2147483646",
            "inset:0",
            "width:100%",
            "height:100%",
            "max-width:none",
            "pointer-events:none",
          ].join(";")
        : [
            "all:initial",
            "display:block",
            "position:fixed",
            "z-index:2147483646",
            "bottom:max(16px, calc(env(safe-area-inset-bottom, 0px) + 12px))",
            left
              ? "left:max(12px, env(safe-area-inset-left, 0px));right:auto"
              : "right:max(12px, env(safe-area-inset-right, 0px));left:auto",
            "width:auto",
            "max-width:min(400px, calc(100vw - 24px))",
            "pointer-events:none",
          ].join(";");
    }

    function setOpen(next) {
      open = Boolean(next);
      if (open) panel.removeAttribute("hidden");
      else panel.setAttribute("hidden", "");
      const showTeaser = !open && typed && !teaserDismissed && template !== "MINIMAL";
      if (showTeaser) teaser.removeAttribute("hidden");
      else teaser.setAttribute("hidden", "");
      launch.setAttribute("aria-expanded", String(open));
      placeRoot(open);
      if (open) {
        unlockAudio();
        window.setTimeout(() => box.focus(), 80);
        if (voiceOn) speak(greeting);
      } else {
        stopListen();
      }
    }

    launch.addEventListener("click", () => {
      unlockAudio();
      setOpen(!open);
    });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    });
    teaserClose.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      teaserDismissed = true;
      teaser.setAttribute("hidden", "");
    });
    teaser.addEventListener("click", (event) => {
      if (event.target.closest(".teaser-x")) return;
      unlockAudio();
      setOpen(true);
    });
    composer.addEventListener("submit", (event) => {
      event.preventDefault();
      void sendChat(String(box.value || ""));
    });

    if (voiceTog) {
      voiceTog.addEventListener("click", () => {
        voiceOn = !voiceOn;
        voiceTog.classList.toggle("on", voiceOn);
        voiceTog.setAttribute("aria-pressed", String(voiceOn));
        if (!voiceOn) stopListen();
        else if (open) speak("Voice is on.");
      });
    }
    if (micBtn) {
      micBtn.addEventListener("click", () => {
        if (!voiceOn) {
          voiceOn = true;
          if (voiceTog) {
            voiceTog.classList.add("on");
            voiceTog.setAttribute("aria-pressed", "true");
          }
        }
        if (listening) stopListen();
        else void startListen();
      });
    }

    requestAnimationFrame(() => {
      launch.classList.add("in");
      if (template === "MINIMAL") return;
      window.setTimeout(() => {
        typeTeaser(teaserText, greeting, () => {
          typed = true;
          if (!open && !teaserDismissed) teaser.removeAttribute("hidden");
          teaser.classList.add("in");
          playPopupSound();
        });
      }, 480);
    });

    const unlock = () => {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("resize", () => placeRoot(open));

    function unlockAudio() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audioCtx) audioCtx = new Ctx();
        if (audioCtx.state === "suspended") void audioCtx.resume();
      } catch {
        /* ignore */
      }
    }

    function tone({ freq, dur, type = "sine", gain = 0.08, slide = 0 }) {
      unlockAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), now + dur);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(amp);
      amp.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    function playPopupSound() {
      if (soundPlayed) return;
      soundPlayed = true;
      unlockAudio();
      tone({ freq: 740, dur: 0.16, type: "sine", gain: 0.09, slide: 420 });
      window.setTimeout(() => tone({ freq: 988, dur: 0.22, type: "triangle", gain: 0.07, slide: 280 }), 70);
    }

    function playSendTick() {
      unlockAudio();
      tone({ freq: 1320, dur: 0.07, type: "square", gain: 0.045 });
      window.setTimeout(() => tone({ freq: 1760, dur: 0.05, type: "sine", gain: 0.03 }), 40);
    }

    function playReceiveTick() {
      unlockAudio();
      tone({ freq: 660, dur: 0.08, type: "sine", gain: 0.05 });
      window.setTimeout(() => tone({ freq: 880, dur: 0.1, type: "triangle", gain: 0.04 }), 50);
    }

    function ensurePuter() {
      if (window.puter?.ai) return Promise.resolve(window.puter);
      if (puterReady) return puterReady;
      puterReady = new Promise((resolve, reject) => {
        const existing = document.querySelector('script[src="https://js.puter.com/v2/"]');
        if (existing) {
          existing.addEventListener("load", () => resolve(window.puter));
          existing.addEventListener("error", reject);
          return;
        }
        const tag = document.createElement("script");
        tag.src = "https://js.puter.com/v2/";
        tag.async = true;
        tag.onload = () => resolve(window.puter);
        tag.onerror = reject;
        document.head.appendChild(tag);
      });
      return puterReady;
    }

    async function speak(text) {
      if (!voiceOn || !text) return;
      try {
        const puter = await ensurePuter();
        const audio = await puter.ai.txt2speech(String(text).slice(0, 900), { engine: "neural" });
        await audio.play();
      } catch {
        try {
          const utter = new SpeechSynthesisUtterance(String(text).slice(0, 900));
          utter.rate = 1.02;
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utter);
        } catch {
          /* ignore */
        }
      }
    }

    async function startListen() {
      if (!voiceOn || listening) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
          listening = false;
          micBtn?.classList.remove("live");
          if (blob.size < 800) return;
          try {
            const puter = await ensurePuter();
            const result = await puter.ai.speech2txt(blob);
            const text = typeof result === "string" ? result : result?.text || result?.transcript || "";
            if (text.trim()) void sendChat(text.trim());
          } catch {
            addSystem("I couldn’t hear that clearly. Try typing instead.");
          }
        };
        recorder.start();
        listening = true;
        micBtn?.classList.add("live");
      } catch {
        addSystem("Microphone access was blocked. You can still type.");
      }
    }

    function stopListen() {
      if (recorder && listening) recorder.stop();
      listening = false;
      micBtn?.classList.remove("live");
    }

    function addSystem(text) {
      const node = document.createElement("div");
      node.className = "sys";
      node.textContent = text;
      thread.appendChild(node);
      thread.scrollTop = thread.scrollHeight;
    }

    function addMsg(role, text) {
      const node = document.createElement("div");
      node.className = `msg ${role}`;
      node.textContent = text;
      thread.appendChild(node);
      thread.scrollTop = thread.scrollHeight;
    }

    async function sendChat(raw) {
      const text = String(raw || "").trim();
      if (!text || box.disabled) return;
      box.value = "";
      playSendTick();
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
        if (data.handoff?.to) {
          addSystem(`${data.handoff.from} is connecting you with ${data.handoff.to}`);
          if (data.agent?.name) nameEl.textContent = data.agent.name;
        }
        const reply = data.text || data.error || "I couldn’t reply just then. Please try again.";
        addMsg("agent", reply);
        playReceiveTick();
        if (voiceOn) void speak(reply);
      } catch {
        thinking.remove();
        addMsg("agent", "I couldn’t reach the team just then. Please try again.");
      } finally {
        box.disabled = false;
        box.focus();
      }
    }
  }

  function typeTeaser(el, text, done) {
    const max = 92;
    const value = text.length > max ? `${text.slice(0, max).trim()}…` : text;
    el.textContent = "";
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
    if (url) return `<img src="${escapeAttr(url)}" alt="" referrerpolicy="no-referrer">`;
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

  function widgetCss(color, left, template) {
    const soft = template === "SOFT";
    const bar = template === "BAR";
    const radius = soft ? "28px" : bar ? "18px 18px 0 0" : "22px";
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .ta {
        display: flex;
        flex-direction: column;
        align-items: ${left ? "flex-start" : "flex-end"};
        gap: 10px;
        pointer-events: none;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        width: 100%;
      }
      .ta > * { pointer-events: auto; }
      .launch {
        position: relative;
        height: 60px;
        width: 60px;
        border: 0;
        padding: 0;
        border-radius: 999px;
        cursor: pointer;
        background: ${color};
        color: #fff;
        box-shadow: 0 14px 36px rgba(16, 24, 40, 0.28);
        opacity: 0;
        transform: translateY(12px) scale(0.9);
      }
      .launch.in { animation: ta-in 480ms cubic-bezier(.22,1.2,.36,1) forwards; }
      .face, .face img, .ava, .ava img {
        display: block; height: 100%; width: 100%; border-radius: 999px; object-fit: cover;
      }
      .face { overflow: hidden; height: 60px; width: 60px; }
      .fallback {
        display: flex; height: 100%; width: 100%; align-items: center; justify-content: center;
        font: 700 14px/1 ui-sans-serif, system-ui;
      }
      .ring {
        position: absolute; inset: -6px; border-radius: 999px; border: 2px solid ${color};
        opacity: 0.4; animation: ta-pulse 2.4s ease-out infinite; pointer-events: none;
      }
      .teaser {
        position: relative;
        max-width: min(260px, calc(100vw - 88px));
        background: #fff; color: #122033;
        border-radius: ${left ? "16px 16px 16px 6px" : "16px 16px 6px 16px"};
        padding: 12px 28px 12px 14px;
        box-shadow: 0 16px 40px rgba(16,24,40,.2);
        cursor: pointer;
      }
      .teaser.in { animation: ta-in 380ms ease both; }
      .teaser-x {
        position: absolute; top: 6px; right: 8px; border: 0; background: transparent;
        color: #64748b; font: 500 16px/1 ui-sans-serif, system-ui; cursor: pointer;
      }
      .teaser-label {
        margin: 0 0 4px; font: 650 10px/1.2 ui-sans-serif, system-ui;
        letter-spacing: 0.08em; text-transform: uppercase; color: ${color};
      }
      .teaser-text { margin: 0; font: 500 14px/1.45 ui-sans-serif, system-ui; min-height: 1.45em; }
      .panel {
        width: min(380px, calc(100vw - 24px));
        height: min(560px, calc(100dvh - 96px));
        display: flex;
        flex-direction: column;
        border-radius: ${radius};
        overflow: hidden;
        background: #fff;
        color: #122033;
        box-shadow: 0 24px 70px rgba(16,24,40,.28);
        animation: ta-panel 320ms cubic-bezier(.22,1.15,.36,1);
      }
      .tpl-soft .panel { background: #fbfaf7; }
      .tpl-bar .panel { width: min(420px, calc(100vw - 16px)); }
      .thread {
        flex: 1; overflow-y: auto; padding: 14px; background: #f6f8fb;
        display: flex; flex-direction: column; gap: 8px; -webkit-overflow-scrolling: touch;
      }
      .tpl-soft .thread { background: #f3efe6; }
      .msg {
        max-width: 86%; border-radius: 16px; padding: 10px 12px;
        font: 500 14px/1.5 ui-sans-serif, system-ui;
        animation: ta-msg 280ms ease both;
      }
      .msg.agent { background: #fff; color: #122033; border-radius: 16px 16px 16px 6px; }
      .msg.visitor { margin-left: auto; background: ${color}; color: #fff; border-radius: 16px 16px 6px 16px; }
      .msg.dim { color: #64748b; }
      .sys {
        align-self: center; font: 500 11px/1.4 ui-sans-serif, system-ui; color: #64748b;
        background: #e8eef5; border-radius: 999px; padding: 4px 10px;
      }
      .composer {
        display: flex; gap: 8px; padding: 10px 10px calc(10px + env(safe-area-inset-bottom, 0px));
        border-top: 1px solid #e8eef5; background: #fff; align-items: center;
      }
      .box {
        flex: 1; border: 0; border-radius: 999px; background: #f1f5f9;
        padding: 11px 14px; font: 500 16px/1.3 ui-sans-serif, system-ui;
        outline: none; color: #122033; min-width: 0;
      }
      .go, .mic, .voice-tog {
        border: 0; border-radius: 999px; background: ${color}; color: #fff;
        padding: 0 14px; height: 40px; font: 650 12px/1 ui-sans-serif, system-ui; cursor: pointer;
      }
      .mic { padding: 0 12px; background: #0f172a; }
      .mic.live { background: #dc2626; }
      .voice-tog { background: rgba(255,255,255,.16); height: 32px; padding: 0 10px; }
      .voice-tog.on { background: #fff; color: ${color}; }
      .head {
        display: flex; align-items: center; gap: 10px;
        padding: 12px 12px 12px 14px; background: ${color}; color: #fff;
      }
      .ava { height: 38px; width: 38px; overflow: hidden; border-radius: 999px; background: rgba(255,255,255,.18); flex: none; }
      .meta { min-width: 0; flex: 1; }
      .nm { margin: 0; font: 650 14px/1.2 ui-sans-serif, system-ui; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .st { margin: 3px 0 0; font: 500 11px/1 ui-sans-serif, system-ui; opacity: .86; display: flex; align-items: center; gap: 6px; }
      .dot { height: 7px; width: 7px; border-radius: 999px; background: #86efac; }
      .x {
        margin-left: 4px; border: 0; background: transparent; color: #fff;
        font: 400 26px/1 ui-sans-serif, system-ui; cursor: pointer; width: 36px; height: 36px;
      }
      @media (max-width: 640px) {
        .panel:not([hidden]) {
          width: 100%;
          height: 100dvh;
          max-height: 100dvh;
          border-radius: 0;
        }
        .ta { height: 100%; }
        .launch { height: 56px; width: 56px; }
        .face { height: 56px; width: 56px; }
        .teaser { max-width: min(240px, calc(100vw - 80px)); }
      }
      @keyframes ta-in { to { opacity: 1; transform: none; } }
      @keyframes ta-pulse {
        0% { transform: scale(0.92); opacity: .5; }
        100% { transform: scale(1.18); opacity: 0; }
      }
      @keyframes ta-panel { from { opacity: 0; transform: translateY(10px); } }
      @keyframes ta-msg { from { opacity: 0; transform: translateY(6px); } }
    `;
  }
})();
