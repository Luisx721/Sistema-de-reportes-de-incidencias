// Datos y funciones compartidas
import {
  categories,
  locations,
  states,
  seed,
  getReports,
  getReport,
  saveReport,
  locationName,
  getSession,
  endSession,
  formatDate,
  escapeHTML as esc,
  badge,
} from "./data.js";

// Elementos de la página
const $ = (selector) => document.querySelector(selector);
const page = document.body.dataset.page;
const query = new URLSearchParams(location.search);

// Iconos de la interfaz
const arrow = /* HTML */ `
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    aria-hidden="true"
  >
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
`;
const pin = /* HTML */ `
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    aria-hidden="true"
  >
    <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
    <circle cx="12" cy="10" r="2" />
  </svg>
`;

// Notificaciones temporales
let toastTimer;
function toast(text) {
  const box = $("#toast");
  box.textContent = text;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.hidden = true), 5000);
}

// Menú de navegación en teléfonos
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

// Nombre y cierre de la sesión de demostración
const user = getSession();
if (user?.demo) {
  $("#account-link").textContent = user.name;
  $("#account-link").href = "index.html";
  $("#account-link").title = "Sesión de demostración · Reportante";
  $("#logout").hidden = false;
}
$("#logout")?.addEventListener("click", () => {
  endSession();
  location.assign("index.html");
});

// Opciones de los selectores
function options(select, items) {
  if (!select) return;
  for (const item of items) {
    const option = document.createElement("option");
    option.value = typeof item === "string" ? item : item.id;
    option.textContent = typeof item === "string" ? item : item.name;
    select.append(option);
  }
}

// Presentación de una incidencia en el listado
function row(r) {
  return /* HTML */ `
    <a class="incident-row" href="seguimiento.html?codigo=${encodeURIComponent(r.code)}">
      <span class="row-icon">${pin}</span>
      <div>
        <h3>${esc(r.category)} · ${esc(locationName(r.location))}</h3>
        <p>
          <span>${esc(r.code)}</span>
          <span>${esc(formatDate(r.created))}</span>
          ${r.sample
            ? /* HTML */ `
                <span>Ejemplo</span>
              `
            : ""}
        </p>
      </div>
      ${badge(r.state)}${arrow}
    </a>
  `;
}

// Mensaje de error al cargar los reportes
function failure(
  container,
  message = "No se pudo acceder a los reportes locales. Comprueba que el navegador permita almacenar datos y vuelve a cargar la página.",
) {
  container.innerHTML = /* HTML */ `
    <div class="empty-state" role="alert">
      <h2>No pudimos cargar la información</h2>
      <p>${esc(message)}</p>
    </div>
  `;
}

// Orden de los reportes más recientes
function sortReports(reports) {
  return reports.sort((a, b) => b.created.localeCompare(a.created));
}

// Incidencias recientes del inicio
async function home() {
  try {
    await seed();
    const reports = sortReports(await getReports());
    $("#home-incidents").innerHTML = reports.slice(0, 3).map(row).join("");
  } catch {
    failure($("#home-incidents"));
  }
}

// Información e historial de un reporte
function renderDetails(r) {
  const html = /* HTML */ `
    <div class="detail-header">
      <div>
        <p class="eyebrow">
          ${r.sample ? "REPORTE DE EJEMPLO" : "REPORTE LOCAL DE DEMOSTRACIÓN"}
        </p>
        <h2 class="detail-code">${esc(r.code)}</h2>
      </div>
      ${badge(r.state)}
    </div>
    <div class="detail-layout">
      <article class="surface detail-panel">
        <h2>Información del reporte</h2>
        <dl class="detail-data">
          <div>
            <dt>Categoría</dt>
            <dd>${esc(r.category)}</dd>
          </div>
          <div>
            <dt>Ubicación</dt>
            <dd>${esc(locationName(r.location))}</dd>
          </div>
          <div>
            <dt>Fecha de registro</dt>
            <dd>${esc(formatDate(r.created))}</dd>
          </div>
          <div>
            <dt>Referencia</dt>
            <dd>${esc(r.reference || "Sin referencia adicional")}</dd>
          </div>
        </dl>
        <h3>Descripción</h3>
        <p class="report-description">${esc(r.description)}</p>
        ${r.photos?.length
          ? /* HTML */ `
              <h3>Fotografías adjuntas</h3>
              <div class="detail-images" id="detail-images"></div>
            `
          : ""}
      </article>
      <article class="surface detail-panel">
        <h2>Historial de atención</h2>
        <ol class="timeline">
          ${r.history
            .map(
              (h) => /* HTML */ `
                <li>
                  <strong>${esc(h.state)}</strong>
                  <time datetime="${esc(h.date)}">${esc(formatDate(h.date))}</time>
                  <p>${esc(h.note)}</p>
                </li>
              `,
            )
            .join("")}
        </ol>
      </article>
    </div>
  `;
  return html;
}

