import {
  categories,
  locations,
  seed,
  getReports,
  saveReport,
  locationName,
  getSession,
  endSession,
  formatDate,
  escapeHTML as esc,
} from "./data.js";

const $ = (selector) => document.querySelector(selector);

//Transiciones válidas definidas
const VALID_TRANSITIONS = {
  "Recibido": ["En proceso", "Rechazado/Cerrado"],
  "En proceso": ["En espera de materiales/autorización", "Resuelto"],
  "En espera de materiales/autorización": ["En proceso"],
  "Resuelto": [],
  "Rechazado/Cerrado": [],
};

const FINAL_STATES = ["Resuelto", "Rechazado/Cerrado"];

const PRIORITY_RANK = {
  "Alta": 1,
  "Media": 2,
  "Baja": 3,
  "Sin asignar": 4,
};

let allReports = [];
let activeDetailReport = null;
let photoURLs = [];
let toastTimer;

//Sesión activa
const sessionUser = getSession();
const CURRENT_USER = sessionUser?.name
  ? `${sessionUser.name} (Mantenimiento)`
  : "Personal de Mantenimiento";

if ($("#account-link") && sessionUser?.name) {
  $("#account-link").textContent = sessionUser.name;
}

$("#logout")?.addEventListener("click", () => {
  endSession();
  location.assign("index.html");
});

//Menú móvil (mismo comportamiento que index.js)
$(".menu-toggle")?.addEventListener("click", () => {
  const open = $("#main-nav").classList.toggle("open");
  $(".menu-toggle").setAttribute("aria-expanded", String(open));
  $(".menu-toggle").setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#main-nav")?.classList.contains("open")) {
    $(".menu-toggle").click();
    $(".menu-toggle").focus();
  }
});

//Notificaciones temporales
function showToast(msg) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = msg;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.hidden = true;
  }, 4000);
}

//Poblar filtros desde el catálogo compartido en data.js
function populateCatalogFilters() {
  const catSelect = $("#order-filter-category");
  const locSelect = $("#order-filter-location");

  if (catSelect) {
    for (const item of categories) {
      const opt = document.createElement("option");
      opt.value = typeof item === "string" ? item : item.id;
      opt.textContent = typeof item === "string" ? item : item.name;
      catSelect.append(opt);
    }
  }

  if (locSelect) {
    for (const item of locations) {
      const opt = document.createElement("option");
      opt.value = typeof item === "string" ? item : item.id;
      opt.textContent = typeof item === "string" ? item : item.name;
      locSelect.append(opt);
    }
  }
}

function statusBadge(status) {
  const map = {
    "Recibido": "badge-recibido",
    "En proceso": "badge-proceso",
    "En espera de materiales/autorización": "badge-espera",
    "Resuelto": "badge-resuelto",
    "Rechazado/Cerrado": "badge-cerrado",
  };
  return `<span class="badge ${map[status] || ""}">${esc(status)}</span>`;
}

function priorityLabel(prio) {
  const value = prio || "Sin asignar";
  if (value === "Alta") return '<span class="prio-alta">Alta</span>';
  if (value === "Media") return '<span class="prio-media">Media</span>';
  if (value === "Baja") return '<span class="prio-baja">Baja</span>';
  return '<span class="prio-baja">Sin asignar</span>';
}

function releaseDetailPhotos() {
  photoURLs.forEach(URL.revokeObjectURL);
  photoURLs = [];
}

function updateKPIs() {
  $("#kpi-recibido").textContent = allReports.filter((r) => r.state === "Recibido").length;
  $("#kpi-proceso").textContent = allReports.filter((r) => r.state === "En proceso").length;
  $("#kpi-espera").textContent = allReports.filter(
    (r) => r.state === "En espera de materiales/autorización",
  ).length;
  $("#kpi-finalizados").textContent = allReports.filter((r) =>
    FINAL_STATES.includes(r.state),
  ).length;
}

