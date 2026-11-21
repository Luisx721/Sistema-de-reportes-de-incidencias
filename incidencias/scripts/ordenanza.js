import {
  categories,
  locations,
  states,
  seed,
  getReports,
  saveReport,
  locationName,
  getSession,
  endSession,
  formatDate,
  escapeHTML as esc,
  badge,
} from "./data.js";

const $ = (selector) => document.querySelector(selector);

const FINAL_STATES = ["Resuelto", "Rechazado/Cerrado"];

// Sesión y área/ubicación asignada al perfil de Ordenanza 
const sessionUser = getSession();
const ASSIGNED_AREA = sessionUser?.area || "Ordenanzas · Sector General";
const ASSIGNED_LOCATION = sessionUser?.location || "";
const CURRENT_USER = sessionUser?.name || "Personal de Ordenanza";

let allReports = [];
let selectedPhotos = [];
let pendingFiles = Promise.resolve();
let activeDetailReport = null;
let detailPhotoURLs = [];
let toastTimer;

if ($("#account-link")) {
  $("#account-link").textContent = CURRENT_USER;
}
if ($("#sector-eyebrow")) {
  $("#sector-eyebrow").textContent = `CONTROL DE SECTOR · ${ASSIGNED_AREA.toUpperCase()}`;
}
if ($("#ord-area")) {
  $("#ord-area").value = ASSIGNED_AREA;
}

$("#logout")?.addEventListener("click", () => {
  endSession();
  location.assign("index.html");
});

// Menú móvil
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

function showToast(msg) {
  const box = $("#toast");
  if (!box) return;
  box.textContent = msg;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    box.hidden = true;
  }, 4200);
}

// Poblar catálogos compartidos
function populateCatalogs() {
  const targets = [$("#area-filter-category"), $("#ord-category")];
  for (const select of targets) {
    if (!select) continue;
    for (const item of categories) {
      const opt = document.createElement("option");
      opt.value = typeof item === "string" ? item : item.id;
      opt.textContent = typeof item === "string" ? item : item.name;
      select.append(opt);
    }
  }

  const locTargets = [$("#area-filter-location"), $("#ord-location")];
  for (const select of locTargets) {
    if (!select) continue;
    for (const item of locations) {
      const opt = document.createElement("option");
      opt.value = typeof item === "string" ? item : item.id;
      opt.textContent = typeof item === "string" ? item : item.name;
      select.append(opt);
    }
  }
}

// Filtra exclusivamente los reportes vinculados al área o sector asignado
function getAreaReports() {
  return allReports.filter(
    (r) =>
      r.requestingArea === ASSIGNED_AREA ||
      (ASSIGNED_LOCATION && r.location === ASSIGNED_LOCATION),
  );
}

function updateKPIs(areaReports) {
  $("#kpi-recibido").textContent = areaReports.filter((r) => r.state === "Recibido").length;
  $("#kpi-proceso").textContent = areaReports.filter((r) => r.state === "En proceso").length;
  $("#kpi-espera").textContent = areaReports.filter(
    (r) => r.state === "En espera de materiales/autorización",
  ).length;
  $("#kpi-finalizados").textContent = areaReports.filter((r) =>
    FINAL_STATES.includes(r.state),
  ).length;
}