// Fotografías del reporte consultado
let detailURLs = [];
function releaseDetailImages() {
  detailURLs.forEach(URL.revokeObjectURL);
  detailURLs = [];
}
function showDetailImages(r) {
  releaseDetailImages();
  const gallery = $("#detail-images");
  if (!gallery) return;
  r.photos.forEach((photo, i) => {
    const url = URL.createObjectURL(photo);
    detailURLs.push(url);
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.setAttribute("aria-label", `Abrir fotografía ${i + 1}`);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `Fotografía ${i + 1} de la incidencia`;
    link.append(image);
    gallery.append(link);
  });
}

// Consulta de seguimiento por código
async function tracking() {
  const form = $("#lookup-form"),
    input = $("#tracking-code"),
    result = $("#tracking-result");
  let lookupId = 0;
  async function search(code) {
    const current = ++lookupId;
    code = code.trim().toUpperCase();
    input.value = code;
    if (!code) {
      input.focus();
      return;
    }
    result.innerHTML = /* HTML */ `
      <p class="empty-state" role="status">Consultando reporte…</p>
    `;
    try {
      await seed();
      const r = await getReport(code);
      if (current !== lookupId) return;
      releaseDetailImages();
      if (!r) {
        result.innerHTML = /* HTML */ `
          <div class="empty-state">
            <h2>No encontramos ese código</h2>
            <p>
              Revisa que esté completo. En esta demostración solo puedes consultar los
              ejemplos y los reportes guardados en este navegador.
            </p>
          </div>
        `;
        return;
      }
      result.innerHTML = renderDetails(r);
      showDetailImages(r);
      history.replaceState(
        null,
        "",
        `seguimiento.html?codigo=${encodeURIComponent(code)}`,
      );
    } catch {
      if (current === lookupId) failure(result);
    }
  }

  // Búsqueda al enviar el código
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    search(input.value);
  });
  $("#example-code").addEventListener("click", () => search("UESDEMO0001"));
  if (query.get("codigo")) await search(query.get("codigo"));
}

// Confirmación y resumen del reporte
async function confirmation() {
  const container = $("#confirmation");
  try {
    const r = await getReport((query.get("codigo") || "").toUpperCase());
    if (!r) {
      container.innerHTML = /* HTML */ `
        <div class="empty-state">
          <h1>No hay un reporte para mostrar</h1>
          <p>Si ya tienes un código, introdúcelo en Seguimiento.</p>
          <br />
          <a class="button" href="seguimiento.html">Consultar reporte</a>
        </div>
      `;
      return;
    }
    container.innerHTML = /* HTML */ `
      <section class="surface confirmation">
        <div class="success-mark">
          <svg
            class="icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path d="m5 12 4 4L19 6" />
          </svg>
        </div>
        <p class="eyebrow">REPORTE LOCAL DE DEMOSTRACIÓN</p>
        <h1>Tu reporte quedó guardado.</h1>
        <p>
          Conserva este código para consultar el seguimiento en este navegador. No se ha
          enviado a la universidad.
        </p>
        <div class="code-box">
          <span>CÓDIGO DE SEGUIMIENTO</span>
          <strong id="saved-code">${esc(r.code)}</strong>
          <button class="text-button" id="copy-code">Copiar código</button>
        </div>
        ${badge(r.state)}
        <dl class="detail-data">
          <div>
            <dt>Categoría</dt>
            <dd>${esc(r.category)}</dd>
          </div>
          <div>
            <dt>Ubicación</dt>
            <dd>${esc(locationName(r.location))}</dd>
          </div>
          <div>
            <dt>Fecha</dt>
            <dd>${esc(formatDate(r.created))}</dd>
          </div>
          <div>
            <dt>Fotografías</dt>
            <dd>${r.photos.length} adjunta(s)</dd>
          </div>
        </dl>
        <p class="report-description">${esc(r.description)}</p>
        <div class="form-actions">
          <a class="button" href="seguimiento.html?codigo=${encodeURIComponent(r.code)}">
            Consultar seguimiento ${arrow}
          </a>
          <button class="button button-outline" id="print-report">
            Imprimir resumen
          </button>
        </div>
        <a class="text-link" href="index.html">Volver al inicio</a>
        <p class="print-only">
          Resumen de demostración, sin validez de constancia institucional.
          <br />
          Firma: _______________________ &nbsp; Sello: _______________________
        </p>
      </section>
    `;

    // Copia del código de seguimiento
    $("#copy-code").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(r.code);
        toast("Código copiado.");
      } catch {
        const selection = getSelection();
        const range = document.createRange();
        range.selectNodeContents($("#saved-code"));
        selection.removeAllRanges();
        selection.addRange(range);
        toast("Código seleccionado. Usa Copiar en tu navegador.");
      }
    });

    // Impresión del resumen
    $("#print-report").addEventListener("click", () => window.print());
  } catch {
    failure(container);
  }
}