function renderTables() {
  updateKPIs();

  const q = $("#order-search").value.trim().toLowerCase();
  const cat = $("#order-filter-category").value;
  const loc = $("#order-filter-location").value;
  const st = $("#order-filter-status").value;
  const urg = $("#order-filter-urgency").value;

  //Filtrado operativo y ordenamiento por prioridad oficial
  const openReports = allReports
    .filter((r) => {
      if (FINAL_STATES.includes(r.state)) return false;
      if (cat && r.category !== cat) return false;
      if (loc && r.location !== loc) return false;
      if (st && r.state !== st) return false;
      const perceived = r.urgency || r.perceivedUrgency || "Media";
      if (urg && perceived !== urg) return false;
      if (q) {
        const haystack = `${r.code} ${r.description} ${r.reference || ""} ${locationName(r.location)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const rankA = PRIORITY_RANK[a.officialPriority || "Sin asignar"] || 9;
      const rankB = PRIORITY_RANK[b.officialPriority || "Sin asignar"] || 9;
      if (rankA !== rankB) return rankA - rankB;
      return (b.created || "").localeCompare(a.created || "");
    });

  $("#orders-count").textContent = `${openReports.length} incidencia(s) abierta(s)`;
  $("#orders-table-container").hidden = openReports.length === 0;
  $("#orders-empty-state").hidden = openReports.length > 0;

  $("#orders-table-body").innerHTML = openReports
    .map((r) => {
      const perceived = r.urgency || r.perceivedUrgency || "No indicada";
      return `
        <tr>
          <td><span class="code-tag">${esc(r.code)}</span></td>
          <td>${esc(formatDate(r.created))}</td>
          <td>
            <strong>${esc(r.category)}</strong><br />
            <span style="color: var(--muted); font-size: 0.8rem;">Urgencia percibida: ${esc(perceived)}</span>
          </td>
          <td>
            <strong>${esc(locationName(r.location))}</strong><br />
            <span style="color: var(--muted); font-size: 0.8rem;">${esc(r.reference || "Sin referencia")}</span>
          </td>
          <td>${priorityLabel(r.officialPriority)}</td>
          <td>${statusBadge(r.state)}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="button button-small" data-action="manage" data-code="${esc(r.code)}">
                Gestionar
              </button>
              <button type="button" class="button button-small button-outline" data-action="detail" data-code="${esc(r.code)}">
                Expediente
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  const closedReports = allReports
    .filter((r) => FINAL_STATES.includes(r.state))
    .sort((a, b) => (b.created || "").localeCompare(a.created || ""));

  $("#history-count").textContent = `${closedReports.length} expediente(s) en estado final`;
  $("#history-table-container").hidden = closedReports.length === 0;
  $("#history-empty-state").hidden = closedReports.length > 0;

  $("#history-table-body").innerHTML = closedReports
    .map(
      (r) => `
      <tr>
        <td><span class="code-tag">${esc(r.code)}</span></td>
        <td>${esc(formatDate(r.created))}</td>
        <td><strong>${esc(r.category)}</strong></td>
        <td>${esc(locationName(r.location))}${r.reference ? ` · ${esc(r.reference)}` : ""}</td>
        <td>${statusBadge(r.state)}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="button button-small button-outline" data-action="detail" data-code="${esc(r.code)}">
              Ver expediente
            </button>
          </div>
        </td>
      </tr>
    `,
    )
    .join("");
}

//Cambio de pestañas
function switchTab(showClosed) {
  $("#tab-activas-btn").setAttribute("aria-selected", String(!showClosed));
  $("#tab-historial-btn").setAttribute("aria-selected", String(showClosed));
  $("#section-activas").hidden = showClosed;
  $("#section-historial").hidden = !showClosed;
}

$("#tab-activas-btn")?.addEventListener("click", () => switchTab(false));
$("#tab-historial-btn")?.addEventListener("click", () => switchTab(true));

//Eventos de filtros
[
  "#order-search",
  "#order-filter-category",
  "#order-filter-location",
  "#order-filter-status",
  "#order-filter-urgency",
].forEach((sel) => {
  $(sel)?.addEventListener("input", renderTables);
  $(sel)?.addEventListener("change", renderTables);
});

$("#btn-clear-order-filters")?.addEventListener("click", () => {
  $("#order-search").value = "";
  $("#order-filter-category").value = "";
  $("#order-filter-location").value = "";
  $("#order-filter-status").value = "";
  $("#order-filter-urgency").value = "";
  renderTables();
});

//Contador de caracteres en vivo (>= 10 caracteres)
$("#manage-order-observation")?.addEventListener("input", () => {
  const len = $("#manage-order-observation").value.trim().length;
  $("#observation-char-count").textContent = `${len} / 10 caracteres mínimos`;
});

//Apertura de modales (Gestionar y Expediente completo)
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest("[data-close-modal]");
  if (closeBtn) {
    document.getElementById(closeBtn.dataset.closeModal)?.close();
    return;
  }

  const actionBtn = e.target.closest("[data-action]");
  if (!actionBtn) return;

  const r = allReports.find((item) => item.code === actionBtn.dataset.code);
  if (!r) return;

  if (actionBtn.dataset.action === "manage") {
    if (FINAL_STATES.includes(r.state)) {
      showToast("Los estados Resuelto y Rechazado/Cerrado son finales y no admiten edición.");
      return;
    }

    $("#manage-order-id").value = r.code;
    $("#manage-order-code").textContent = r.code;
    $("#manage-order-current-status").innerHTML = statusBadge(r.state);
    $("#manage-order-perceived").textContent = r.urgency || r.perceivedUrgency || "No indicada";
    $("#manage-order-location").textContent = `${locationName(r.location)}${r.reference ? ` (${r.reference})` : ""}`;
    $("#manage-order-desc").textContent = r.description;

    $("#manage-order-priority").value = r.officialPriority || "Sin asignar";

    //Transiciones permitidas según estado vigente
    const allowed = VALID_TRANSITIONS[r.state] || [];
    $("#manage-order-next-status").innerHTML =
      `<option value="">Mantener estado actual (${esc(r.state)})</option>` +
      allowed.map((st) => `<option value="${esc(st)}">Cambiar a: ${esc(st)}</option>`).join("");

    $("#manage-order-observation").value = "";
    $("#observation-char-count").textContent = "0 / 10 caracteres mínimos";
    $("#manage-observation-error").textContent = "";
    $("#modal-manage-order").showModal();
  }

  if (actionBtn.dataset.action === "detail") {
    activeDetailReport = r;
    releaseDetailPhotos();
    $("#detail-final-alert").hidden = !FINAL_STATES.includes(r.state);

    const reporterInfo = r.reporterName
      ? `${esc(r.reporterName)}${r.reporterLink ? ` (${esc(r.reporterLink)})` : ""}`
      : "Reporte anónimo (RF-04)";

    const historyHtml = `
      <ul class="history-list">
        ${(r.history || [])
          .map(
            (h) => `
            <li>
              <div class="history-meta">
                <span>${statusBadge(h.state)} ${h.author ? `· <strong>${esc(h.author)}</strong>` : ""}</span>
                <span>${esc(formatDate(h.date))}</span>
              </div>
              <div>${esc(h.note)}</div>
            </li>
          `,
          )
          .join("")}
      </ul>
    `;

    // Expediente completo autorizado
    $("#detail-content").innerHTML = `
      <div><dt>Código único</dt><dd class="code-tag">${esc(r.code)}</dd></div>
      <div><dt>Fecha de registro</dt><dd>${esc(formatDate(r.created))}</dd></div>
      <div><dt>Estado vigente</dt><dd>${statusBadge(r.state)}</dd></div>
      <div><dt>Prioridad técnica oficial</dt><dd>${priorityLabel(r.officialPriority)}</dd></div>
      <div><dt>Urgencia percibida</dt><dd>${esc(r.urgency || r.perceivedUrgency || "No indicada")}</dd></div>
      <div><dt>Área solicitante</dt><dd>${esc(r.requestingArea || "Comunidad universitaria")}</dd></div>
      <div class="detail-full"><dt>Ubicación física</dt><dd>${esc(locationName(r.location))}${r.reference ? ` · ${esc(r.reference)}` : ""}</dd></div>
      <div class="detail-full"><dt>Reportante (solo visible a personal autorizado)</dt><dd>${reporterInfo}</dd></div>
      <div class="detail-full"><dt>Descripción del daño</dt><dd>${esc(r.description)}</dd></div>
      <div class="detail-full"><dt>Evidencia fotográfica adjunta (RF-03)</dt><dd id="detail-photos-slot">Sin fotografías adjuntas</dd></div>
      <div class="detail-full"><dt>Historial cronológico y trazabilidad (RF-18)</dt><dd>${historyHtml}</dd></div>
    `;

    //Renderizar Blobs/Files reales almacenados en IndexedDB(base de datos pendiente)
    if (r.photos?.length) {
      const slot = $("#detail-photos-slot");
      slot.innerHTML = '<div class="photo-strip"></div>';
      const strip = slot.querySelector(".photo-strip");
      r.photos.forEach((photo, idx) => {
        if (photo instanceof Blob) {
          const url = URL.createObjectURL(photo);
          photoURLs.push(url);
          const link = document.createElement("a");
          link.href = url;
          link.target = "_blank";
          link.rel = "noopener";
          link.className = "photo-placeholder";
          link.textContent = `📷 ${photo.name || `Fotografía ${idx + 1}`}`;
          strip.append(link);
        } else {
          const tag = document.createElement("span");
          tag.className = "photo-placeholder";
          tag.textContent = `📷 ${String(photo)}`;
          strip.append(tag);
        }
      });
    }

    $("#modal-order-detail").showModal();
  }
});

//Guardar cambios en IndexedDB mediante saveReport()
$("#form-manage-order")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const code = $("#manage-order-id").value;
  const r = allReports.find((item) => item.code === code);
  if (!r || FINAL_STATES.includes(r.state)) return;

  const newPriority = $("#manage-order-priority").value;
  const nextStatus = $("#manage-order-next-status").value;
  const observation = $("#manage-order-observation").value.trim();

  const errEl = $("#manage-observation-error");
  errEl.textContent = "";

  const currentPriority = r.officialPriority || "Sin asignar";
  const priorityChanged = newPriority !== currentPriority;
  const statusChanged = Boolean(nextStatus);

  if (!priorityChanged && !statusChanged) {
    errEl.textContent = "Selecciona una nueva prioridad oficial o una transición de estado.";
    return;
  }

  //Validación estricta
  if (statusChanged) {
    const allowed = VALID_TRANSITIONS[r.state] || [];
    if (!allowed.includes(nextStatus)) {
      errEl.textContent = "Transición de estado no permitida según la regla RN-02.";
      return;
    }
    if (observation.length < 10) {
      errEl.textContent =
        "La observación técnica es obligatoria y debe tener al menos 10 caracteres (RF-18).";
      return;
    }
  }

  const nowISO = new Date().toISOString();
  r.history = r.history || [];

  if (priorityChanged) {
    r.officialPriority = newPriority;
  }

  if (statusChanged) {
    r.state = nextStatus;
    r.history.push({
      date: nowISO,
      state: nextStatus,
      note: observation,
      author: CURRENT_USER,
    });
  } else if (observation.length >= 10) {
    r.history.push({
      date: nowISO,
      state: r.state,
      note: `[Prioridad oficial: ${newPriority}] ${observation}`,
      author: CURRENT_USER,
    });
  }

  try {
    await saveReport(r);
    $("#modal-manage-order").close();
    renderTables();
    showToast(
      statusChanged
        ? `Incidencia ${r.code} actualizada a "${nextStatus}" y guardada en el navegador.`
        : `Prioridad oficial de ${r.code} actualizada a "${newPriority}".`,
    );
  } catch {
    errEl.textContent = "No se pudo guardar el cambio en el almacenamiento local del navegador.";
  }
});