function renderAreaTable() {
  const areaReports = getAreaReports();
  updateKPIs(areaReports);

  const q = $("#area-search").value.trim().toLowerCase();
  const cat = $("#area-filter-category").value;
  const loc = $("#area-filter-location").value;
  const st = $("#area-filter-status").value;

  const filtered = areaReports
    .filter((r) => {
      if (cat && r.category !== cat) return false;
      if (loc && r.location !== loc) return false;
      if (st && r.state !== st) return false;
      if (q) {
        const haystack = `${r.code} ${r.description} ${r.reference || ""} ${locationName(r.location)}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (b.created || "").localeCompare(a.created || ""));

  $("#area-count").textContent = `${filtered.length} reporte(s) en ${ASSIGNED_AREA}`;
  $("#area-table-container").hidden = filtered.length === 0;
  $("#area-empty-state").hidden = filtered.length > 0;

  $("#area-table-body").innerHTML = filtered
    .map(
      (r) => `
      <tr>
        <td><span class="code-tag">${esc(r.code)}</span></td>
        <td>${esc(formatDate(r.created))}</td>
        <td><strong>${esc(r.category)}</strong></td>
        <td>
          <strong>${esc(locationName(r.location))}</strong><br />
          <span style="color: var(--muted); font-size: 0.8rem;">${esc(r.reference || "Sin referencia")}</span>
        </td>
        <td>${badge(r.state)}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="button button-small button-outline" data-action="detail" data-code="${esc(r.code)}">
              Ver seguimiento
            </button>
          </div>
        </td>
      </tr>
    `,
    )
    .join("");
}

// Cambio de pestañas
function switchTab(showForm) {
  $("#tab-mis-reportes-btn").setAttribute("aria-selected", String(!showForm));
  $("#tab-nuevo-reporte-btn").setAttribute("aria-selected", String(showForm));
  $("#section-mis-reportes").hidden = showForm;
  $("#section-nuevo-reporte").hidden = !showForm;
}

$("#tab-mis-reportes-btn")?.addEventListener("click", () => switchTab(false));
$("#tab-nuevo-reporte-btn")?.addEventListener("click", () => switchTab(true));

// Filtros de consulta por área
[
  "#area-search",
  "#area-filter-category",
  "#area-filter-location",
  "#area-filter-status",
].forEach((sel) => {
  $(sel)?.addEventListener("input", renderAreaTable);
  $(sel)?.addEventListener("change", renderAreaTable);
});

$("#btn-clear-area-filters")?.addEventListener("click", () => {
  $("#area-search").value = "";
  $("#area-filter-category").value = "";
  $("#area-filter-location").value = "";
  $("#area-filter-status").value = "";
  renderAreaTable();
});


let previewURLs = [];

function clearPreviewURLs() {
  previewURLs.forEach(URL.revokeObjectURL);
  previewURLs = [];
}

// Vista previa de fotografías seleccionadas
function renderPhotoPreviews() {
  clearPreviewURLs();
  const previews = $("#ord-photo-previews");
  previews.replaceChildren();

  selectedPhotos.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewURLs.push(url);

    const card = document.createElement("div");
    card.className = "photo-preview";

    const image = document.createElement("img");
    image.src = url;
    image.alt = `Vista previa: ${file.name}`;

    const name = document.createElement("p");
    name.textContent = file.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Quitar ${file.name}`);
    remove.addEventListener("click", () => {
      selectedPhotos.splice(index, 1);
      renderPhotoPreviews();
      $("#ord-photos-error").textContent = "";
      $("#ord-photos").focus();
    });

    card.append(image, remove, name);
    previews.append(card);
  });
}

// Validación de fotos (1-3 fotos JPG/PNG <= 5 MB + createImageBitmap)
async function processOrderPhotos(files) {
  const incoming = Array.from(files || []);
  const errors = [];
  const good = [];

  for (const file of incoming) {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      errors.push(`${file.name}: solo JPG y PNG.`);
      continue;
    }
    if (file.size > 5 * 1024 * 1024) {
      errors.push(`${file.name}: supera 5 MB.`);
      continue;
    }
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      good.push(file);
    } catch {
      errors.push(`${file.name}: la imagen no se puede abrir.`);
    }
  }

  if (selectedPhotos.length + good.length > 3) {
    errors.push(
      "Puedes adjuntar hasta 3 fotografías. No se agregó esta selección; elige menos imágenes.",
    );
  } else {
    selectedPhotos.push(...good);
  }

  $("#ord-photos-error").textContent = errors.join(" ");
  $("#ord-photos").value = "";
  renderPhotoPreviews();
}