// Listado y mapa de incidencias
async function explore() {
  options($("#filter-category"), categories);
  options($("#filter-location"), locations);
  options($("#filter-status"), states);
  let all = [],
    selectedLocation = null;
  const filters = ["#filter-category", "#filter-location", "#filter-status"];

// Instancia y capa de OpenStreetMap
  let osmMap = null;
  let markerGroup = null;
  function initMap() {
    if (osmMap || !window.L || !$("#campus-map")) return;
    // Coordenadas del campus de la Facultad Multidisciplinaria Oriental, UES
    const campusCenter = [13.4404, -88.1583];
    osmMap = L.map("campus-map", {
      center: campusCenter,
      zoom: 17,
      minZoom: 15,
      maxZoom: 19,
      scrollWheelZoom: true,
    });
    // Conexión a las teselas de OpenStreetMap
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
    }).addTo(osmMap);
    markerGroup = L.layerGroup().addTo(osmMap);
  }

  // Aplicación de los filtros
  function current() {
    return all.filter(
      (r) =>
        (!$("#filter-category").value || r.category === $("#filter-category").value) &&
        (!$("#filter-location").value || r.location === $("#filter-location").value) &&
        (!$("#filter-status").value || r.state === $("#filter-status").value),
    );
  }

  // Detalle de la ubicación seleccionada
  function selectLocation(id, rows, shouldPan = false) {
    selectedLocation = id;
    document.querySelectorAll(".map-marker").forEach((b) => {
      const isMatch = b.dataset.location === id;
      b.setAttribute("aria-pressed", String(isMatch));
      b.classList.toggle("is-selected", isMatch);
    });
    $("#map-detail").innerHTML = /* HTML */ `
      <p class="eyebrow">UBICACIÓN SELECCIONADA</p>
      <h2>${esc(locationName(id))}</h2>
      <p>${found.length} incidencia(s) con estos filtros.</p>
      ${found
        .map(
          (r) => /* HTML */ `
            <a
              class="map-result"
              href="seguimiento.html?codigo=${encodeURIComponent(r.code)}"
            >
              ${badge(r.state)}
              <h3>${esc(r.category)}</h3>
              <small>${esc(r.code)} →</small>
            </a>
          `,
        )
        .join("")}
    `;

    if (shouldPan && osmMap) {
      const loc = locations.find((l) => l.id === id);
      if (loc?.lat && loc?.lng) {
        osmMap.panTo([loc.lat, loc.lng]);
      }
    }
  }

  // Actualización de los marcadores en OpenStreetMap
  function renderOsmMarkers(rows) {
    if (!osmMap || !markerGroup) return;
    markerGroup.clearLayers();
    for (const loc of locations) {
      const count = rows.filter((r) => r.location === loc.id).length;
      if (!count || !loc.lat || !loc.lng) continue;
      const isSelected = selectedLocation === loc.id;
      const customIcon = L.divIcon({
        className: "osm-marker-wrapper",
        html: /* HTML */ `
          <button
            type="button"
            class="map-marker ${isSelected ? "is-selected" : ""}"
            data-location="${loc.id}"
            aria-label="${esc(loc.name)}: ${count} incidencia(s)"
            aria-pressed="${String(isSelected)}"
          >
            <b>${count}</b>
            <span>${esc(loc.name)}</span>
          </button>
        `,
        iconSize: [110, 60],
        iconAnchor: [55, 18],
      });
      const marker = L.marker([loc.lat, loc.lng], {
        icon: customIcon,
        title: `${loc.name}: ${count} incidencia(s)`,
      });
      marker.on("click", (e) => {
        if (window.L) L.DomEvent.stopPropagation(e);
        selectLocation(loc.id, current(), true);
        renderOsmMarkers(current());
      });
      markerGroup.addLayer(marker);
    }
  }

  // Actualización de los resultados y marcadores
  function render() {
    const rows = current();
    $("#result-count").textContent =
      `${rows.length} incidencia${rows.length === 1 ? "" : "s"} · datos de demostración`;
    $("#incident-results").innerHTML = rows.length
      ? rows.map(row).join("")
      : /* HTML */ `
          <div class="empty-state">
            <h2>No hay coincidencias</h2>
            <p>Prueba otra combinación de filtros.</p>
          </div>
        `;

    const filterLocationValue = $("#filter-location").value;
    if (filterLocationValue && rows.some((r) => r.location === filterLocationValue)) {
      selectLocation(filterLocationValue, rows, true);
    } else if (selectedLocation && rows.some((r) => r.location === selectedLocation)) {
      selectLocation(selectedLocation, rows, false);
    } else {
      selectedLocation = null;
      $("#map-detail").innerHTML = /* HTML */ `
        <h2>${rows.length ? "Selecciona una ubicación" : "No hay coincidencias"}</h2>
        <p>
          ${rows.length
            ? "Toca un marcador en el mapa para consultar sus incidencias."
            : "Prueba otra combinación de filtros."}
        </p>
      `;
    }
    renderOsmMarkers(rows);
  }

  // Cambio entre listado y mapa
  function view(map) {
    $("#list-panel").hidden = map;
    $("#map-panel").hidden = !map;
    $("#list-view").setAttribute("aria-pressed", String(!map));
    $("#map-view").setAttribute("aria-pressed", String(map));
    history.replaceState(
      null,
      "",
      map ? "incidencias.html?vista=mapa" : "incidencias.html",
    );

    if (map) {
      if (!osmMap) {
        initMap();
        renderOsmMarkers(current());
      }
      setTimeout(() => {
        osmMap?.invalidateSize();
      }, 80);
    }
  }
  $("#list-view").addEventListener("click", () => view(false));
  $("#map-view").addEventListener("click", () => view(true));
  filters.forEach((s) => $(s).addEventListener("change", render));
  $("#clear-filters").addEventListener("click", () => {
    filters.forEach((s) => ($(s).value = ""));
    render();
  });
  view(query.get("vista") === "mapa");
  try {
    await seed();
    all = sortReports(await getReports());
    if ($("#campus-map") && window.L && !osmMap) {
      initMap();
    }
    render();
    if (query.get("vista") === "mapa" && osmMap) {
      setTimeout(() => osmMap.invalidateSize(), 100);
    }
  } catch {
    failure($("#incident-results"));
    failure($("#map-detail"));
    $("#result-count").textContent = "No se pudieron cargar los datos";
  }
}