//Comprobante imprimible PDF tamaño carta
$("#btn-print-receipt")?.addEventListener("click", () => {
  if (!activeDetailReport) return;
  const r = activeDetailReport;
  const lastObs = r.history?.[r.history.length - 1];
  const win = window.open("", "_blank", "width=820,height=900");
  if (!win) {
    showToast("Habilita las ventanas emergentes para imprimir el comprobante.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8" />
      <title>Comprobante ${esc(r.code)} · Reportes UES</title>
      <style>
        body { font-family: Arial, sans-serif; color: #111; margin: 36px; line-height: 1.45; }
        header { border-bottom: 2px solid #a60000; padding-bottom: 12px; margin-bottom: 20px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        p.sub { margin: 0; font-size: 12px; color: #444; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
        th, td { border: 1px solid #bbb; padding: 9px 12px; text-align: left; vertical-align: top; }
        th { width: 32%; background: #f5f5f5; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 56px; }
        .sig-box { border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; min-height: 70px; }
        .seal-box { border: 1px dashed #777; height: 90px; display: flex; align-items: center; justify-content: center; color: #666; font-size: 11px; margin-top: 18px; }
        @media print { body { margin: 18mm; } }
      </style>
    </head>
    <body>
      <header>
        <h1>UNIVERSIDAD DE EL SALVADOR · FACULTAD MULTIDISCIPLINARIA ORIENTAL</h1>
        <p class="sub">Comprobante Institucional de Incidencia de Infraestructura (RF-20)</p>
      </header>
      <table>
        <tr><th>Código único de seguimiento</th><td><strong>${esc(r.code)}</strong></td></tr>
        <tr><th>Fecha y hora de registro</th><td>${esc(formatDate(r.created))}</td></tr>
        <tr><th>Área solicitante</th><td>${esc(r.requestingArea || "Comunidad universitaria")}</td></tr>
        <tr><th>Categoría de daño</th><td>${esc(r.category)}</td></tr>
        <tr><th>Ubicación física</th><td>${esc(locationName(r.location))}${r.reference ? ` · ${esc(r.reference)}` : ""}</td></tr>
        <tr><th>Estado actual</th><td>${esc(r.state)}</td></tr>
        <tr><th>Prioridad técnica oficial</th><td>${esc(r.officialPriority || "Sin asignar")}</td></tr>
        <tr><th>Descripción del daño</th><td>${esc(r.description)}</td></tr>
        <tr><th>Última observación técnica</th><td>${lastObs ? `${esc(lastObs.note)} (${esc(formatDate(lastObs.date))})` : "Sin observaciones"}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig-box">
          Firma y nombre · Unidad de Mantenimiento / Desarrollo Físico
          <div class="seal-box">Sello de la unidad operativa</div>
        </div>
        <div class="sig-box">
          Firma y nombre · Jefatura / Unidad solicitante (Recibido)
          <div class="seal-box">Sello de recepción</div>
        </div>
      </div>
      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `);
  win.document.close();
});

window.addEventListener("pagehide", releaseDetailPhotos);

//Inicialización
async function init() {
  populateCatalogFilters();
  try {
    await seed();
    allReports = await getReports();
    renderTables();
  } catch {
    $("#orders-count").textContent = "Error al cargar los datos locales.";
    showToast("No se pudo acceder a la base de datos local del navegador.");
  }
}

init();