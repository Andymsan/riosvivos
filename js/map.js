/* map.js — Ríos Vivos (genérico para Atoyac, Lerma-Santiago, Tula) */
const LAYERS = {};
const MAP = (() => {
  let map, _initBounds;
  const DATA_DIR = typeof RIO_DATA_DIR !== 'undefined' ? RIO_DATA_DIR : 'data/';
  const RIO_CENTER = typeof RIO_INIT_VIEW !== 'undefined' ? RIO_INIT_VIEW : { lat: 20.0, lng: -99.3, zoom: 9 };

  /* ── BASE TILES ─────────────────────────── */
  const ESRI_TOPO = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri', maxZoom: 18 }
  );
  const ESRI_IMAGERY = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Esri', maxZoom: 18 }
  );

  /* ── STYLE HELPERS ───────────────────────── */
  function geoStyle(color, weight, fillOpacity) {
    return { color, weight: weight || 2, fillColor: color, fillOpacity: fillOpacity || 0.3, opacity: 0.9 };
  }

  function pointToLayer(color, sym) {
    return (f, latlng) => {
      if (sym === 'sq') return L.rectangle([[latlng.lat - 0.003, latlng.lng - 0.003],
        [latlng.lat + 0.003, latlng.lng + 0.003]], geoStyle(color, 1.5, 0.6));
      return L.circleMarker(latlng, { radius: 6, ...geoStyle(color, 1.5, 0.85) });
    };
  }

  /* ── HOVER TOOLTIP ───────────────────────── */
  function bindTooltip(layer, name) {
    layer.bindTooltip(name, { sticky: true, className: 'ltip', direction: 'top', offset: [0, -4] });
  }

  /* ── LOAD GENERIC GEOJSON ────────────────── */
  function loadLayer(key, ld) {
    if (LAYERS[key]) return;
    const path = DATA_DIR + key + '.geojson';
    fetch(path)
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(fc => {
        const isLine = fc.features[0]?.geometry?.type?.includes('Line');
        const isPoly = fc.features[0]?.geometry?.type?.includes('Polygon');
        const lyr = L.geoJSON(fc, {
          style: isLine || isPoly
            ? () => geoStyle(ld.color, isLine ? 2.5 : 1.5, isPoly ? 0.25 : 0)
            : undefined,
          pointToLayer: !isLine && !isPoly ? pointToLayer(ld.color, ld.sym) : undefined,
          onEachFeature: (f, l) => bindTooltip(l, f.properties?.Name || f.properties?.nombre || ld.label || key)
        });
        LAYERS[key] = lyr;
      })
      .catch(e => console.warn('Layer not found:', key, e));
  }

  /* ── PRELOAD ALL LAYER KEYS FROM CONFIG ──── */
  function preloadLayers() {
    const seen = new Set();
    Object.values(CONFIG).forEach(eje =>
      eje.metas?.forEach(m =>
        m.proyectos?.forEach(p =>
          (p.layerDefs || []).forEach(ld => {
            if (!seen.has(ld.key)) { seen.add(ld.key); loadLayer(ld.key, ld); }
          })
        )
      )
    );
  }

  /* ── SET LAYER ON/OFF ────────────────────── */
  function setLayer(key, on) {
    if (!LAYERS[key]) { if (on) loadLayer(key, { key, color: '#1a5c8a', label: key }); return; }
    if (on) LAYERS[key].addTo(map);
    else if (map.hasLayer(LAYERS[key])) map.removeLayer(LAYERS[key]);
  }

  /* ── ZOOM TO LAYERS ───────────────────────── */
  function fitToLayers(keys) {
    const bounds = L.latLngBounds();
    let added = 0;
    keys.forEach(k => {
      const lyr = LAYERS[k];
      if (!lyr) return;
      try { const b = lyr.getBounds(); if (b?.isValid()) { bounds.extend(b); added++; } } catch {}
    });
    if (!added || !bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13, animate: true });
  }

  /* ── RESET VIEW ───────────────────────────── */
  function resetView() {
    Object.values(LAYERS).forEach(l => { try { map.removeLayer(l); } catch {} });
    if (_initBounds) map.fitBounds(_initBounds, { padding: [20, 20], maxZoom: 10 });
    else map.setView([RIO_CENTER.lat, RIO_CENTER.lng], RIO_CENTER.zoom);
  }

  /* ── INIT ─────────────────────────────────── */
  function init() {
    map = L.map('map', { zoomControl: false })
      .setView([RIO_CENTER.lat, RIO_CENTER.lng], RIO_CENTER.zoom);

    ESRI_TOPO.addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Layer control
    L.control.layers(
      { 'Topográfico': ESRI_TOPO, 'Satélite': ESRI_IMAGERY }, {},
      { position: 'bottomright', collapsed: true }
    ).addTo(map);

    // Load cuenca as context layer automatically
    const cuencaKey = typeof RIO_CUENCA_KEY !== 'undefined' ? RIO_CUENCA_KEY : null;
    if (cuencaKey) {
      const cuencaColor = typeof RIO_COLOR !== 'undefined' ? RIO_COLOR : '#1a5c8a';
      fetch(DATA_DIR + cuencaKey + '.geojson')
        .then(r => r.json())
        .then(fc => {
          const lyr = L.geoJSON(fc, {
            style: () => ({ color: cuencaColor, weight: 2, fillColor: cuencaColor, fillOpacity: 0.06, dashArray: '6,4' })
          });
          LAYERS[cuencaKey] = lyr;
          lyr.addTo(map);
          _initBounds = lyr.getBounds();
          map.fitBounds(_initBounds, { padding: [20, 20], maxZoom: 9 });
        })
        .catch(() => {});
    }

    preloadLayers();
  }

  return { init, setLayer, fitToLayers, resetView, buildMon: () => {} };
})();

document.addEventListener('DOMContentLoaded', MAP.init);
