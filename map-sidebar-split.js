/**
 * Touch / pointer drag handle between #map-wrap and #sidebar on narrow screens.
 * Expects DOM: #sidebar, #splitter.app-splitter, #map-wrap inside column #app.
 */
export function initMapSidebarSplit(options = {}) {
  const storageKey = options.storageKey ?? "rideapp-map-split-px";
  const minMap = options.minMap ?? 110;
  const minPanel = options.minPanel ?? 200;
  const maxMapRatio = options.maxMapRatio ?? 0.82;
  const getMap = options.getMap;

  const mq = window.matchMedia("(max-width: 768px)");
  const mapWrap = document.getElementById("map-wrap");
  const splitter = document.getElementById("splitter");
  if (!mapWrap || !splitter) return;

  function splitterH() {
    if (!mq.matches) return 0;
    const h = splitter.getBoundingClientRect().height;
    return h > 0 ? h : 20;
  }

  function clamp(px) {
    const vh = window.innerHeight;
    const sp = splitterH();
    const maxByPanel = vh - minPanel - sp;
    const maxByRatio = vh * maxMapRatio;
    const cap = Math.min(maxByPanel, maxByRatio);
    const maxH = Math.max(minMap, cap);
    return Math.max(minMap, Math.min(maxH, Math.round(px)));
  }

  function invalidate() {
    const m = getMap?.();
    if (m && typeof m.invalidateSize === "function") {
      requestAnimationFrame(() => m.invalidateSize());
    }
  }

  function applyHeight(px) {
    if (!mq.matches) return;
    const h = clamp(px);
    mapWrap.style.height = `${h}px`;
    mapWrap.style.flex = "none";
    mapWrap.style.flexShrink = "0";
    invalidate();
    return h;
  }

  function clearDesktop() {
    mapWrap.style.removeProperty("height");
    mapWrap.style.removeProperty("flex");
    mapWrap.style.removeProperty("flex-shrink");
    invalidate();
  }

  function defaultHeight() {
    return Math.round(Math.min(window.innerHeight * 0.42, 300));
  }

  function loadInitial() {
    if (!mq.matches) return;
    const raw = localStorage.getItem(storageKey);
    let px;
    if (raw != null && raw !== "") {
      const n = parseFloat(raw);
      if (Number.isFinite(n)) px = n;
    }
    if (px == null) {
      const rect = mapWrap.getBoundingClientRect();
      px = rect.height > 40 ? rect.height : defaultHeight();
    }
    const h = applyHeight(px);
    localStorage.setItem(storageKey, String(h));
  }

  let dragY0 = null;
  let dragH0 = null;

  function onDown(e) {
    if (!mq.matches) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragY0 = e.clientY;
    dragH0 = mapWrap.getBoundingClientRect().height;
    document.body.classList.add("map-split-dragging");
    splitter.classList.add("dragging");
    try {
      splitter.setPointerCapture(e.pointerId);
    } catch (_) {}
  }

  function onMove(e) {
    if (dragY0 == null) return;
    const dy = e.clientY - dragY0;
    applyHeight(dragH0 + dy);
  }

  function onEnd(e) {
    if (dragY0 == null) return;
    dragY0 = null;
    dragH0 = null;
    document.body.classList.remove("map-split-dragging");
    splitter.classList.remove("dragging");
    try {
      if (e.pointerId != null) splitter.releasePointerCapture(e.pointerId);
    } catch (_) {}
    const cur = mapWrap.getBoundingClientRect().height;
    const h = clamp(cur);
    mapWrap.style.height = `${h}px`;
    localStorage.setItem(storageKey, String(h));
    invalidate();
  }

  splitter.addEventListener("pointerdown", onDown);
  splitter.addEventListener("pointermove", onMove);
  splitter.addEventListener("pointerup", onEnd);
  splitter.addEventListener("pointercancel", onEnd);

  function onViewportResize() {
    if (!mq.matches) return;
    const inline = mapWrap.style.height;
    const cur = parseFloat(inline);
    if (Number.isFinite(cur)) applyHeight(cur);
    else loadInitial();
  }

  mq.addEventListener("change", (ev) => {
    if (ev.matches) loadInitial();
    else clearDesktop();
  });

  window.addEventListener("resize", onViewportResize);
  window.visualViewport?.addEventListener?.("resize", onViewportResize);

  loadInitial();
}