function queueOrderFiles(files) {
  pendingFiles = pendingFiles
    .then(() => processOrderPhotos(files))
    .catch(() => {
      $("#ord-photos-error").textContent =
        "No se pudieron procesar las fotografías. Vuelve a seleccionarlas.";
    });
}

$("#ord-photos")?.addEventListener("change", (e) => queueOrderFiles(e.target.files));

// Arrastre de archivos al dropzone
const ordDropzone = $("#dropzone");
if (ordDropzone) {
  ["dragenter", "dragover"].forEach((name) =>
    ordDropzone.addEventListener(name, (event) => {
      event.preventDefault();
      ordDropzone.classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    ordDropzone.addEventListener(name, (event) => {
      event.preventDefault();
      ordDropzone.classList.remove("dragging");
    }),
  );
  ordDropzone.addEventListener("drop", (event) =>
    queueOrderFiles(event.dataTransfer.files),
  );
}

window.addEventListener("pagehide", clearPreviewURLs);

// Contador de descripción ( >= 20 caracteres)
$("#ord-description")?.addEventListener("input", () => {
  const len = $("#ord-description").value.trim().length;
  $("#ord-char-count").textContent = `${len} / 2000 (mínimo 20 caracteres)`;
});

// Registro de incidencia por ordenanza sin reiniciar el formulario si hay errores
$("#form-ordenanza-report")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  await pendingFiles;

  const cat = $("#ord-category").value;
  const loc = $("#ord-location").value;
  const ref = $("#ord-reference").value.trim();
  const desc = $("#ord-description").value.trim();

  $("#ord-category-error").textContent = "";
  $("#ord-location-error").textContent = "";
  $("#ord-description-error").textContent = "";

  let hasError = false;
  if (!categories.includes(cat)) {
    $("#ord-category-error").textContent = "Selecciona una categoría válida.";
    hasError = true;
  }
  if (!locations.some((l) => l.id === loc)) {
    $("#ord-location-error").textContent = "Selecciona una ubicación válida.";
    hasError = true;
  }
  if (desc.length < 20) {
    $("#ord-description-error").textContent =
      "La descripción del daño debe tener al menos 20 caracteres.";
    hasError = true;
  }
  if (hasError) return;

  const nowISO = new Date().toISOString();
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const code =
    "UES" +
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

  const newRecord = {
    code,
    created: nowISO,
    state: states[0] || "Recibido",
    category: cat,
    location: loc,
    reference: ref,
    description: desc,
    reporterName: CURRENT_USER,
    reporterLink: "Ordenanza",
    requestingArea: ASSIGNED_AREA,
    officialPriority: "Sin asignar",
    photos: [...selectedPhotos],
    history: [
      {
        date: nowISO,
        state: states[0] || "Recibido",
        note: `Reporte registrado por ordenanza (${ASSIGNED_AREA}). Pendiente de revisión.`,
      },
    ],
    sample: false,
  };

  try {
    await saveReport(newRecord);
    allReports.push(newRecord);
    $("#form-ordenanza-report").reset();
    $("#ord-area").value = ASSIGNED_AREA;
    $("#ord-char-count").textContent = "0 / 2000 (mínimo 20 caracteres)";
    $("#ord-photo-previews").innerHTML = "";
    selectedPhotos = [];
    renderAreaTable();
    switchTab(false);
    showToast(`Incidencia registrada con código ${code} en estado Recibido.`);
  } catch {
    showToast("No se pudo guardar el reporte en el navegador.");
  }
});

$("#btn-reset-ord-form")?.addEventListener("click", () => {
  setTimeout(() => {
    $("#ord-area").value = ASSIGNED_AREA;
    $("#ord-char-count").textContent = "0 / 2000 (mínimo 20 caracteres)";
    $("#ord-photo-previews").innerHTML = "";
    $("#ord-category-error").textContent = "";
    $("#ord-location-error").textContent = "";
    $("#ord-description-error").textContent = "";
    $("#ord-photos-error").textContent = "";
    selectedPhotos = [];
  }, 0);
});