// Formulario de nuevo reporte
function report() {
  const form = $("#incident-form");
  options($("#category"), categories);
  options($("#location"), locations);

  // Estado de las fotografías y del envío
  let photos = [],
    urls = [],
    busy = false;
  function clearURLs() {
    urls.forEach(URL.revokeObjectURL);
    urls = [];
  }

  // Vista previa y eliminación de fotografías
  function renderPhotos() {
    clearURLs();
    $("#photo-previews").replaceChildren();
    photos.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      urls.push(url);
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
        photos.splice(index, 1);
        renderPhotos();
        $("#photo-error").textContent = "";
        $("#photos").focus();
      });
      card.append(image, remove, name);
      $("#photo-previews").append(card);
    });
  }

  // Validación de formato y tamaño de fotografías
  async function addFiles(files) {
    const incoming = Array.from(files);
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
    if (photos.length + good.length > 3) {
      errors.push(
        "Puedes adjuntar hasta 3 fotografías. No se agregó esta selección; elige menos imágenes.",
      );
    } else photos.push(...good);
    $("#photo-error").textContent = errors.join(" ");
    $("#photos").value = "";
    renderPhotos();
  }

  // Procesamiento de las selecciones de archivos en orden
  let pendingFiles = Promise.resolve();
  function queueFiles(files) {
    pendingFiles = pendingFiles
      .then(() => addFiles(files))
      .catch(() => {
        $("#photo-error").textContent =
          "No se pudieron procesar las fotografías. Vuelve a seleccionarlas.";
      });
  }
  $("#photos").addEventListener("change", (event) => queueFiles(event.target.files));

  // Arrastre de archivos al formulario
  const dropzone = $("#dropzone");
  ["dragenter", "dragover"].forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((name) =>
    dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    }),
  );
  dropzone.addEventListener("drop", (event) => queueFiles(event.dataTransfer.files));

  // Errores de los campos del reporte
  function fieldError(id, message) {
    const input = $("#" + id);
    input.setAttribute("aria-invalid", String(!!message));
    input.setAttribute("aria-describedby", id + "-error");
    $("#" + id + "-error").textContent = message;
  }

  // Contador de caracteres
  $("#description").addEventListener("input", () => {
    $("#character-count").textContent = `${$("#description").value.trim().length} / 2000`;
  });
  ["category", "location", "description"].forEach((id) =>
    $("#" + id).addEventListener("input", () => fieldError(id, "")),
  );

  // Limpieza del formulario
  form.addEventListener("reset", () => {
    pendingFiles = pendingFiles.then(() => {
      photos = [];
      renderPhotos();
    });
    $("#photo-error").textContent = "";
    $("#character-count").textContent = "0 / 2000";
    $("#report-status").hidden = true;
    ["category", "location", "description"].forEach((id) => fieldError(id, ""));
  });

  // Validación y guardado del reporte
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    $("#send-report").disabled = true;
    $("#send-report").textContent = "Guardando…";
    $("#report-status").hidden = true;
    try {
      await pendingFiles;
      const errors = {
        category: !categories.includes($("#category").value)
          ? "Selecciona una categoría."
          : "",
        location: !locations.some((l) => l.id === $("#location").value)
          ? "Selecciona una ubicación."
          : "",
        description:
          $("#description").value.trim().length < 20
            ? "Describe el problema con al menos 20 caracteres."
            : "",
      };
      Object.entries(errors).forEach(([id, message]) => fieldError(id, message));
      const first = Object.entries(errors).find(([, message]) => message);
      if (first) {
        $("#" + first[0]).focus();
        return;
      }
      const date = new Date().toISOString();
      // Código aleatorio cuya clave no puede repetirse en la base local
      const bytes = crypto.getRandomValues(new Uint8Array(6));
      const code =
        "UES" +
        Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
          .join("")
          .toUpperCase();

      // Datos que se guardan en el navegador
      const record = {
        code,
        created: date,
        state: states[0],
        category: $("#category").value,
        location: $("#location").value,
        reference: $("#reference").value.trim(),
        description: $("#description").value.trim(),
        reporterName: $("#reporter-name").value.trim(),
        reporterLink: $("#reporter-link").value,
        photos: [...photos],
        history: [
          {
            date,
            state: states[0],
            note: "Reporte registrado. Pendiente de evaluación por la unidad responsable.",
          },
        ],
        sample: false,
      };
      await saveReport(record);
      location.assign(`confirmacion.html?codigo=${encodeURIComponent(code)}`);
    } catch {
      $("#report-status").hidden = false;
      $("#report-status").textContent =
        "No se pudo guardar el reporte en este navegador. Tus datos siguen en el formulario; revisa el espacio disponible o los permisos de almacenamiento e intenta otra vez.";
      $("#report-status").scrollIntoView({ block: "center" });
    } finally {
      busy = false;
      $("#send-report").disabled = false;
      $("#send-report").innerHTML = `Enviar reporte ${arrow}`;
    }
  });
  window.addEventListener("pagehide", clearURLs);
}

// Liberación de imágenes al salir de la página
window.addEventListener("pagehide", releaseDetailImages);

// Inicio de las funciones según la pantalla
if (page === "inicio") home();
else if (page === "reportar") report();
else if (page === "seguimiento") tracking();
else if (page === "confirmacion") confirmation();
else if (page === "incidencias") explore();
