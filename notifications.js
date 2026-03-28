// ============================================================
// RideApp — in-app notifications only (tab open): bell, panel, alert ring + sound
// Firestore: app_notifications/{id}
//   title, body, kind?, createdAt,
//   roles?: string[]     — any user whose role is listed
//   targetUids?: string[] — specific users (merged with role queries client-side)
// ============================================================

import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const NOTIF_COLLECTION = "app_notifications";

/** Reserved for future strict autoplay unlock; audio is attempted in playAlertRing. */
export function unlockAlertAudio() {}

/**
 * Short “alerting ring” tone (Web Audio). Safe no-op if AudioContext fails.
 */
export function playAlertRing() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(740, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.12);
    o2.type = "sine";
    o2.frequency.setValueAtTime(523, ctx.currentTime + 0.08);
    o.connect(g);
    o2.connect(g2);
    g.connect(ctx.destination);
    g2.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.38);
    g2.gain.setValueAtTime(0.0001, ctx.currentTime + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.1, ctx.currentTime + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + 0.42);
    o2.start(ctx.currentTime + 0.08);
    o2.stop(ctx.currentTime + 0.48);
    ctx.resume?.();
    setTimeout(() => ctx.close?.(), 600);
  } catch (_) {
    /* ignore */
  }
}

export function installNotificationStyles() {
  if (document.getElementById("rideapp-notif-styles")) return;
  const style = document.createElement("style");
  style.id = "rideapp-notif-styles";
  style.textContent = `
    @keyframes rideapp-bell-shake {
      0%, 100% { transform: rotate(0deg); }
      15% { transform: rotate(-14deg); }
      30% { transform: rotate(12deg); }
      45% { transform: rotate(-10deg); }
      60% { transform: rotate(8deg); }
      75% { transform: rotate(-4deg); }
    }
    @keyframes rideapp-alert-ring {
      0%   { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.55), 0 0 0 0 rgba(99, 102, 241, 0.35); }
      45%  { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0), 0 0 0 4px rgba(99, 102, 241, 0.25); }
      100% { box-shadow: 0 0 0 22px rgba(245, 158, 11, 0), 0 0 0 0 rgba(99, 102, 241, 0); }
    }
    .rideapp-no-wrap { white-space: normal; word-break: break-word; }
    #rideapp-notif-bell {
      position: fixed;
      top: calc(12px + env(safe-area-inset-top, 0px));
      right: calc(12px + env(safe-area-inset-right, 0px));
      z-index: 10001;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(17, 17, 24, 0.95);
      backdrop-filter: blur(10px);
      color: #f59e0b;
      font-size: 22px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.35);
      transition: transform 0.15s ease, color 0.2s;
    }
    #rideapp-notif-bell:hover { color: #fbbf24; }
    #rideapp-notif-bell.ringing {
      animation: rideapp-alert-ring 1.25s ease-out infinite, rideapp-bell-shake 0.6s ease-in-out infinite;
    }
    #rideapp-notif-bell.has-unread { color: #f43f5e; }
    #rideapp-notif-badge {
      position: absolute;
      top: 4px;
      right: 4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 999px;
      background: #f43f5e;
      color: #fff;
      font-size: 11px;
      font-weight: 800;
      line-height: 18px;
      text-align: center;
      display: none;
      font-family: system-ui, sans-serif;
    }
    #rideapp-notif-panel {
      position: fixed;
      top: calc(68px + env(safe-area-inset-top, 0px));
      right: calc(12px + env(safe-area-inset-right, 0px));
      width: min(360px, calc(100vw - 24px));
      max-height: min(420px, 55vh);
      overflow: hidden;
      display: none;
      flex-direction: column;
      z-index: 10000;
      background: rgba(17, 17, 24, 0.98);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 16px;
      box-shadow: 0 18px 50px rgba(0,0,0,0.55);
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    #rideapp-notif-panel.open { display: flex; }
    #rideapp-notif-panel-h {
      padding: 12px 14px;
      font-weight: 800;
      font-size: 14px;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      color: #f1f1f8;
    }
    #rideapp-notif-panel-list {
      overflow-y: auto;
      flex: 1;
      padding: 8px 10px 12px;
    }
    .rideapp-notif-item {
      padding: 10px 11px;
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 8px;
    }
    .rideapp-notif-item-title { font-weight: 700; font-size: 14px; color: #f1f1f8; margin-bottom: 4px; }
    .rideapp-notif-item-body { font-size: 13px; color: #a3a3c2; line-height: 1.45; }
    .rideapp-notif-item-time { font-size: 11px; color: #6b6b85; margin-top: 6px; }
    .rideapp-notif-empty { text-align: center; color: #6b6b85; font-size: 14px; padding: 20px 8px; }
  `;
  document.head.appendChild(style);
}

function lsSeenKey(uid) {
  return `rideapp_notif_seen_at_${uid}`;
}

