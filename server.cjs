/**
 * Custom Next.js HTTP server with a native WebSocket on the same process.
 * PM2: `npm start` → this file. Restart with `pm2 restart tidyagent`.
 *
 * Nginx must forward upgrades:
 *   proxy_http_version 1.1;
 *   proxy_set_header Upgrade $http_upgrade;
 *   proxy_set_header Connection "upgrade";
 */
require("dotenv").config();

const { createServer } = require("node:http");
const { parse } = require("node:url");
const next = require("next");
const jwt = require("jsonwebtoken");
const { WebSocketServer, WebSocket } = require("ws");
const { PrismaClient } = require("@prisma/client");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || (dev ? 3000 : 5070));
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const conversationSockets = new Map();
const orgSockets = new Map();
const expiryTimers = new Map();

function addSocket(map, key, socket) {
  if (!key) return;
  const set = map.get(key) ?? new Set();
  set.add(socket);
  map.set(key, set);
}

function removeSocket(map, key, socket) {
  const set = map.get(key);
  if (!set) return;
  set.delete(socket);
  if (!set.size) map.delete(key);
}

function send(socket, payload) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function publishTo(map, key, payload) {
  const set = map.get(key);
  if (!set) return;
  for (const socket of set) send(socket, payload);
}

function scheduleExpiry(conversationId, seconds) {
  const existing = expiryTimers.get(conversationId);
  if (existing) clearTimeout(existing);
  const wait = Math.max(5, Number(seconds) || 75) * 1000;
  const timer = setTimeout(() => {
    expiryTimers.delete(conversationId);
    publish({ type: "expired", conversationId });
  }, wait);
  expiryTimers.set(conversationId, timer);
}

function cancelExpiry(conversationId) {
  const timer = expiryTimers.get(conversationId);
  if (timer) clearTimeout(timer);
  expiryTimers.delete(conversationId);
}

function publish(event) {
  if (!event || typeof event !== "object") return;
  if (event.type === "joined" && event.conversationId) cancelExpiry(event.conversationId);
  if (event.conversationId) publishTo(conversationSockets, event.conversationId, event);
  if (event.organizationId) publishTo(orgSockets, event.organizationId, event);
}

function cookieValue(header, name) {
  const raw = String(header || "");
  const match = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function verifyJwt(token, secret) {
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

async function authorize(request, query) {
  const role = String(query.role || "");
  const sessionSecret = process.env.SESSION_SECRET || "";
  const widgetSecret = process.env.WIDGET_TOKEN_SECRET || "";
  const session = verifyJwt(cookieValue(request.headers.cookie, "tidyagent_session"), sessionSecret);

  if (role === "owner") {
    if (!session?.organizationId || !session?.siteId) return null;
    return { role: "owner", organizationId: session.organizationId, siteId: session.siteId };
  }

  const conversationId = String(query.conversationId || "");
  if (!conversationId) return null;

  let organizationId = "";
  let siteId = "";
  if (query.preview === "1" && session?.organizationId) {
    organizationId = session.organizationId;
    siteId = session.siteId;
  } else {
    const token = verifyJwt(String(query.token || ""), widgetSecret);
    if (token?.organizationId) {
      organizationId = token.organizationId;
      siteId = token.siteId;
    } else if (query.instanceId) {
      const site = await prisma.wixSite.findUnique({
        where: { wixInstanceId: String(query.instanceId) },
        select: { organizationId: true, id: true },
      });
      if (site) {
        organizationId = site.organizationId;
        siteId = site.id;
      }
    }
  }
  if (!organizationId) return null;
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId, siteId },
    select: { id: true },
  });
  if (!conversation) return null;
  return { role: "visitor", organizationId, siteId, conversationId };
}

function attachSocket(server) {
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (request, socket, head) => {
    const { pathname, query } = parse(request.url || "", true);
    if (pathname !== "/realtime") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, query);
    });
  });

  wss.on("connection", async (ws, request, query) => {
    let auth = null;
    try {
      auth = await authorize(request, query || {});
    } catch {
      auth = null;
    }
    if (!auth) {
      send(ws, { type: "error", error: "unauthorized" });
      ws.close();
      return;
    }

    ws.organizationId = auth.organizationId;
    ws.conversationId = auth.conversationId || "";
    addSocket(orgSockets, auth.organizationId, ws);
    if (auth.conversationId) addSocket(conversationSockets, auth.conversationId, ws);
    send(ws, { type: "ready", role: auth.role, conversationId: auth.conversationId || null });

    ws.on("message", (raw) => {
      let data = null;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (data?.type === "watch" && data.conversationId && auth.role === "owner") {
        ws.conversationId = data.conversationId;
        addSocket(conversationSockets, data.conversationId, ws);
      }
      if (data?.type === "ping") send(ws, { type: "pong" });
    });

    ws.on("close", () => {
      removeSocket(orgSockets, auth.organizationId, ws);
      if (ws.conversationId) removeSocket(conversationSockets, ws.conversationId, ws);
    });
  });
}

global.__tidyRealtime = {
  publish,
  scheduleExpiry,
};

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res, parse(req.url, true));
  });
  attachSocket(server);
  server.listen(port, hostname, () => {
    console.log(`tidyAgent ready on http://${hostname}:${port} (websocket /realtime)`);
  });
});
