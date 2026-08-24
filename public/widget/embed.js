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
    const useGradient = Boolean(config.useGradient);
    const gradientTo = String(config.gradientTo || "#4F8CFF");
    const gradientAngle = String(config.gradientAngle || "to-bottom-right");
    const textColor = String(config.textColor || "#FFFFFF");
    const messageColor = String(config.messageColor || "#1E293B");
    const greeting = String(config.greeting || "Hi! How can I help you today?");
    const startName = String(config.name || "Assistant");
    const template = String(config.template || "CLASSIC").toUpperCase();
    const voiceOffered = Boolean(config.voiceEnabled);
    const voiceId = String(config.voiceId || "en-US-Neural2-F");
    const startAvatar = absoluteUrl(config.avatarUrl, origin);
    const startInitials = initialsOf(startName);
    let whatsappDigits = String(config.channels?.whatsapp?.digits || "");
    const host = document.documentElement || document.body;
    const storageKey = `tidyagent:${instance || site || "local"}`;
    let open = false;
    let maximized = false;

    const root = document.createElement("div");
    root.id = "tidyagent-widget-root";
    placeRoot();
    host.appendChild(root);

    const shadow = root.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${widgetCss({ color, left, template, useGradient, gradientTo, gradientAngle, textColor, messageColor })}</style>
      <div class="ta ${left ? "left" : "right"} tpl-${template.toLowerCase()}">
        <div class="panel" hidden>
          <div class="head">
            <button type="button" class="icon-btn hist" aria-label="Chat history">${iconChats()}</button>
          <div class="ava head-ava${startAvatar ? " has-photo" : ""}">${avatarMarkup(startAvatar, startInitials)}</div>
            <div class="meta">
              <p class="nm">${escapeHtml(startName)}</p>
              <p class="st"><span class="dot"></span> <span class="st-label">Online</span></p>
            </div>
            <button type="button" class="icon-btn new-head" title="New chat" aria-label="New chat">${iconNew()}</button>
            <button type="button" class="icon-btn grow" title="Larger chat" aria-label="Larger chat" aria-pressed="false">${iconGrow()}</button>
            ${voiceOffered ? `<button type="button" class="icon-btn voice-tog on" aria-pressed="true" title="Voice replies on">${iconWave()}</button>
            <button type="button" class="icon-btn voice-stop" hidden title="Stop listening">${iconStop()}</button>` : ""}
            <button type="button" class="icon-btn x" aria-label="Close chat">${iconClose()}</button>
          </div>
          <button type="button" class="wa-strip"${whatsappDigits ? "" : " hidden"} aria-label="Chat on WhatsApp">
            <span class="wa-mark">${iconWhatsApp()}</span>
            <span class="wa-copy"><strong>Chat on WhatsApp</strong><em>Message the team directly</em></span>
            <span class="wa-go">Open</span>
          </button>
          <div class="inbox" hidden>
            <div class="inbox-bar">
              <p>Your chats</p>
              <button type="button" class="new-chat">New chat</button>
            </div>
            <ul class="inbox-list"></ul>
          </div>
          <div class="thread"></div>
          <form class="composer">
            ${voiceOffered ? `<button type="button" class="mic" aria-label="Start voice message"><span class="mic-pulse"></span>${iconMic()}</button>` : ""}
            <input class="box" type="text" maxlength="1200" placeholder="Write a message" aria-label="Message" enterkeyhint="send" autocomplete="off">
            <button type="submit" class="go" aria-label="Send">${iconSend()}</button>
          </form>
          ${voiceOffered ? `<div class="listen" hidden>
            <button type="button" class="listen-x" aria-label="Cancel recording">${iconClose()}</button>
            <div class="listen-orb" aria-hidden="true"><span></span></div>
            <div class="listen-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
            <p class="listen-caption">Listening…</p>
            <button type="button" class="listen-go" aria-label="Send recording">${iconSend()}</button>
          </div>` : ""}
        </div>
        <div class="teaser" hidden>
          <button type="button" class="teaser-x" aria-label="Dismiss">${iconClose()}</button>
          <div class="teaser-ava${startAvatar ? " has-photo" : ""}">${avatarMarkup(startAvatar, startInitials)}</div>
          <div>
            <p class="teaser-label">${escapeHtml(startName)}</p>
            <p class="teaser-text"></p>
          </div>
        </div>
        <button type="button" class="launch${startAvatar ? " has-photo" : ""}" aria-label="Open chat" aria-expanded="false">
          <span class="ring"></span>
          ${template === "MINIMAL" ? `<span class="launch-copy">Chat</span>` : ""}
          <span class="face">${avatarMarkup(startAvatar, startInitials)}</span>
        </button>
      </div>
    `;

    const panel = shadow.querySelector(".panel");
    const teaser = shadow.querySelector(".teaser");
    const teaserText = shadow.querySelector(".teaser-text");
    const launch = shadow.querySelector(".launch");
    const close = shadow.querySelector(".x");
    const histBtn = shadow.querySelector(".hist");
    const inbox = shadow.querySelector(".inbox");
    const inboxList = shadow.querySelector(".inbox-list");
    const newChatBtn = shadow.querySelector(".new-chat");
    const newHeadBtn = shadow.querySelector(".new-head");
    const growBtn = shadow.querySelector(".grow");
    const thread = shadow.querySelector(".thread");
    const composer = shadow.querySelector(".composer");
    const box = shadow.querySelector(".box");
    const voiceTog = shadow.querySelector(".voice-tog");
    const voiceStop = shadow.querySelector(".voice-stop");
    const micBtn = shadow.querySelector(".mic");
    const listenDock = shadow.querySelector(".listen");
    const listenCaption = shadow.querySelector(".listen-caption");
    const listenCancel = shadow.querySelector(".listen-x");
    const listenSend = shadow.querySelector(".listen-go");
    const nameEl = shadow.querySelector(".nm");
    const statusEl = shadow.querySelector(".st-label");
    const headAva = shadow.querySelector(".head-ava");
    const waStrip = shadow.querySelector(".wa-strip");
    const waStripGo = shadow.querySelector(".wa-strip .wa-go");

    let typed = false;
    let teaserDismissed = false;
    let audioCtx = null;
    let voiceOn = voiceOffered;
    let listening = false;
    let recognition = null;
    let speakGen = 0;
    let currentAudio = null;
    let ttsAbort = null;
    let currentAgent = { id: config.id || "", name: startName, avatarUrl: startAvatar, role: "Assistant", initials: startInitials, voiceId };
    let conversationId = "";
    let pausedConv = "";
    let liveSocket = null;
    let liveClosed = false;
    let visitorId = readStore("vid");
    if (!visitorId) {
      visitorId = `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      writeStore("vid", visitorId);
    }
    const STALE_MS = 150000;
    const savedConv = readStore("conv") || "";
    const lastAt = Number(readStore("lastAt") || 0);
    if (savedConv && lastAt && Date.now() - lastAt > STALE_MS) {
      pausedConv = savedConv;
      conversationId = "";
      writeStore("paused", savedConv);
      writeStore("conv", "");
    } else {
      conversationId = savedConv;
      pausedConv = readStore("paused") || "";
    }

    seedGreeting();

    launch.addEventListener("click", () => {
      unlockAudio();
      setOpen(!open);
    });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      stopSpeech();
      setOpen(false);
    });
    shadow.querySelector(".teaser-x").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      teaserDismissed = true;
      teaser.setAttribute("hidden", "");
    });
    teaser.addEventListener("click", (event) => {
      if (event.target.closest(".teaser-x")) return;
      setOpen(true);
    });
    histBtn.addEventListener("click", () => {
      const showing = !inbox.hasAttribute("hidden");
      if (showing) inbox.setAttribute("hidden", "");
      else {
        inbox.removeAttribute("hidden");
        void renderInbox();
      }
    });
    newChatBtn.addEventListener("click", () => startNewChat());
    newHeadBtn?.addEventListener("click", () => startNewChat());
    growBtn?.addEventListener("click", () => {
      maximized = !maximized;
      panel.classList.toggle("wide", maximized);
      growBtn.setAttribute("aria-pressed", String(maximized));
      growBtn.title = maximized ? "Smaller chat" : "Larger chat";
      growBtn.setAttribute("aria-label", growBtn.title);
      growBtn.innerHTML = maximized ? iconShrink() : iconGrow();
      placeRoot();
    });
    waStrip?.addEventListener("click", () => void openWhatsApp(waStrip));
    let typingTimer = 0;
    box.addEventListener("input", () => {
      emitTyping(true);
      window.clearTimeout(typingTimer);
      typingTimer = window.setTimeout(() => emitTyping(false), 1400);
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
        voiceTog.title = voiceOn ? "Voice replies on" : "Voice replies off";
        if (!voiceOn) {
          stopSpeech();
          stopListen();
        }
      });
    }
    if (voiceStop) {
      voiceStop.addEventListener("click", () => stopSpeech());
    }
    if (micBtn) micBtn.addEventListener("click", () => (listening ? finishListen(false) : startListen()));
    listenCancel?.addEventListener("click", () => finishListen(false));
    listenSend?.addEventListener("click", () => finishListen(true));

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
      }, 500);
    });

    window.addEventListener("pointerdown", function unlock() {
      unlockAudio();
      window.removeEventListener("pointerdown", unlock, true);
    }, true);
    window.addEventListener("resize", placeRoot);

    function placeRoot() {
      const inset = 22;
      const wide = open && maximized;
      root.style.cssText = [
        "all:initial",
        "display:block",
        "position:fixed",
        "z-index:2147483646",
        `bottom:max(${inset}px, calc(env(safe-area-inset-bottom, 0px) + 16px))`,
        left
          ? `left:max(${inset}px, env(safe-area-inset-left, 0px));right:auto`
          : `right:max(${inset}px, env(safe-area-inset-right, 0px));left:auto`,
        wide ? "width:min(520px, calc(100vw - 44px))" : "width:min(372px, calc(100vw - 44px))",
        "max-width:calc(100vw - 44px)",
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
      if (open) launch.setAttribute("hidden", "");
      else launch.removeAttribute("hidden");
      placeRoot();
      if (open) {
        unlockAudio();
        if (conversationId) {
          void hydrateThread(conversationId);
          watchLive();
        } else {
          seedGreeting();
          if (pausedConv) showResumeBanner(pausedConv);
          if (voiceOn) void speak(greeting);
        }
        window.setTimeout(() => box.focus(), 60);
      } else {
        writeStore("lastAt", String(Date.now()));
        stopSpeech();
        stopListen();
        inbox.setAttribute("hidden", "");
      }
    }

    function setHeader(person) {
      currentAgent = {
        id: person.id || currentAgent.id || "",
        name: person.name || startName,
        avatarUrl: absoluteUrl(person.avatarUrl, origin) || startAvatar,
        role: person.role || person.specialty || "Assistant",
        initials: initialsOf(person.name || startName),
        voiceId: person.voiceId || currentAgent.voiceId || voiceId,
      };
      nameEl.textContent = currentAgent.name;
      statusEl.textContent = currentAgent.role;
      headAva.innerHTML = avatarMarkup(currentAgent.avatarUrl, currentAgent.initials);
      headAva.classList.toggle("has-photo", Boolean(currentAgent.avatarUrl));
    }

    function seedGreeting() {
      thread.innerHTML = "";
      addMsg("agent", greeting, { time: new Date(), agent: currentAgent, silent: true });
    }

    function addMsg(role, text, extra = {}) {
      const row = document.createElement("div");
      row.className = `row ${role}`;
      const time = extra.time ? new Date(extra.time) : new Date();
      const person = extra.agent || currentAgent;
      const cards = Array.isArray(extra.products) ? extra.products : [];
      if (role === "agent") {
        row.innerHTML = `<div class="ava sm${person.avatarUrl ? " has-photo" : ""}">${avatarMarkup(person.avatarUrl, person.initials || initialsOf(person.name))}</div>
          <div class="stack"><div class="who">${escapeHtml(person.name || "")}${person.human ? " · team" : ""}</div><div class="msg">${formatAgentHtml(text)}</div>${productCardsHtml(cards)}<time>${formatTime(time)}</time></div>`;
      } else {
        row.innerHTML = `<div class="stack"><div class="msg">${escapeHtml(text)}</div><time>${formatTime(time)}</time></div>`;
      }
      thread.appendChild(row);
      thread.scrollTop = thread.scrollHeight;
      if (!extra.silent) persistLocal(role, text, time);
    }

    async function sendChat(raw) {
      const text = String(raw || "").trim();
      if (!text || box.disabled) return;
      box.value = "";
      emitTyping(false);
      stopSpeech();
      playSendTick();
      addMsg("visitor", text);
      box.disabled = true;
      const thinking = document.createElement("div");
      thinking.className = "row agent";
        thinking.innerHTML = `<div class="ava sm${currentAgent.avatarUrl ? " has-photo" : ""}">${avatarMarkup(currentAgent.avatarUrl, currentAgent.initials)}</div><div class="stack"><div class="msg dim">Checking that for you…</div></div>`;
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
          writeStore("conv", conversationId);
          writeStore("paused", "");
          writeStore("lastAt", String(Date.now()));
          watchLive();
        }
        if (data.support?.whatsapp?.digits) {
          whatsappDigits = data.support.whatsapp.digits;
          showWhatsAppStrip(true);
        }
        if (data.wait && !data.wait.expired) {
          const to = data.wait.human ? personFrom(data.wait.human) : data.handoff?.to ? personFrom(data.handoff.to) : currentAgent;
          await playHandoff(data.handoff || { from: currentAgent, to });
          renderWait(to, data.wait.seconds || 75);
          watchLive();
        } else if (data.live && !data.text) {
          /* stored for the human */
        } else {
          const nextAgent = data.agent ? personFrom(data.agent) : currentAgent;
          const switched =
            Boolean(data.handoff?.to) ||
            (nextAgent.name && nextAgent.name !== currentAgent.name) ||
            (nextAgent.id && currentAgent.id && nextAgent.id !== currentAgent.id);
          if (switched) {
            await playHandoff(data.handoff || { from: currentAgent, to: nextAgent });
          } else if (data.agent?.name) {
            setHeader(data.agent);
          }
          if (data.text || data.error) {
            const reply = data.text || data.error || "I couldn’t reply just then. Please try again.";
            addMsg("agent", reply, {
              time: data.createdAt,
              agent: data.agent ? personFrom(data.agent) : currentAgent,
              products: data.products,
            });
            playReceiveTick();
            if (voiceOn) void speak(reply);
          }
          if (data.leadForm) offerHumanSupport(data.support);
        }
        saveInboxMeta(text);
      } catch {
        thinking.remove();
        addMsg("agent", "I couldn’t reach the team just then. Please try again.");
      } finally {
        box.disabled = false;
        box.focus();
      }
    }

    async function playHandoff(handoff) {
      const from = personFrom(handoff.from);
      const to = personFrom(handoff.to);
      const card = document.createElement("div");
      card.className = "xfer";
      card.innerHTML = `
        <div class="xfer-faces">
          <div class="ava${from.avatarUrl ? " has-photo" : ""}">${avatarMarkup(from.avatarUrl, from.initials)}</div>
          <span class="xfer-dots"><i></i><i></i><i></i></span>
          <div class="ava pulse${to.avatarUrl ? " has-photo" : ""}">${avatarMarkup(to.avatarUrl, to.initials)}</div>
        </div>
        <p class="xfer-title">Connecting you with <strong>${escapeHtml(to.name)}</strong></p>
        <p class="xfer-sub">${escapeHtml(to.human ? "Real team member" : to.role || "Specialist")} · <span class="xfer-sec">1s</span></p>
        <div class="xfer-bar"><span></span></div>`;
      thread.appendChild(card);
      thread.scrollTop = thread.scrollHeight;
      let secs = 1;
      const tick = window.setInterval(() => {
        secs += 1;
        const el = card.querySelector(".xfer-sec");
        if (el) el.textContent = `${secs}s`;
      }, 1000);
      await sleep(2400);
      window.clearInterval(tick);
      card.remove();
      setHeader(to);
      renderJoined(to);
    }

    function renderJoined(to) {
      const joined = document.createElement("div");
      joined.className = "joined";
      joined.innerHTML = `<span class="line"></span><div class="ava xs${to.avatarUrl ? " has-photo" : ""}">${avatarMarkup(to.avatarUrl, to.initials)}</div><span>${escapeHtml(to.name)} joined</span><span class="line"></span>`;
      thread.appendChild(joined);
      thread.scrollTop = thread.scrollHeight;
    }

    async function hydrateThread(id) {
      try {
        const response = await fetch(`${origin}/api/widget/threads?${params.toString()}&visitorId=${encodeURIComponent(visitorId)}&conversationId=${encodeURIComponent(id)}`);
        const data = await response.json();
        if (!data.messages?.length) return;
        thread.innerHTML = "";
        if (data.agent) setHeader(data.agent);
        let lastName = currentAgent.name;
        data.messages.forEach((item) => {
          if (item.kind === "handoff") {
            const to = personFrom(item.to || { name: item.agentName || item.text, avatarUrl: item.avatarUrl });
            renderJoined(to);
            setHeader(to);
            lastName = to.name;
            return;
          }
          const agentPerson = item.agentName
            ? personFrom({ name: item.agentName, avatarUrl: item.avatarUrl || currentAgent.avatarUrl, role: item.agentRole })
            : currentAgent;
          if (item.role !== "visitor" && agentPerson.name && agentPerson.name !== lastName) {
            renderJoined(agentPerson);
            lastName = agentPerson.name;
          }
          addMsg(item.role === "visitor" ? "visitor" : "agent", item.text, {
            time: item.createdAt,
            agent: agentPerson,
            silent: true,
          });
          if (item.role !== "visitor" && agentPerson.name) lastName = agentPerson.name;
        });
      } catch {
        /* keep local */
      }
    }

    async function renderInbox() {
      inboxList.innerHTML = `<li class="empty">Loading…</li>`;
      let threads = [];
      try {
        const response = await fetch(`${origin}/api/widget/threads?${params.toString()}&visitorId=${encodeURIComponent(visitorId)}`);
        const data = await response.json();
        threads = data.threads || [];
      } catch {
        threads = JSON.parse(readStore("inbox") || "[]");
      }
      if (!threads.length) {
        inboxList.innerHTML = `<li class="empty">No earlier chats yet.</li>`;
        return;
      }
      inboxList.innerHTML = threads
        .map(
          (item) => `<li data-id="${escapeAttr(item.id)}">
            <div class="ava sm">${avatarMarkup(item.agent?.avatarUrl, initialsOf(item.agent?.name || "AI"))}</div>
            <div><p class="t">${escapeHtml(item.title || "Conversation")}</p><p class="p">${escapeHtml(item.preview || "")}</p></div>
            <time>${relative(item.updatedAt)}</time>
          </li>`,
        )
        .join("");
      inboxList.querySelectorAll("li[data-id]").forEach((item) => {
        item.addEventListener("click", () => {
          conversationId = item.getAttribute("data-id");
          writeStore("conv", conversationId);
          writeStore("paused", "");
          writeStore("lastAt", String(Date.now()));
          pausedConv = "";
          inbox.setAttribute("hidden", "");
          void hydrateThread(conversationId);
          watchLive();
        });
      });
    }

    function startNewChat() {
      liveClosed = true;
      try {
        liveSocket?.close();
      } catch {
        /* ignore */
      }
      conversationId = "";
      pausedConv = "";
      writeStore("conv", "");
      writeStore("paused", "");
      writeStore("lastAt", String(Date.now()));
      inbox.setAttribute("hidden", "");
      stopSpeech();
      setHeader({ id: config.id, name: startName, avatarUrl: startAvatar, role: "Assistant", voiceId });
      seedGreeting();
    }

    function resumeAgentChat() {
      liveClosed = true;
      try {
        liveSocket?.close();
      } catch {
        /* ignore */
      }
      thread.querySelectorAll(".wait-card, .lead-form, .support-choice, .lead-success, .wa-ready").forEach((el) => el.remove());
      setHeader({ id: config.id, name: startName, avatarUrl: startAvatar, role: "Assistant", voiceId });
      addMsg("agent", "Thanks — I’m here if you have another question.", { agent: currentAgent });
      if (box) {
        box.disabled = false;
        window.setTimeout(() => box.focus(), 50);
      }
    }

    function showResumeBanner(id) {
      if (!id || thread.querySelector(".resume")) return;
      const bar = document.createElement("div");
      bar.className = "resume";
      bar.innerHTML = `<p>Welcome back — this is a new chat.</p><button type="button" class="resume-last">Open last chat</button>`;
      bar.querySelector(".resume-last").addEventListener("click", () => {
        conversationId = id;
        pausedConv = "";
        writeStore("conv", conversationId);
        writeStore("paused", "");
        writeStore("lastAt", String(Date.now()));
        bar.remove();
        void hydrateThread(conversationId);
        watchLive();
      });
      thread.prepend(bar);
    }

    function setTyping(on, who) {
      window.clearTimeout(setTyping.hide);
      thread.querySelectorAll(".typing-row").forEach((el) => el.remove());
      if (!on) return;
      const row = document.createElement("div");
      row.className = "row agent typing-row";
      const person = currentAgent;
      row.innerHTML = `<div class="ava sm${person.avatarUrl ? " has-photo" : ""}">${avatarMarkup(person.avatarUrl, person.initials)}</div>
        <div class="stack">
          <div class="typing">
            <span class="typing-dots"><i></i><i></i><i></i></span>
            <span class="typing-label">${escapeHtml(who || person.name || "Team")} is typing</span>
          </div>
        </div>`;
      thread.appendChild(row);
      thread.scrollTop = thread.scrollHeight;
      setTyping.hide = window.setTimeout(() => setTyping(false), 4000);
    }

    function emitTyping(on) {
      if (!liveSocket || liveSocket.readyState !== 1 || !conversationId) return;
      try {
        liveSocket.send(JSON.stringify({ type: "typing", conversationId, typing: Boolean(on), name: "Visitor" }));
      } catch {
        /* ignore */
      }
    }

    function saveInboxMeta(lastVisitor) {
      const rows = JSON.parse(readStore("inbox") || "[]").filter((row) => row.id !== conversationId);
      rows.unshift({
        id: conversationId,
        title: lastVisitor.slice(0, 42),
        preview: lastVisitor.slice(0, 80),
        updatedAt: new Date().toISOString(),
        agent: { name: currentAgent.name, avatarUrl: currentAgent.avatarUrl },
      });
      writeStore("inbox", JSON.stringify(rows.slice(0, 24)));
    }

    let voiceDraft = "";
    const voiceLang = String(config.voiceId || "en-US").match(/^[a-z]{2}-[A-Z]{2}/)?.[0] || "en-US";

    function setListenUi(on) {
      if (!listenDock) return;
      if (on) {
        composer.setAttribute("hidden", "");
        listenDock.removeAttribute("hidden");
        micBtn?.classList.add("live");
      } else {
        listenDock.setAttribute("hidden", "");
        composer.removeAttribute("hidden");
        micBtn?.classList.remove("live");
        if (listenCaption) listenCaption.textContent = "Listening…";
      }
    }

    function startListen() {
      const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) {
        addNotice("Voice typing isn’t available in this browser. You can still type.");
        return;
      }
      stopSpeech();
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      voiceDraft = "";
      recognition = new Rec();
      recognition.lang = voiceLang;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let interim = "";
        let finalBit = "";
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const piece = event.results[i][0]?.transcript || "";
          if (event.results[i].isFinal) finalBit += `${piece} `;
          else interim += piece;
        }
        if (finalBit) voiceDraft = `${voiceDraft} ${finalBit}`.replace(/\s+/g, " ").trim();
        const shown = `${voiceDraft} ${interim}`.replace(/\s+/g, " ").trim();
        if (listenCaption) listenCaption.textContent = shown || "Listening…";
        if (shown) box.value = shown;
      };
      recognition.onerror = () => finishListen(Boolean(voiceDraft));
      recognition.onend = () => {
        if (listening) finishListen(Boolean(voiceDraft || box.value.trim()));
      };
      try {
        recognition.start();
      } catch {
        addNotice("Could not start the microphone. Check browser permission.");
        return;
      }
      listening = true;
      setListenUi(true);
    }

    function finishListen(sendIt) {
      listening = false;
      try {
        recognition?.stop();
      } catch {
        /* ignore */
      }
      recognition = null;
      setListenUi(false);
      const text = (voiceDraft || String(box.value || "")).replace(/\s+/g, " ").trim();
      voiceDraft = "";
      if (sendIt && text) void sendChat(text);
    }

    function stopListen() {
      finishListen(false);
    }

    function setSpeaking(on) {
      if (!voiceStop) return;
      if (on) voiceStop.removeAttribute("hidden");
      else voiceStop.setAttribute("hidden", "");
    }

    function stopSpeech() {
      speakGen += 1;
      setSpeaking(false);
      try {
        ttsAbort?.abort();
      } catch {
        /* ignore */
      }
      ttsAbort = null;
      if (currentAudio) {
        try {
          currentAudio.pause();
          currentAudio.src = "";
        } catch {
          /* ignore */
        }
        currentAudio = null;
      }
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* ignore */
      }
    }

    async function speak(text) {
      if (!voiceOn || !text) return;
      stopSpeech();
      const gen = speakGen;
      const controller = new AbortController();
      ttsAbort = controller;
      try {
        const response = await fetch(`${origin}/api/widget/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: String(text).slice(0, 600),
            token,
            instanceId: instance,
            site,
            voiceId: currentAgent.voiceId || voiceId,
          }),
          signal: controller.signal,
        });
        if (gen !== speakGen) return;
        if (!response.ok) throw new Error("tts");
        const blob = await response.blob();
        if (gen !== speakGen) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          if (gen === speakGen) setSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          if (currentAudio === audio) currentAudio = null;
          if (gen === speakGen) setSpeaking(false);
        };
        setSpeaking(true);
        await audio.play();
      } catch (error) {
        if (gen !== speakGen || error?.name === "AbortError") return;
        try {
          const utter = new SpeechSynthesisUtterance(String(text).slice(0, 600));
          utter.onend = () => {
            if (gen === speakGen) setSpeaking(false);
          };
          window.speechSynthesis.cancel();
          setSpeaking(true);
          window.speechSynthesis.speak(utter);
        } catch {
          setSpeaking(false);
        }
      }
    }

    function addNotice(text) {
      const node = document.createElement("div");
      node.className = "notice";
      node.textContent = text;
      thread.appendChild(node);
    }

    function personFrom(row) {
      return {
        id: row?.id || "",
        name: row?.name || startName,
        avatarUrl: absoluteUrl(row?.avatarUrl, origin),
        role: row?.role || row?.specialty || "Assistant",
        initials: initialsOf(row?.name || startName),
        voiceId: row?.voiceId || voiceId,
        human: Boolean(row?.human),
      };
    }

    function productCardsHtml(cards) {
      if (!Array.isArray(cards) || !cards.length) return "";
      return `<div class="cards">${cards
        .slice(0, 4)
        .map((card) => {
          const photo = card.imageUrl
            ? `<div class="card-photo"><img src="${escapeAttr(card.imageUrl)}" alt=""></div>`
            : `<div class="card-mark"><span>${escapeHtml((card.name || "•").trim().charAt(0).toUpperCase())}</span><em>From the site</em></div>`;
          const body = `${photo}<div class="card-copy"><p class="card-name">${escapeHtml(card.name || "")}</p>${card.price ? `<p class="card-price">${escapeHtml(card.price)}</p>` : ""}</div>`;
          return card.url
            ? `<a class="card" href="${escapeAttr(card.url)}" target="_blank" rel="noreferrer">${body}</a>`
            : `<div class="card">${body}</div>`;
        })
        .join("")}</div>`;
    }

    const seenLive = new Set();
    function renderWait(person, seconds) {
      thread.querySelectorAll(".wait-card").forEach((el) => el.remove());
      const card = document.createElement("div");
      card.className = "wait-card";
      card.innerHTML = `<div class="wait-ring"><span>${seconds}s</span></div><p class="wait-title">Finding ${escapeHtml(person.name)}</p><p class="wait-sub">A real teammate is being notified. Stay here — they’ll join this chat.</p>`;
      thread.appendChild(card);
      thread.scrollTop = thread.scrollHeight;
      const started = Date.now();
      const tick = window.setInterval(() => {
        const left = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
        const label = card.querySelector(".wait-ring span");
        if (label) label.textContent = `${left}s`;
        if (left <= 0) window.clearInterval(tick);
      }, 250);
    }
    function watchLive() {
      liveClosed = false;
      try {
        liveSocket?.close();
      } catch {
        /* ignore */
      }
      const connect = () => {
        if (liveClosed || !conversationId) return;
        const proto = origin.startsWith("https") ? "wss:" : "ws:";
        const host = origin.replace(/^https?:\/\//, "");
        const params = new URLSearchParams({
          role: "visitor",
          conversationId,
          token: token || "",
          instanceId: instance || "",
          site: site || "",
        });
        const socket = new WebSocket(`${proto}//${host}/realtime?${params.toString()}`);
        liveSocket = socket;
        socket.onmessage = (event) => {
          let data = {};
          try {
            data = JSON.parse(event.data);
          } catch {
            return;
          }
          if (data.type === "typing") {
            const typing = Boolean(data.payload?.typing);
            const who = String(data.payload?.name || "");
            if (who === "Visitor") return;
            setTyping(typing, currentAgent.name);
          }
          if (data.type === "joined" && data.payload?.human) {
            thread.querySelectorAll(".wait-card").forEach((el) => el.remove());
            const person = personFrom(data.payload.human);
            setHeader(data.payload.human);
            if (!thread.querySelector(".joined")) {
              const joined = document.createElement("div");
              joined.className = "joined";
              joined.innerHTML = `<span class="line"></span><div class="ava xs${person.avatarUrl ? " has-photo" : ""}">${avatarMarkup(person.avatarUrl, person.initials)}</div><span>${escapeHtml(person.name)} joined</span><span class="line"></span>`;
              thread.appendChild(joined);
            }
          }
          if (data.type === "message" && data.payload?.message) {
            const message = data.payload.message;
            if (seenLive.has(message.id) || message.role === "CUSTOMER") return;
            seenLive.add(message.id);
            thread.querySelectorAll(".wait-card").forEach((el) => el.remove());
            setTyping(false);
            addMsg("agent", message.text, { time: message.at, agent: data.payload.human ? personFrom(data.payload.human) : currentAgent });
            playReceiveTick();
          }
          if (data.type === "expired") {
            liveClosed = true;
            thread.querySelectorAll(".wait-card").forEach((el) => el.remove());
            offerHumanSupport();
            socket.close();
          }
        };
        socket.onclose = () => {
          if (!liveClosed) window.setTimeout(connect, 1500);
        };
      };
      connect();
    }

    function offerHumanSupport(support) {
      const digits = (support && support.whatsapp && support.whatsapp.digits) || whatsappDigits;
      if (digits) {
        whatsappDigits = digits;
        showWhatsAppStrip(true);
        renderSupportChoice();
        return;
      }
      renderLeadForm();
    }

    function showWhatsAppStrip(on) {
      if (!waStrip) return;
      if (on && whatsappDigits) waStrip.removeAttribute("hidden");
      else waStrip.setAttribute("hidden", "");
    }

    function directWhatsAppUrl() {
      return `https://wa.me/${whatsappDigits}?text=${encodeURIComponent("Hi, I was on the website and would like to chat.")}`;
    }

    function supportCardOpen() {
      return Boolean(thread.querySelector(".lead-form, .support-choice, .lead-success, .wa-ready"));
    }

    function renderSupportChoice() {
      if (supportCardOpen()) return;
      const wrap = document.createElement("div");
      wrap.className = "support-choice";
      wrap.innerHTML = `
        <p class="lead-kicker">Human support</p>
        <p class="lead-heading">How would you like to get help from our team?</p>
        <p class="lead-copy">Choose how a teammate should pick this up. Your chat here stays saved.</p>
        <button type="button" class="support-opt" data-opt="form">
          <span class="opt-mark mail">✉</span>
          <span class="opt-copy">
            <strong>Submit a support request</strong>
            <span>Leave your details. The team will follow up by email.</span>
          </span>
        </button>
        <button type="button" class="support-opt wa" data-opt="whatsapp">
          <span class="opt-mark wa-mark">${iconWhatsApp()}</span>
          <span class="opt-copy">
            <strong>Continue on WhatsApp</strong>
            <span>Opens WhatsApp with a short summary. You review and send it.</span>
          </span>
        </button>
        <p class="lead-error" hidden></p>`;
      wrap.querySelectorAll("[data-opt]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const opt = btn.getAttribute("data-opt");
          if (opt === "form") {
            wrap.remove();
            renderLeadForm(true);
            return;
          }
          void openWhatsApp(wrap);
        });
      });
      thread.appendChild(wrap);
      thread.scrollTop = thread.scrollHeight;
    }

    async function openWhatsApp(host) {
      const fromStrip = host && host.classList.contains("wa-strip");
      if (host && host.dataset.busy === "1") return;
      if (!whatsappDigits) return;
      if (host) host.dataset.busy = "1";
      if (fromStrip && waStripGo) waStripGo.textContent = "Opening…";
      const errorEl = host && !fromStrip ? host.querySelector(".lead-error") : null;
      const waBtn = host && !fromStrip ? host.querySelector('[data-opt="whatsapp"]') : null;
      if (waBtn) waBtn.disabled = true;
      if (errorEl) errorEl.hidden = true;
      const fallback = directWhatsAppUrl();
      try {
        if (!conversationId) {
          window.open(fallback, "_blank", "noopener,noreferrer");
          return;
        }
        const response = await fetch(`${origin}/api/widget/whatsapp-handoff`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            token,
            instanceId: instance,
            site,
          }),
        });
        const data = await response.json().catch(() => ({}));
        const url = data.url || fallback;
        window.open(url, "_blank", "noopener,noreferrer");
        if (fromStrip) return;
        if (host) {
          host.className = "wa-ready";
          host.innerHTML = `
            <div class="lead-check wa">✓</div>
            <p class="lead-heading">WhatsApp is ready</p>
            <p class="lead-copy">A short summary of this chat is pre-filled. Review it, then send it yourself. This website conversation stays here.</p>
            <button type="button" class="lead-submit">Back to chat</button>`;
          host.querySelector("button").addEventListener("click", () => {
            host.remove();
            resumeAgentChat();
          });
        }
      } catch {
        window.open(fallback, "_blank", "noopener,noreferrer");
        if (errorEl) {
          errorEl.hidden = false;
          errorEl.textContent = "Opened WhatsApp. You can send the message from there.";
        }
      } finally {
        if (host) host.dataset.busy = "";
        if (fromStrip && waStripGo) waStripGo.textContent = "Open";
        if (waBtn) waBtn.disabled = false;
      }
    }

    function renderLeadForm(fromChoice) {
      if (thread.querySelector(".lead-form, .lead-success")) return;
      thread.querySelectorAll(".support-choice").forEach((el) => el.remove());
      const wrap = document.createElement("form");
      wrap.className = "lead-form";
      wrap.innerHTML = `
        <div class="lead-head">
          <span class="lead-icon">✉</span>
          <div>
            <p class="lead-kicker">Support request</p>
            <p class="lead-heading">Send a note to the team</p>
            <p class="lead-copy">We’ll follow up using the details you leave here.</p>
          </div>
        </div>
        <label><span>Name</span><input name="name" autocomplete="name" placeholder="Your name"><em></em></label>
        <label><span>Email</span><input name="email" type="email" autocomplete="email" placeholder="you@email.com"><em></em></label>
        <label><span>Phone (optional)</span><input name="phone" autocomplete="tel" placeholder="Mobile number"><em></em></label>
        <label><span>How can we help?</span><textarea name="note" rows="3" maxlength="800" placeholder="A short note about what you need"></textarea><em></em></label>
        <p class="lead-error" hidden></p>
        <button type="submit" class="lead-submit">Send to the team</button>
        ${fromChoice && whatsappDigits ? `<button type="button" class="lead-back">← Back to options</button>` : ""}`;
      const back = wrap.querySelector(".lead-back");
      if (back) {
        back.addEventListener("click", () => {
          wrap.remove();
          renderSupportChoice();
        });
      }
      wrap.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (wrap.dataset.busy === "1") return;
        const form = new FormData(wrap);
        const name = String(form.get("name") || "").trim();
        const email = String(form.get("email") || "").trim();
        const phone = String(form.get("phone") || "").trim();
        const note = String(form.get("note") || "").trim();
        const errors = {};
        if (name.length < 2) errors.name = "Please enter your name.";
        if (name.length > 80) errors.name = "Name is too long.";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) errors.email = "Enter a valid email address.";
        if (phone.length > 40) errors.phone = "Phone number is too long.";
        if (note.length > 800) errors.note = "Please keep this under 800 characters.";
        wrap.querySelectorAll("label").forEach((label) => {
          const field = label.querySelector("input, textarea");
          const hint = label.querySelector("em");
          const key = field && field.getAttribute("name");
          const message = key ? errors[key] : "";
          label.classList.toggle("invalid", Boolean(message));
          if (hint) hint.textContent = message || "";
        });
        const formError = wrap.querySelector(".lead-error");
        if (formError) formError.hidden = true;
        if (Object.keys(errors).length) return;
        wrap.dataset.busy = "1";
        const btn = wrap.querySelector(".lead-submit");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Sending…";
        }
        wrap.querySelectorAll("input, textarea, button").forEach((el) => {
          if (el !== btn && !el.classList.contains("lead-back")) el.disabled = true;
        });
        try {
          const response = await fetch(`${origin}/api/widget/lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId,
              name,
              email,
              phone,
              note,
              token,
              instanceId: instance,
              site,
            }),
          });
          const data = await response.json().catch(() => ({}));
          if (response.ok) {
            wrap.className = "lead-success";
            wrap.innerHTML = `
              <div class="lead-check">✓</div>
              <p class="lead-heading">Request received</p>
              <p class="lead-copy">Your support request was submitted. The team has your details and will follow up by email.</p>
              <p class="lead-copy muted">You can keep chatting here if you have more to add.</p>
              <button type="button" class="lead-submit">Continue chatting</button>`;
            wrap.querySelector("button").addEventListener("click", () => {
              wrap.remove();
              resumeAgentChat();
            });
            return;
          }
          if (formError) {
            formError.hidden = false;
            formError.textContent = data.error || "Check the highlighted fields and try again.";
          }
        } catch {
          if (formError) {
            formError.hidden = false;
            formError.textContent = "Could not send just then. Please try again.";
          }
        } finally {
          wrap.dataset.busy = "";
          wrap.querySelectorAll("input, textarea, button").forEach((el) => {
            el.disabled = false;
          });
          if (btn && wrap.classList.contains("lead-form")) {
            btn.disabled = false;
            btn.textContent = "Send to the team";
          }
        }
      });
      thread.appendChild(wrap);
      thread.scrollTop = thread.scrollHeight;
    }

    function readStore(suffix) {
      try {
        return window.localStorage.getItem(`${storageKey}:${suffix}`) || "";
      } catch {
        return "";
      }
    }
    function writeStore(suffix, value) {
      try {
        window.localStorage.setItem(`${storageKey}:${suffix}`, value);
      } catch {
        /* ignore */
      }
    }
    function persistLocal() {}

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
    function tone(freq, dur, type = "sine", gain = 0.06) {
      unlockAudio();
      if (!audioCtx) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const amp = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(amp);
      amp.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }
    function playPopupSound() {
      tone(740, 0.14);
      window.setTimeout(() => tone(988, 0.18, "triangle", 0.05), 70);
    }
    function playSendTick() {
      tone(1400, 0.06, "square", 0.04);
    }
    function playReceiveTick() {
      tone(660, 0.08);
      window.setTimeout(() => tone(880, 0.1, "triangle", 0.04), 50);
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function typeTeaser(el, text, done) {
    const value = text.length > 88 ? `${text.slice(0, 88).trim()}…` : text;
    el.textContent = "";
    let i = 0;
    const tick = () => {
      i += 1;
      el.textContent = value.slice(0, i);
      if (i < value.length) window.setTimeout(tick, 16 + Math.random() * 20);
      else done();
    };
    tick();
  }

  function formatTime(date) {
    try {
      return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
    } catch {
      return "";
    }
  }

  function relative(value) {
    const then = new Date(value).getTime();
    const diff = Date.now() - then;
    if (diff < 60000) return "now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    return `${Math.floor(diff / 86400000)}d`;
  }

  function initialsOf(name) {
    return String(name || "AI")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join("") || "AI";
  }

  function avatarMarkup(url, initials) {
    if (url) return `<img src="${escapeAttr(url)}" alt="" referrerpolicy="no-referrer">`;
    return `<span class="fallback">${escapeHtml(initials || "AI")}</span>`;
  }

  function absoluteUrl(value, appOrigin) {
    if (!value || typeof value !== "string") return "";
    if (value.startsWith("//")) return `https:${value}`;
    if (value.startsWith("/")) return `${appOrigin}${value}`;
    if (value.startsWith("http://")) return `https://${value.slice(7)}`;
    return value;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function linkLabel(href, preferred) {
    const label = String(preferred || "").trim();
    if (label && !/https?:\/\/|www\.|\.[a-z]{2,}(\/|$)/i.test(label) && label.length <= 48) return label;
    try {
      const url = new URL(href.startsWith("http") ? href : `https://${href}`);
      const hay = `${url.hostname} ${url.pathname} ${url.search}`.toLowerCase();
      if (/book|reserv|appoint|schedule|subscriber/.test(hay)) return "book here";
      if (/pric|rate|package|offer/.test(hay)) return "see prices";
      if (/contact/.test(hay)) return "contact us";
      if (/about/.test(hay)) return "about page";
      if (/product|store|shop|catalog|menu/.test(hay)) return "view this";
      return "this link";
    } catch {
      return "this link";
    }
  }
  function rewriteChatLinks(text) {
    const placeholders = [];
    let next = String(text || "").replace(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/gi, (_, label, url) => {
      const token = `%%LINK${placeholders.length}%%`;
      placeholders.push({ label: linkLabel(url, label), href: url.replace(/[.,;:!?]+$/g, "") });
      return token;
    });
    next = next.replace(/https?:\/\/[^\s)<>"']+|www\.[^\s)<>"']+/gi, (raw) => {
      const href = (raw.startsWith("www.") ? `https://${raw}` : raw).replace(/[.,;:!?]+$/g, "");
      const token = `%%LINK${placeholders.length}%%`;
      placeholders.push({ label: linkLabel(href), href });
      return token;
    });
    next = next
      .replace(/\b(?:visit|see|open|go to|check(?: out)?)\s+(?:our\s+)?(?:booking page|website|site|page)?\s*(?:online\s*)?(?:at|:)?\s*(%%LINK\d+%%)/gi, "$1")
      .replace(/\s+(?:at|here)\s*[:.]?\s*(%%LINK\d+%%)/gi, " $1")
      .replace(/\s{2,}/g, " ");
    return { text: next, placeholders };
  }
  function inlineMd(value) {
    const rewritten = rewriteChatLinks(value);
    return escapeHtml(rewritten.text)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/%%LINK(\d+)%%/g, (_, index) => {
        const item = rewritten.placeholders[Number(index)];
        if (!item) return "";
        return `<a href="${escapeAttr(item.href)}" target="_blank" rel="noreferrer">${escapeHtml(item.label)}</a>`;
      });
  }
  function formatAgentHtml(value) {
    const raw = String(value || "").replace(/\r/g, "").trim();
    if (!raw) return "";
    return raw.split(/\n{2,}/).map((block) => {
      const lines = block.split("\n");
      const listStart = lines.findIndex((line) => /^\s*[-*•]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line));
      if (listStart < 0) return `<p>${inlineMd(block).replace(/\n/g, "<br>")}</p>`;
      const intro = lines.slice(0, listStart).join(" ").trim();
      const items = lines
        .slice(listStart)
        .map((line) => line.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim())
        .filter(Boolean);
      return `${intro ? `<p>${inlineMd(intro)}</p>` : ""}<ul>${items.map((item) => `<li>${inlineMd(item)}</li>`).join("")}</ul>`;
    }).join("");
  }
  function gradientCss(from, to, angle) {
    if (angle === "radial") return `radial-gradient(circle at 18% 18%, ${from} 0%, ${to} 82%)`;
    const deg = angle === "to-right" ? "90deg" : angle === "to-bottom" ? "180deg" : angle === "to-bottom-left" ? "225deg" : "135deg";
    return `linear-gradient(${deg}, ${from} 0%, ${to} 100%)`;
  }
  function escapeAttr(value) {
    return escapeHtml(value).replace(/'/g, "&#39;");
  }

  function iconMic() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></svg>`;
  }
  function iconSend() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.4 20.6 21 12 3.4 3.4 3 10l11 2-11 2z"/></svg>`;
  }
  function iconClose() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
  }
  function iconChats() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 6h10v8H8l-3 3V6z"/><path d="M9 4h10v10"/></svg>`;
  }
  function iconNew() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/><path d="M4 7h8a4 4 0 0 1 4 4v8" opacity=".35"/></svg>`;
  }
  function iconGrow() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M21 15v6h-6"/></svg>`;
  }
  function iconShrink() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 9H3V3M15 9h6V3M9 15H3v6M21 15v6h-6"/></svg>`;
  }
  function iconWave() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="9" width="2.4" height="6" rx="1"/><rect x="8.5" y="6" width="2.4" height="12" rx="1"/><rect x="13" y="8" width="2.4" height="8" rx="1"/><rect x="17.5" y="5" width="2.4" height="14" rx="1"/></svg>`;
  }
  function iconStop() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  }
  function iconWhatsApp() {
    return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.5 2 2.01 6.48 2.01 12.02c0 1.77.46 3.45 1.28 4.91L2 22l5.2-1.26A9.96 9.96 0 0 0 12.04 22C17.57 22 22 17.52 22 11.98 22 6.48 17.57 2 12.04 2zm5.46 14.56c-.23.64-1.33 1.18-1.84 1.26-.47.07-1.06.1-1.71-.11-.4-.12-.9-.3-1.55-.58-2.73-1.18-4.5-3.94-4.64-4.12-.13-.18-1.1-1.46-1.1-2.79 0-1.32.69-1.97.94-2.24.24-.26.53-.33.7-.33h.51c.16 0 .38-.06.6.46.23.54.78 1.87.85 2 .07.13.11.28.02.46-.09.18-.13.28-.26.44-.13.15-.27.34-.39.46-.13.13-.26.26-.11.51.15.26.67 1.1 1.44 1.78 1 .88 1.83 1.16 2.09 1.29.26.13.41.11.56-.07.16-.18.66-.77.84-1.03.18-.26.35-.22.6-.13.24.09 1.54.73 1.8.86.27.13.44.2.51.31.07.13.07.73-.16 1.37z"/></svg>`;
  }

  function widgetCss({ color, left, template, useGradient, gradientTo, gradientAngle, textColor, messageColor }) {
    const noir = template === "MINIMAL";
    const atelier = template === "SOFT";
    const dock = template === "BAR";
    const fill = useGradient ? gradientCss(color, gradientTo, gradientAngle) : color;
    const ink = noir && String(messageColor).toUpperCase() === "#1E293B" ? "#e8edf5" : messageColor;
    const paper = noir ? "#101826" : atelier ? "#f7f1e6" : "#fff";
    const threadBg = noir ? "#0b1220" : atelier ? "#efe6d6" : dock ? "#ece5dd" : "#f4f7fb";
    const radius = dock ? "20px 20px 0 0" : atelier ? "28px" : noir ? "16px" : "22px";
    const headBg = useGradient || template === "CLASSIC" ? fill : noir ? "rgba(16,24,38,.92)" : dock ? "#075e54" : atelier ? "#2c241c" : fill;
    return `
      :host { all: initial; }
      * { box-sizing: border-box; }
      [hidden] { display: none !important; }
      .ta { display:flex; flex-direction:column; align-items:${left ? "flex-start" : "flex-end"}; gap:10px; pointer-events:none; font-family:${atelier ? "Georgia, 'Times New Roman', serif" : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'}; width:100%; }
      .ta > * { pointer-events: auto; }
      .launch {
        position:relative; height:${noir ? "44px" : "56px"}; ${noir ? "width:auto; padding:0 8px 0 6px; gap:8px; display:flex; align-items:center;" : "width:56px;"}
        border:0; border-radius:999px; cursor:pointer; background:${noir ? "#0b1220" : fill}; color:${textColor};
        box-shadow:0 18px 40px rgba(16,24,40,.28); opacity:0; transform:translateY(12px) scale(.92);
      }
      .launch.in { animation: ta-in 480ms cubic-bezier(.22,1.2,.36,1) forwards; }
      .launch-copy { font:650 13px/1 ui-sans-serif,system-ui; padding-right:10px; letter-spacing:.04em; }
      .launch.has-photo { background: transparent; padding: 0; }
      .launch.has-photo .face { height: 100%; width: 100%; }
      .face, .head-ava, .ava, .teaser-ava { position: relative; overflow: hidden; }
      .face, .face img, .ava img, .head-ava img, .teaser-ava img { display:block; height:100%; width:100%; border-radius:999px; object-fit:cover; }
      .face img, .ava img, .head-ava img, .teaser-ava img { position:absolute; inset:0; }
      .face { overflow:hidden; height:${noir ? "32px" : "56px"}; width:${noir ? "32px" : "56px"}; }
      .fallback { display:flex; height:100%; width:100%; align-items:center; justify-content:center; font:700 13px/1 ui-sans-serif,system-ui; }
      .ring { position:absolute; inset:-7px; border-radius:999px; border:2px solid ${color}; opacity:.4; animation:ta-pulse 2.4s ease-out infinite; pointer-events:none; ${noir ? "display:none;" : ""} }
      .launch.has-photo .ring { inset:-6px; }
      .teaser {
        display:flex; gap:10px; align-items:flex-start; max-width:min(240px, calc(100vw - 84px));
        background:${atelier ? "#fffaf2" : "#fff"}; color:#122033; padding:12px 32px 12px 12px; cursor:pointer; position:relative;
        border-radius:${left ? "20px 20px 20px 6px" : "20px 20px 6px 20px"};
        box-shadow:0 20px 50px rgba(16,24,40,.18);
      }
      .teaser-ava, .teaser-ava img { height:36px; width:36px; border-radius:999px; overflow:hidden; flex:none; }
      .teaser-x { position:absolute; top:6px; right:8px; border:0; background:transparent; color:#94a3b8; width:22px; height:22px; padding:0; cursor:pointer; }
      .teaser-x svg { width:14px; height:14px; }
      .teaser-label { margin:0 0 3px; font:650 10px/1.2 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase; color:${color}; }
      .teaser-text { margin:0; font:500 14px/1.45 ui-sans-serif,system-ui; }
      .panel {
        width: 100%;
        height: min(520px, calc(100dvh - 56px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px)));
        max-height: calc(100dvh - 48px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px));
        min-height: 260px;
        display:flex; flex-direction:column; border-radius:${radius}; overflow:hidden; position:relative;
        background:${paper}; color:${ink}; box-shadow: ${noir ? "0 0 0 1px rgba(255,255,255,.08), 0 30px 80px rgba(0,0,0,.45)" : "0 30px 80px rgba(16,24,40,.28)"};
        animation: ta-panel 340ms cubic-bezier(.22,1.15,.36,1);
      }
      .panel.wide {
        height: min(82dvh, 720px);
        max-height: calc(100dvh - 48px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px));
      }
      .tpl-bar .panel { align-self: stretch; }
      .head { display:flex; align-items:center; gap:8px; padding:10px; background:${headBg}; color:${textColor}; backdrop-filter: blur(16px); flex:none; }
      .tpl-soft .head { padding:14px 12px 16px; }
      .wa-strip { display:flex; align-items:center; gap:10px; width:100%; border:0; flex:none; padding:8px 12px; background:linear-gradient(135deg,#25D366,#1EBE57); color:#fff; cursor:pointer; text-align:left; box-shadow:inset 0 1px 0 rgba(255,255,255,.2); }
      .wa-strip[hidden] { display:none !important; }
      .wa-strip:hover { filter:brightness(1.04); }
      .wa-strip:disabled { opacity:.75; }
      .wa-mark { height:32px; width:32px; border-radius:999px; display:grid; place-items:center; background:#fff; color:#25D366; flex:none; box-shadow:0 4px 10px rgba(16,24,40,.08); }
      .wa-mark svg { width:18px; height:18px; display:block; }
      .wa-copy { min-width:0; flex:1; }
      .wa-copy strong { display:block; font:700 12px/1.2 ui-sans-serif,system-ui; }
      .wa-copy em { display:block; margin-top:2px; font:500 10px/1.2 ui-sans-serif,system-ui; font-style:normal; opacity:.92; }
      .wa-go { flex:none; border-radius:999px; background:rgba(255,255,255,.2); padding:6px 10px; font:700 10px/1 ui-sans-serif,system-ui; letter-spacing:.04em; }
      .head-ava, .ava { height:36px; width:36px; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.18); flex:none; }
      .head-ava.has-photo, .ava.has-photo, .face:has(img), .teaser-ava:has(img) { background: transparent; }
      .ava.sm { height:26px; width:26px; }
      .ava.xs { height:18px; width:18px; }
      .ava.pulse { box-shadow:0 0 0 0 rgba(255,255,255,.6); animation: ta-ava 1.2s ease-out infinite; }
      .meta { min-width:0; flex:1; }
      .nm { margin:0; font:650 12px/1.2 ui-sans-serif,system-ui; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${textColor}; }
      .tpl-soft .nm { font-family: Georgia, serif; font-size:15px; }
      .st { margin:3px 0 0; font:500 11px/1 ui-sans-serif,system-ui; opacity:.86; display:flex; align-items:center; gap:6px; color:${textColor}; }
      .dot { height:7px; width:7px; border-radius:999px; background:#86efac; }
      .icon-btn { border:0; background:rgba(255,255,255,.1); color:${textColor}; width:32px; height:32px; border-radius:11px; display:grid; place-items:center; cursor:pointer; flex:none; }
      .icon-btn svg { width:16px; height:16px; }
      .icon-btn.on { background:#fff; color:${color}; }
      .icon-btn.voice-stop { background:#fff; color:#b42318; }
      .thread { flex:1; min-height:0; overflow-y:auto; overscroll-behavior:contain; padding:12px 12px 14px; background:${threadBg}; display:flex; flex-direction:column; gap:10px; -webkit-overflow-scrolling:touch; }
      .row { display:flex; gap:8px; max-width:min(92%, 22rem); align-items:flex-end; animation: ta-msg 280ms ease both; }
      .row.visitor { margin-left:auto; flex-direction:row-reverse; }
      .stack { display:flex; flex-direction:column; gap:4px; min-width:0; }
      .row.visitor .stack { align-items:flex-end; }
      .who { font:650 9px/1 ui-sans-serif,system-ui; letter-spacing:.08em; text-transform:uppercase; opacity:.55; }
      .msg { border-radius:16px; padding:8px 10px; font:500 12px/1.45 ui-sans-serif,system-ui; box-shadow:0 1px 2px rgba(16,24,40,.05); overflow-wrap:anywhere; word-break:break-word; }
      .msg p { margin:0; }
      .msg p + ul, .msg p + p { margin-top:8px; }
      .msg ul { margin:6px 0 0; padding-left:1.15rem; }
      .msg li { margin:4px 0; }
      .msg strong { font-weight:700; }
      .row.agent .msg { background:${noir ? "#1a2436" : "#fff"}; color:${ink}; border-radius:6px 18px 18px 18px; }
      .row.visitor .msg { background:${fill}; color:${textColor}; border-radius:18px 6px 18px 18px; }
      .tpl-soft .row.agent .msg { background:#fffaf2; border:1px solid rgba(44,36,28,.06); }
      .msg.dim { color:#64748b; }
      .msg a { color: inherit; text-decoration: underline; text-underline-offset: 2px; }
      .typing { display:flex; align-items:center; gap:8px; background:${noir ? "#1a2436" : "#fff"}; border-radius:6px 16px 16px 16px; padding:8px 10px; box-shadow:0 1px 2px rgba(16,24,40,.05); }
      .typing-dots { display:flex; align-items:center; gap:4px; height:16px; }
      .typing-dots i { height:6px; width:6px; border-radius:999px; background:${color}; opacity:.35; animation: ta-dot 1s ease-in-out infinite; }
      .typing-dots i:nth-child(2) { animation-delay:.15s; }
      .typing-dots i:nth-child(3) { animation-delay:.3s; }
      .typing-label { font:600 11px/1.2 ui-sans-serif,system-ui; color:${noir ? "#8b9bb4" : "#64748b"}; }
      .resume { display:flex; align-items:center; justify-content:space-between; gap:8px; margin:0 0 4px; padding:8px 10px; border-radius:12px; background:${noir ? "#151c2b" : "#fff"}; box-shadow:0 6px 16px rgba(16,24,40,.06); }
      .resume p { margin:0; font:500 11px/1.3 ui-sans-serif,system-ui; color:#64748b; }
      .resume-last { border:0; background:${fill}; color:${textColor}; border-radius:999px; padding:6px 10px; font:650 10px/1 ui-sans-serif,system-ui; cursor:pointer; white-space:nowrap; }
      time { font:500 9px/1 ui-sans-serif,system-ui; color:${noir ? "#8b9bb4" : "#94a3b8"}; padding:0 4px; }
      .xfer { margin:8px auto; width:min(260px,100%); text-align:center; background:${noir ? "#151c2b" : "#fff"}; border-radius:20px; padding:16px 14px; box-shadow:0 10px 30px rgba(16,24,40,.08); }
      .xfer-faces { display:flex; align-items:center; justify-content:center; gap:10px; }
      .xfer-dots { display:flex; gap:4px; }
      .xfer-dots i { height:6px; width:6px; border-radius:999px; background:${color}; opacity:.3; animation: ta-dot 1s ease-in-out infinite; }
      .xfer-dots i:nth-child(2) { animation-delay:.15s; }
      .xfer-dots i:nth-child(3) { animation-delay:.3s; }
      .xfer-title { margin:10px 0 4px; font:650 13px/1.4 ui-sans-serif,system-ui; }
      .xfer-sub { margin:0; font:500 11px/1.3 ui-sans-serif,system-ui; color:#64748b; }
      .xfer-bar { margin-top:12px; height:3px; background:rgba(100,116,139,.2); border-radius:99px; overflow:hidden; }
      .xfer-bar span { display:block; height:100%; width:0; background:${fill}; animation: ta-bar 2.4s linear forwards; }
      .cards { display:grid; gap:8px; width:min(100%,220px); }
      .card { display:block; overflow:hidden; border-radius:16px; background:${noir ? "#151c2b" : "#fff"}; text-decoration:none; color:inherit; box-shadow:0 8px 24px rgba(16,24,40,.08); }
      .card-photo { height:112px; background:${noir ? "#1a2436" : "#eef2f7"}; }
      .card-photo img { width:100%; height:100%; object-fit:cover; display:block; }
      .card-mark { display:flex; align-items:center; gap:10px; padding:14px 12px; background:${noir ? "linear-gradient(135deg,#1a2436,#121826)" : "linear-gradient(135deg,#f8fafc,#eef2ff)"}; }
      .card-mark span { height:42px; width:42px; border-radius:14px; display:grid; place-items:center; background:${noir ? "#0b1220" : "#fff"}; font:700 16px/1 ui-sans-serif,system-ui; box-shadow:0 4px 12px rgba(16,24,40,.08); }
      .card-mark em { font:650 10px/1.2 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase; opacity:.55; }
      .wait-card { margin:8px auto; width:min(280px,100%); text-align:center; background:${noir ? "#151c2b" : "#fff"}; border-radius:24px; padding:18px 16px; box-shadow:0 10px 30px rgba(16,24,40,.08); }
      .wait-ring { margin:0 auto 12px; height:88px; width:88px; border-radius:999px; display:grid; place-items:center; background:conic-gradient(${color} 100%, ${noir ? "#1a2436" : "#e2e8f0"} 0); }
      .wait-ring span { height:70px; width:70px; border-radius:999px; display:grid; place-items:center; background:${noir ? "#0b1220" : "#fff"}; font:700 18px/1 ui-sans-serif,system-ui; }
      .wait-title { margin:0; font:650 14px/1.4 ui-sans-serif,system-ui; }
      .wait-sub { margin:6px 0 0; font:500 12px/1.4 ui-sans-serif,system-ui; opacity:.65; }
      .card-copy { padding:10px 12px 12px; }
      .card-name { margin:0; font:650 13px/1.35 ui-sans-serif,system-ui; }
      .card-price { margin:4px 0 0; font:600 13px/1.3 ui-sans-serif,system-ui; opacity:.8; }
      .lead-form, .support-choice, .lead-success, .wa-ready { display:grid; gap:10px; background:${noir ? "#151c2b" : "#fff"}; border-radius:22px; padding:14px; box-shadow:0 10px 28px rgba(16,24,40,.08); }
      .lead-head { display:flex; gap:10px; align-items:flex-start; }
      .lead-icon, .lead-check { height:32px; width:32px; border-radius:12px; display:grid; place-items:center; background:${fill}; color:${textColor}; font:700 14px/1 ui-sans-serif,system-ui; flex:none; }
      .lead-check { height:48px; width:48px; border-radius:999px; margin:4px auto 0; font-size:22px; }
      .lead-kicker { margin:0; font:700 10px/1.2 ui-sans-serif,system-ui; letter-spacing:.16em; text-transform:uppercase; color:${noir ? "#8b9bb4" : "#94a3b8"}; }
      .lead-heading { margin:2px 0 0; font:700 14px/1.35 ui-sans-serif,system-ui; }
      .lead-copy { margin:4px 0 0; font:500 12px/1.45 ui-sans-serif,system-ui; color:${noir ? "#8b9bb4" : "#64748b"}; }
      .lead-copy.muted { margin-top:0; }
      .lead-form label { display:grid; gap:6px; }
      .lead-form label span { font:700 10px/1 ui-sans-serif,system-ui; letter-spacing:.12em; text-transform:uppercase; color:${noir ? "#8b9bb4" : "#64748b"}; }
      .lead-form input, .lead-form textarea { border:1px solid ${noir ? "rgba(255,255,255,.08)" : "#e2e8f0"}; border-radius:14px; background:${noir ? "#1a2436" : "#f8fafc"}; padding:11px 12px; font:500 14px/1.3 ui-sans-serif,system-ui; color:inherit; outline:none; }
      .lead-form input:focus, .lead-form textarea:focus { border-color:${color}; background:${noir ? "#121826" : "#fff"}; }
      .lead-form label.invalid input, .lead-form label.invalid textarea { border-color:#f43f5e; background:${noir ? "#2a1620" : "#fff1f2"}; }
      .lead-form em { min-height:0; font:600 11px/1.3 ui-sans-serif,system-ui; color:#e11d48; }
      .lead-error { margin:0; font:600 12px/1.35 ui-sans-serif,system-ui; color:#e11d48; }
      .lead-submit { border:0; border-radius:999px; padding:11px 12px; background:${fill}; color:${textColor}; font:650 13px/1 ui-sans-serif,system-ui; cursor:pointer; }
      .lead-submit:disabled { opacity:.6; cursor:wait; }
      .lead-back { border:0; background:transparent; color:${noir ? "#8b9bb4" : "#64748b"}; font:600 12px/1 ui-sans-serif,system-ui; cursor:pointer; padding:2px; }
      .support-opt { display:flex; align-items:center; gap:12px; border:1px solid ${noir ? "rgba(255,255,255,.08)" : "#e2e8f0"}; background:${noir ? "#1a2436" : "#f8fafc"}; border-radius:16px; padding:11px; text-align:left; cursor:pointer; color:inherit; }
      .support-opt .opt-copy { min-width:0; flex:1; }
      .support-opt strong { display:block; font:700 13px/1.3 ui-sans-serif,system-ui; }
      .support-opt .opt-copy span { display:block; margin-top:3px; font:500 11px/1.4 ui-sans-serif,system-ui; opacity:.72; }
      .opt-mark { height:40px; width:40px; border-radius:14px; display:grid; place-items:center; flex:none; background:${noir ? "#0b1220" : "#fff"}; color:${noir ? "#cbd5e1" : "#475569"}; box-shadow:0 4px 12px rgba(16,24,40,.06); font-size:16px; }
      .opt-mark.wa-mark { background:#fff; color:#25D366; }
      .opt-mark.wa-mark svg { width:20px; height:20px; display:block; }
      .support-opt.wa { background:linear-gradient(135deg,#25D366,#128C7E); color:#fff; border-color:transparent; box-shadow:0 8px 20px rgba(37,211,102,.28); }
      .support-opt.wa .opt-copy span { opacity:.88; }
      .lead-check.wa { background:linear-gradient(135deg,#25D366,#128C7E); }
      .lead-success, .wa-ready { text-align:center; padding:18px 14px; }
      .joined { display:flex; align-items:center; gap:8px; color:#64748b; font:650 11px/1 ui-sans-serif,system-ui; letter-spacing:.04em; text-transform:uppercase; margin:4px 0 2px; }
      .joined .line { flex:1; height:1px; background:currentColor; opacity:.25; }
      .composer { display:flex; gap:8px; padding:8px 8px 10px; border-top:1px solid ${noir ? "rgba(255,255,255,.06)" : "#e8eef5"}; background:${paper}; align-items:center; flex:none; }
      .box { flex:1; border:0; border-radius:999px; background:${noir ? "#1a2436" : atelier ? "#efe6d6" : "#f1f5f9"}; padding:10px 12px; font:500 16px/1.3 ui-sans-serif,system-ui; outline:none; color:${noir ? "#e8edf5" : "#122033"}; min-width:0; }
      .go, .mic { border:0; height:40px; width:40px; border-radius:999px; display:grid; place-items:center; cursor:pointer; color:${textColor}; flex:none; position:relative; }
      .go { background:${fill}; }
      .mic { background:${noir ? "#1a2436" : "#0f172a"}; color:#fff; box-shadow:0 8px 18px rgba(15,23,42,.18); }
      .mic-pulse { position:absolute; inset:-5px; border-radius:999px; border:2px solid ${color}; opacity:0; pointer-events:none; }
      .mic.live { background:#dc2626; color:#fff; }
      .mic.live .mic-pulse { animation: ta-mic-ring 1.4s ease-out infinite; opacity:.7; }
      .listen { display:flex; align-items:center; gap:10px; padding:10px 12px 12px; border-top:1px solid ${noir ? "rgba(255,255,255,.06)" : "#e8eef5"}; background:${paper}; flex:none; }
      .listen-orb { height:36px; width:36px; border-radius:999px; background:${fill}; display:grid; place-items:center; flex:none; box-shadow:0 0 0 6px rgba(220,38,38,.12); }
      .listen-orb span { height:12px; width:12px; border-radius:999px; background:#fff; animation: ta-mic-blob .9s ease-in-out infinite; }
      .listen-wave { display:flex; align-items:center; gap:3px; height:28px; flex:none; }
      .listen-wave i { width:3px; height:8px; border-radius:99px; background:${color}; transform-origin:center; animation: ta-wave .9s ease-in-out infinite; }
      .listen-wave i:nth-child(2) { animation-delay:.08s; }
      .listen-wave i:nth-child(3) { animation-delay:.16s; }
      .listen-wave i:nth-child(4) { animation-delay:.24s; }
      .listen-wave i:nth-child(5) { animation-delay:.32s; }
      .listen-caption { margin:0; flex:1; min-width:0; font:500 12px/1.35 ui-sans-serif,system-ui; color:${noir ? "#cbd5e1" : "#334155"}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .listen-x, .listen-go { border:0; height:36px; width:36px; border-radius:999px; display:grid; place-items:center; cursor:pointer; flex:none; }
      .listen-x { background:${noir ? "#1a2436" : "#e8eef5"}; color:${noir ? "#e8edf5" : "#334155"}; }
      .listen-go { background:${fill}; color:${textColor}; }
      .listen-x svg, .listen-go svg { width:15px; height:15px; }
      .go svg, .mic svg { width:16px; height:16px; }
      .inbox { position:absolute; inset:52px 0 0; background:${paper}; z-index:3; display:flex; flex-direction:column; }
      .panel:has(.wa-strip:not([hidden])) .inbox { top: 96px; }
      .inbox-bar { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; font:650 13px/1 ui-sans-serif,system-ui; }
      .new-chat { border:0; background:${fill}; color:${textColor}; border-radius:999px; padding:8px 12px; font:650 11px/1 ui-sans-serif,system-ui; cursor:pointer; }
      .inbox-list { list-style:none; margin:0; padding:0 10px 16px; overflow:auto; }
      .inbox-list li { display:flex; gap:10px; align-items:center; padding:10px; border-radius:16px; cursor:pointer; }
      .inbox-list li:hover { background:${noir ? "#1a2436" : "#f8fafc"}; }
      .inbox-list .t { margin:0; font:650 13px/1.3 ui-sans-serif,system-ui; }
      .inbox-list .p { margin:3px 0 0; font:500 12px/1.3 ui-sans-serif,system-ui; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }
      .inbox-list time { margin-left:auto; font:500 11px/1 ui-sans-serif,system-ui; color:#94a3b8; }
      .empty { color:#94a3b8; font:500 13px/1.4 ui-sans-serif,system-ui; padding:20px !important; }
      .notice { align-self:center; font:500 11px/1.4 ui-sans-serif,system-ui; color:#64748b; }
      @media (max-width: 640px) {
        .panel:not([hidden]) {
          width:100%;
          height: min(68dvh, 520px);
          max-height: calc(100dvh - 48px - env(safe-area-inset-bottom, 0px) - env(safe-area-inset-top, 0px));
          border-radius: 18px;
        }
        .panel.wide:not([hidden]) { height: min(78dvh, 640px); }
        .launch { height:52px; ${noir ? "" : "width:52px;"} }
        .face { height:${noir ? "30px" : "52px"}; width:${noir ? "30px" : "52px"}; }
        .head { padding: 8px 10px; gap: 6px; }
        .icon-btn { width:32px; height:32px; }
        .teaser { max-width: min(220px, calc(100vw - 72px)); }
      }
      @media (max-width: 380px) {
        .panel:not([hidden]) { height: min(62dvh, 460px); border-radius: 16px; }
        .msg { font-size: 12px; }
      }
      @media (max-height: 560px) {
        .panel:not([hidden]) { height: min(66dvh, calc(100dvh - 48px)); min-height: 220px; }
      }
      @keyframes ta-in { to { opacity:1; transform:none; } }
      @keyframes ta-pulse { 0% { transform:scale(.92); opacity:.5; } 100% { transform:scale(1.18); opacity:0; } }
      @keyframes ta-panel { from { opacity:0; transform: translateY(12px); } }
      @keyframes ta-msg { from { opacity:0; transform:translateY(6px); } }
      @keyframes ta-dot { 0%,100% { opacity:.25; transform:translateY(0); } 50% { opacity:1; transform:translateY(-3px); } }
      @keyframes ta-bar { to { width:100%; } }
      @keyframes ta-ava { 0% { box-shadow:0 0 0 0 rgba(220,38,38,.45); } 100% { box-shadow:0 0 0 10px rgba(220,38,38,0); } }
      @keyframes ta-wave { 0%,100% { height:8px; opacity:.45; } 50% { height:24px; opacity:1; } }
      @keyframes ta-mic-ring { 0% { transform:scale(.85); opacity:.55; } 100% { transform:scale(1.35); opacity:0; } }
      @keyframes ta-mic-blob { 0%,100% { transform:scale(.7); } 50% { transform:scale(1); } }
    `;
  }
})();