function getSeenAt(uid) {
  const v = localStorage.getItem(lsSeenKey(uid));
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function setSeenNow(uid) {
  localStorage.setItem(lsSeenKey(uid), String(Date.now()));
}

function tsToMs(t) {
  if (!t) return 0;
  if (typeof t.toMillis === "function") return t.toMillis();
  if (typeof t.seconds === "number") return t.seconds * 1000;
  return 0;
}

/**
 * Push a notification visible to matching clients (roles and/or targetUids).
 */
export async function createAppNotification(db, { title, body, roles = null, targetUids = null, kind = "alert" }) {
  const payload = {
    title: title || "Notice",
    body: body || "",
    kind,
    createdAt: serverTimestamp(),
  };
  if (Array.isArray(roles) && roles.length) payload.roles = roles;
  if (Array.isArray(targetUids) && targetUids.length) {
    payload.targetUids = [...new Set(targetUids.filter(Boolean))];
  }
  if (!payload.roles && !payload.targetUids) {
    payload.roles = ["customer", "driver", "admin", "superadmin"];
  }
  await addDoc(collection(db, NOTIF_COLLECTION), payload);
}

function mergeById(mapA, mapB) {
  const out = new Map(mapA);
  for (const [k, v] of mapB) out.set(k, v);
  return out;
}

/**
 * Bell + panel + Firestore listeners (role + personal). Plays sound / ring on new items.
 */
export function initRideAppNotifications({ db, userId, role }) {
  installNotificationStyles();

  const bell = document.createElement("button");
  bell.type = "button";
  bell.id = "rideapp-notif-bell";
  bell.setAttribute("aria-label", "Notifications");
  bell.innerHTML = `<span style="pointer-events:none">🔔</span><span id="rideapp-notif-badge">0</span>`;
  document.body.appendChild(bell);

  const badge = bell.querySelector("#rideapp-notif-badge");

  const panel = document.createElement("div");
  panel.id = "rideapp-notif-panel";
  panel.innerHTML = `
    <div id="rideapp-notif-panel-h">Notifications</div>
    <div id="rideapp-notif-panel-list"><div class="rideapp-notif-empty">Loading…</div></div>
  `;
  document.body.appendChild(panel);
  const listEl = panel.querySelector("#rideapp-notif-panel-list");

  const items = new Map(); // id -> { data, id }
  let knownIds = new Set();
  let listenerPrimed = false;
  let open = false;

  const markUnreadUi = () => {
    const seen = getSeenAt(userId);
    let unread = 0;
    const sorted = [...items.values()].sort(
      (a, b) => tsToMs(b.data.createdAt) - tsToMs(a.data.createdAt)
    );
    for (const x of sorted) {
      if (tsToMs(x.data.createdAt) > seen) unread++;
    }
    if (unread > 0) {
      badge.style.display = "block";
      badge.textContent = unread > 9 ? "9+" : String(unread);
      bell.classList.add("has-unread");
    } else {
      badge.style.display = "none";
      bell.classList.remove("has-unread");
    }
  };

  const renderList = () => {
    const sorted = [...items.values()].sort(
      (a, b) => tsToMs(b.data.createdAt) - tsToMs(a.data.createdAt)
    );
    if (!sorted.length) {
      listEl.innerHTML = `<div class="rideapp-notif-empty">No notifications yet.</div>`;
      return;
    }
    listEl.innerHTML = "";
    for (const { id, data } of sorted.slice(0, 40)) {
      const row = document.createElement("div");
      row.className = "rideapp-notif-item";
      const t = data.createdAt?.toDate
        ? data.createdAt.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" })
        : "";
      row.innerHTML = `
        <div class="rideapp-notif-item-title rideapp-no-wrap">${escapeHtml(data.title || "")}</div>
        <div class="rideapp-notif-item-body rideapp-no-wrap">${escapeHtml(data.body || "")}</div>
        <div class="rideapp-notif-item-time">${t}</div>`;
      listEl.appendChild(row);
    }
  };

  const onMerged = (roleMap, selfMap) => {
    const merged = mergeById(roleMap, selfMap);
    const newIds = new Set();
    for (const id of merged.keys()) newIds.add(id);

    let hasNew = false;
    for (const id of merged.keys()) {
      if (!knownIds.has(id)) hasNew = true;
    }
    knownIds = newIds;
    items.clear();
    for (const [id, data] of merged) items.set(id, { id, data });

    const shouldAlert = listenerPrimed && hasNew && merged.size > 0;
    if (!listenerPrimed) listenerPrimed = true;
    if (shouldAlert) {
      bell.classList.add("ringing");
      playAlertRing();
      setTimeout(() => bell.classList.remove("ringing"), 2800);
    }

    markUnreadUi();
    if (open) renderList();
  };

  let roleMap = new Map();
  let selfMap = new Map();

  const fireMerge = () => onMerged(roleMap, selfMap);

  const qRole = query(
    collection(db, NOTIF_COLLECTION),
    where("roles", "array-contains", role),
    orderBy("createdAt", "desc"),
    limit(40)
  );
  const qSelf = query(
    collection(db, NOTIF_COLLECTION),
    where("targetUids", "array-contains", userId),
    orderBy("createdAt", "desc"),
    limit(40)
  );

  onSnapshot(
    qRole,
    (snap) => {
      roleMap = new Map(snap.docs.map((d) => [d.id, d.data()]));
      fireMerge();
    },
    (err) => console.warn("[Notifications role]", err.code, err.message)
  );

  onSnapshot(
    qSelf,
    (snap) => {
      selfMap = new Map(snap.docs.map((d) => [d.id, d.data()]));
      fireMerge();
    },
    (err) => console.warn("[Notifications self]", err.code, err.message)
  );

  bell.addEventListener("click", (e) => {
    e.stopPropagation();
    unlockAlertAudio();
    open = !open;
    panel.classList.toggle("open", open);
    if (open) {
      setSeenNow(userId);
      markUnreadUi();
      renderList();
    }
  });

  document.addEventListener("click", () => {
    if (open) {
      open = false;
      panel.classList.remove("open");
    }
  });
  panel.addEventListener("click", (e) => e.stopPropagation());

  document.body.addEventListener(
    "click",
    () => unlockAlertAudio(),
    { once: true, capture: true }
  );
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
