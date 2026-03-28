/**
 * Drag handles between #map-wrap and #sidebar (mobile): resize map vs bottom panel
 * (header, stats, tabs, all tab content). Expects #splitter; optional #panel-split-grip on sidebar.
 */
export function initMapSidebarSplit(options = {}) {
  const storageKey = options.storageKey ?? "rideapp-map-split-px";
  const minMap = options.minMap ?? 95;
  const minPanel = options.minPanel ?? 200;
  const maxMapRatio = options.maxMapRatio ?? 0.9;
  const getMap = options.getMap;

  const mq = window.matchMedia("(max-width: 768px)");
  const mapWrap = document.getElementById("map-wrap");
  const splitter = document.getElementById("splitter");
  const panelGrip = document.getElementById("panel-split-grip");
  if (!mapWrap || !splitter) return;

  const handles = panelGrip ? [splitter, panelGrip] : [splitter];

  function viewportH() {
    const vv = window.visualViewport;
    if (vv && vv.height > 0) return vv.height;
    return window.innerHeight;
  }

  /** Only the bar between map and sidebar (not the in-panel grip). */
  function splitterH() {
    if (!mq.matches) return 0;
    const h = splitter.getBoundingClientRect().height;
    return h > 0 ? h : 48;
  }

  function clamp(px) {
    const vh = viewportH();
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
    const vh = viewportH();
    return Math.round(Math.min(vh * 0.4, 300));
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
  let captureEl = null;

  function setDragging(on) {
    document.body.classList.toggle("map-split-dragging", on);
    handles.forEach((el) => el.classList.toggle("dragging", on));
  }

  function onDown(e, el) {
    if (!mq.matches) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragY0 = e.clientY;
    dragH0 = mapWrap.getBoundingClientRect().height;
    captureEl = el;
    setDragging(true);
    try {
      el.setPointerCapture(e.pointerId);
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
    setDragging(false);
    try {
      if (e.pointerId != null && captureEl) captureEl.releasePointerCapture(e.pointerId);
    } catch (_) {}
    captureEl = null;
    const cur = mapWrap.getBoundingClientRect().height;
    const h = clamp(cur);
    mapWrap.style.height = `${h}px`;
    localStorage.setItem(storageKey, String(h));
    invalidate();
  }

  for (const el of handles) {
    el.addEventListener("pointerdown", (e) => onDown(e, el));
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onEnd);
    el.addEventListener("pointercancel", onEnd);
  }

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
  window.visualViewport?.addEventListener?.("scroll", onViewportResize);

  loadInitial();
}