function releaseDetailPhotos() {
  detailPhotoURLs.forEach(URL.revokeObjectURL);
  detailPhotoURLs = [];
}

// Modal de consulta de historial del reporte de su área
document.addEventListener("click", (e) => {
  const closeBtn = e.target.closest("[data-close-modal]");
  if (closeBtn) {
    document.getElementById(closeBtn.dataset.closeModal)?.close();
    return;
  }

  const actionBtn = e.target.closest("[data-action='detail']");
  if (!actionBtn) return;

  const r = getAreaReports().find((item) => item.code === actionBtn.dataset.code);
  if (!r) return;

  activeDetailReport = r;
  releaseDetailPhotos();

  const historyHtml = `
    <ul class="history-list">
      ${(r.history || [])
        .map(
          (h) => `
          <li>
            <div class="history-meta">
              <span>${badge(h.state)}</span>
              <span>${esc(formatDate(h.date))}</span>
            </div>
            <div>${esc(h.note)}</div>
          </li>
        `,
        )
        .join("")}
    </ul>
  `;

  $("#area-detail-content").innerHTML = `
    <div><dt>Código único</dt><dd class="code-tag">${esc(r.code)}</dd></div>
    <div><dt>Fecha de registro</dt><dd>${esc(formatDate(r.created))}</dd></div>
    <div><dt>Estado vigente</dt><dd>${badge(r.state)}</dd></div>
    <div><dt>Área solicitante</dt><dd>${esc(r.requestingArea || ASSIGNED_AREA)}</dd></div>
    <div class="detail-full"><dt>Ubicación física</dt><dd>${esc(locationName(r.location))}${r.reference ? ` · ${esc(r.reference)}` : ""}</dd></div>
    <div class="detail-full"><dt>Descripción del daño</dt><dd>${esc(r.description)}</dd></div>
    <div class="detail-full"><dt>Evidencia fotográfica adjunta</dt><dd id="ord-detail-photos-slot">Sin fotografías adjuntas</dd></div>
    <div class="detail-full"><dt>Historial cronológico de atención</dt><dd>${historyHtml}</dd></div>
  `;

  if (r.photos?.length) {
    const slot = $("#ord-detail-photos-slot");
    slot.innerHTML = '<div class="photo-strip"></div>';
    const strip = slot.querySelector(".photo-strip");
    r.photos.forEach((photo, idx) => {
      if (photo instanceof Blob) {
        const url = URL.createObjectURL(photo);
        detailPhotoURLs.push(url);
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

  $("#modal-area-detail").showModal();
});

// Comprobante imprimible PDF
$("#btn-ord-print-receipt")?.addEventListener("click", () => {
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
        <tr><th>Área solicitante</th><td>${esc(r.requestingArea || ASSIGNED_AREA)}</td></tr>
        <tr><th>Categoría de daño</th><td>${esc(r.category)}</td></tr>
        <tr><th>Ubicación física</th><td>${esc(locationName(r.location))}${r.reference ? ` · ${esc(r.reference)}` : ""}</td></tr>
        <tr><th>Estado actual</th><td>${esc(r.state)}</td></tr>
        <tr><th>Descripción del daño</th><td>${esc(r.description)}</td></tr>
        <tr><th>Última observación técnica</th><td>${lastObs ? `${esc(lastObs.note)} (${esc(formatDate(lastObs.date))})` : "Sin observaciones"}</td></tr>
      </table>
      <div class="signatures">
        <div class="sig-box">
          Firma y nombre · Unidad de Mantenimiento / Desarrollo Físico
          <div class="seal-box">Sello de la unidad operativa</div>
        </div>
        <div class="sig-box">
          Firma y nombre · Ordenanza / Jefatura de sector
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

// Inicialización
async function init() {
  populateCatalogs();
  try {
    await seed();
    allReports = await getReports();
    renderAreaTable();
  } catch {
    $("#area-count").textContent = "Error al cargar los datos locales.";
    showToast("No se pudo acceder a la base de datos local del navegador.");
  }
}

init();