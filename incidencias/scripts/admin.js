// ==========================================================================
// MÓDULO DE ADMINISTRACIÓN (admin.js)
// Sistema de Reporte y Seguimiento de Incidencias del Campus (FMO-UES)
// ==========================================================================

// 1. DATOS DE EJEMPLO INICIALES
const initialAccounts = [
  {
    id: 1,
    name: "Carlos Menjívar",
    username: "carlos.menjivar",
    role: "Administrador",
    area: "Dirección de Infraestructura",
    active: true,
  },
  {
    id: 2,
    name: "Sonia Rivas",
    username: "sonia.rivas",
    role: "Jefatura",
    area: "Servicios Generales",
    active: true,
  },
  {
    id: 3,
    name: "Mauricio Fuentes",
    username: "mauricio.fuentes",
    role: "Mantenimiento",
    area: "Mantenimiento Eléctrico",
    active: true,
  },
  {
    id: 4,
    name: "Rosa Melgar",
    username: "rosa.melgar",
    role: "Ordenanza",
    area: "Limpieza y Aseo",
    active: true,
  },
  {
    id: 5,
    name: "Elena Castillo",
    username: "elena.castillo",
    role: "Desarrollo Físico",
    area: "Planificación y Obras",
    active: true,
  },
  {
    id: 6,
    name: "Walter Orellana",
    username: "walter.orellana",
    role: "Autoridad",
    area: "Decanato FMO-UES",
    active: true,
  },
  {
    id: 7,
    name: "Jorge Bonilla",
    username: "jorge.bonilla",
    role: "Mantenimiento",
    area: "Fontanería y Obras Menores",
    active: false,
  },
];

const initialCategories = [
  { id: 1, name: "Mobiliario", active: true },
  { id: 2, name: "Electricidad", active: true },
  { id: 3, name: "Agua y saneamiento", active: true },
  { id: 4, name: "Edificios", active: true },
  { id: 5, name: "Espacios comunes", active: true },
  { id: 6, name: "Cerrajería y accesos", active: false },
];

const initialLocations = [
  { id: 1, name: "Biblioteca", active: true },
  { id: 2, name: "Edificio de aulas", active: true },
  { id: 3, name: "Laboratorios", active: true },
  { id: 4, name: "Administración", active: true },
  { id: 5, name: "Áreas comunes", active: true },
  { id: 6, name: "Cancha polideportiva", active: false },
];

// Estado mutable en memoria
let accounts = JSON.parse(JSON.stringify(initialAccounts));
let categories = JSON.parse(JSON.stringify(initialCategories));
let locations = JSON.parse(JSON.stringify(initialLocations));

let currentCatalogSubtab = "categories"; // 'categories' | 'locations'
let accountPendingDeactivation = null;
let catalogItemPendingDeactivation = null;

// ==========================================================================
// 2. UTILIDADES Y NOTIFICACIONES
// ==========================================================================

let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 4000);
}

function escapeHTML(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}

function setFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(fieldId + "-error");
  if (input) {
    input.setAttribute("aria-invalid", String(Boolean(message)));
  }
  if (errorEl) {
    errorEl.textContent = message || "";
  }
}

function clearFieldErrors(container) {
  const inputs = container.querySelectorAll("[aria-invalid]");
  inputs.forEach((input) => input.setAttribute("aria-invalid", "false"));
  const errors = container.querySelectorAll(".field-error");
  errors.forEach((err) => (err.textContent = ""));
}

function openModal(dialog) {
  if (!dialog) return;
  clearFieldErrors(dialog);
  dialog.showModal();
}

function closeModal(dialog) {
  if (!dialog) return;
  dialog.close();
}

// Configurar cierre de modales al pulsar botones con data-close-modal o hacer clic en backdrop
document.querySelectorAll("dialog.modal").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog =
      rect.top <= event.clientY &&
      event.clientY <= rect.top + rect.height &&
      rect.left <= event.clientX &&
      event.clientX <= rect.left + rect.width;
    if (!isInDialog) {
      dialog.close();
    }
  });

  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      dialog.close();
    }
  });
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialogId = button.getAttribute("data-close-modal");
    const dialog = document.getElementById(dialogId);
    if (dialog) closeModal(dialog);
  });
});

// Menú móvil del encabezado
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.getElementById("main-nav");
if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
    menuToggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mainNav.classList.contains("open")) {
      mainNav.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.focus();
    }
  });
}

// Botón de cerrar sesión simulado
const logoutBtn = document.getElementById("logout");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    showToast("Cierre de sesión simulado. Permanece en el prototipo interactivo.");
  });
}

// ==========================================================================
// 3. CAMBIO DE PESTAÑAS PRINCIPALES
// ==========================================================================

const mainTabs = [
  { btnId: "tab-cuentas-btn", sectionId: "section-cuentas" },
  { btnId: "tab-catalogos-btn", sectionId: "section-catalogos" },
  { btnId: "tab-respaldo-btn", sectionId: "section-respaldo" },
];

mainTabs.forEach(({ btnId, sectionId }) => {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener("click", () => {
    mainTabs.forEach((tab) => {
      const b = document.getElementById(tab.btnId);
      const s = document.getElementById(tab.sectionId);
      const isSelected = tab.btnId === btnId;
      if (b) {
        b.setAttribute("aria-selected", String(isSelected));
        b.setAttribute("aria-pressed", String(isSelected));
      }
      if (s) {
        s.hidden = !isSelected;
      }
    });
  });
});

// ==========================================================================
// 4. SECCIÓN CUENTAS (RF-22)
// ==========================================================================

const accountSearchInput = document.getElementById("account-search");
const accountRoleSelect = document.getElementById("account-filter-role");
const accountStatusSelect = document.getElementById("account-filter-status");
const accountTableBody = document.getElementById("accounts-table-body");
const accountsCount = document.getElementById("accounts-count");
const accountsContainer = document.getElementById("accounts-table-container");
const accountsEmptyState = document.getElementById("accounts-empty-state");
const btnClearAccountFilters = document.getElementById("btn-clear-account-filters");
const btnNewAccount = document.getElementById("btn-new-account");
const modalAccount = document.getElementById("modal-account");
const formAccount = document.getElementById("form-account");
const modalAccountTitle = document.getElementById("modal-account-title");

function getFilteredAccounts() {
  const search = accountSearchInput.value.trim().toLowerCase();
  const role = accountRoleSelect.value;
  const status = accountStatusSelect.value;

  return accounts.filter((acc) => {
    const matchSearch =
      !search ||
      acc.name.toLowerCase().includes(search) ||
      acc.username.toLowerCase().includes(search);
    const matchRole = !role || acc.role === role;
    const matchStatus =
      !status ||
      (status === "activa" && acc.active) ||
      (status === "desactivada" && !acc.active);
    return matchSearch && matchRole && matchStatus;
  });
}

function renderAccounts() {
  const filtered = getFilteredAccounts();
  const total = accounts.length;

  if (accountsCount) {
    accountsCount.textContent = `Mostrando ${filtered.length} de ${total} cuentas registradas`;
  }

  if (filtered.length === 0) {
    accountsContainer.hidden = true;
    accountsEmptyState.hidden = false;
    accountTableBody.innerHTML = "";
    return;
  }

  accountsContainer.hidden = false;
  accountsEmptyState.hidden = true;

  accountTableBody.innerHTML = filtered
    .map((acc) => {
      const statusBadge = acc.active
        ? '<span class="badge resolved">Activa</span>'
        : '<span class="badge closed">Desactivada</span>';

      const toggleActionBtn = acc.active
        ? `<button type="button" class="button button-small button-quiet" data-action="deactivate-account" data-id="${acc.id}">Desactivar</button>`
        : `<button type="button" class="button button-small button-quiet" data-action="reactivate-account" data-id="${acc.id}">Reactivar</button>`;

      return `
        <tr>
          <td><strong>${escapeHTML(acc.name)}</strong></td>
          <td><code>${escapeHTML(acc.username)}</code></td>
          <td>${escapeHTML(acc.role)}</td>
          <td>${escapeHTML(acc.area)}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="button button-small button-outline" data-action="edit-account" data-id="${acc.id}">
                Editar
              </button>
              ${toggleActionBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Búsqueda y filtros
accountSearchInput?.addEventListener("input", renderAccounts);
accountRoleSelect?.addEventListener("change", renderAccounts);
accountStatusSelect?.addEventListener("change", renderAccounts);

btnClearAccountFilters?.addEventListener("click", () => {
  accountSearchInput.value = "";
  accountRoleSelect.value = "";
  accountStatusSelect.value = "";
  renderAccounts();
});

// Abrir modal para nueva cuenta
btnNewAccount?.addEventListener("click", () => {
  formAccount.reset();
  document.getElementById("account-id").value = "";
  modalAccountTitle.textContent = "Nueva cuenta";
  openModal(modalAccount);
  setTimeout(() => document.getElementById("account-name")?.focus(), 50);
});

// Guardar cuenta (Alta / Edición)
formAccount?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(formAccount);

  const idVal = document.getElementById("account-id").value;
  const nameVal = document.getElementById("account-name").value.trim();
  const usernameVal = document.getElementById("account-username").value.trim();
  const roleVal = document.getElementById("account-role").value;
  const areaVal = document.getElementById("account-area").value.trim();

  let hasError = false;

  if (!nameVal) {
    setFieldError("account-name", "Ingresa el nombre completo.");
    hasError = true;
  }
  if (!usernameVal) {
    setFieldError("account-username", "Ingresa el nombre de usuario.");
    hasError = true;
  } else {
    // Validar nombre de usuario duplicado
    const isDuplicate = accounts.some(
      (a) =>
        a.username.toLowerCase() === usernameVal.toLowerCase() &&
        String(a.id) !== idVal,
    );
    if (isDuplicate) {
      setFieldError("account-username", "Este usuario ya se encuentra registrado.");
      hasError = true;
    }
  }
  if (!roleVal) {
    setFieldError("account-role", "Selecciona el perfil de usuario.");
    hasError = true;
  }
  if (!areaVal) {
    setFieldError("account-area", "Ingresa el área de trabajo.");
    hasError = true;
  }

  if (hasError) return;

  if (idVal) {
    // Edición
    const target = accounts.find((a) => String(a.id) === idVal);
    if (target) {
      target.name = nameVal;
      target.username = usernameVal;
      target.role = roleVal;
      target.area = areaVal;
      showToast("Cuenta actualizada correctamente.");
    }
  } else {
    // Nueva cuenta
    const nextId = accounts.length ? Math.max(...accounts.map((a) => a.id)) + 1 : 1;
    accounts.push({
      id: nextId,
      name: nameVal,
      username: usernameVal,
      role: roleVal,
      area: areaVal,
      active: true,
    });
    showToast("Nueva cuenta creada exitosamente.");
  }

  closeModal(modalAccount);
  renderAccounts();
});

// Limpieza dinámica de errores al escribir en cuenta
["account-name", "account-username", "account-role", "account-area"].forEach((id) => {
  const el = document.getElementById(id);
  el?.addEventListener("input", () => setFieldError(id, ""));
  el?.addEventListener("change", () => setFieldError(id, ""));
});

// Acciones de tabla de cuentas (Editar, Desactivar, Reactivar)
accountTableBody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = Number(btn.getAttribute("data-id"));
  const account = accounts.find((a) => a.id === id);
  if (!account) return;

  if (action === "edit-account") {
    clearFieldErrors(formAccount);
    document.getElementById("account-id").value = account.id;
    document.getElementById("account-name").value = account.name;
    document.getElementById("account-username").value = account.username;
    document.getElementById("account-role").value = account.role;
    document.getElementById("account-area").value = account.area;
    modalAccountTitle.textContent = "Editar cuenta";
    openModal(modalAccount);
  } else if (action === "deactivate-account") {
    accountPendingDeactivation = account;
    const nameLabel = document.getElementById("deactivate-account-name-label");
    if (nameLabel) nameLabel.textContent = `${account.name} (${account.username})`;
    openModal(document.getElementById("modal-deactivate-account"));
  } else if (action === "reactivate-account") {
    account.active = true;
    renderAccounts();
    showToast(`Cuenta de "${account.name}" reactivada correctamente.`);
  }
});

// Confirmación de desactivación de cuenta
const btnConfirmDeactivateAccount = document.getElementById("btn-confirm-deactivate-account");
btnConfirmDeactivateAccount?.addEventListener("click", () => {
  if (accountPendingDeactivation) {
    accountPendingDeactivation.active = false;
    showToast(`Cuenta de "${accountPendingDeactivation.name}" desactivada. Su historial se mantiene intacto.`);
    accountPendingDeactivation = null;
    closeModal(document.getElementById("modal-deactivate-account"));
    renderAccounts();
  }
});

// ==========================================================================
// 5. SECCIÓN CATÁLOGOS (RF-23)
// ==========================================================================

const subtabCategoriesBtn = document.getElementById("subtab-categories-btn");
const subtabLocationsBtn = document.getElementById("subtab-locations-btn");
const btnNewCatalogItem = document.getElementById("btn-new-catalog-item");
const catalogAddLabel = document.getElementById("catalog-add-label");
const catalogCount = document.getElementById("catalog-count");
const catalogTableContainer = document.getElementById("catalog-table-container");
const catalogTableBody = document.getElementById("catalog-table-body");
const catalogEmptyState = document.getElementById("catalog-empty-state");
const modalCatalog = document.getElementById("modal-catalog");
const formCatalog = document.getElementById("form-catalog");
const modalCatalogTitle = document.getElementById("modal-catalog-title");
const catalogNameLabel = document.getElementById("catalog-name-label");

function getActiveCatalogList() {
  return currentCatalogSubtab === "categories" ? categories : locations;
}

function renderCatalog() {
  const isCategories = currentCatalogSubtab === "categories";
  const list = getActiveCatalogList();
  const typeLabel = isCategories ? "Categoría de daño" : "Ubicación";

  subtabCategoriesBtn?.setAttribute("aria-selected", String(isCategories));
  subtabCategoriesBtn?.setAttribute("aria-pressed", String(isCategories));
  subtabLocationsBtn?.setAttribute("aria-selected", String(!isCategories));
  subtabLocationsBtn?.setAttribute("aria-pressed", String(!isCategories));

  if (catalogAddLabel) {
    catalogAddLabel.textContent = isCategories
      ? "Agregar categoría"
      : "Agregar ubicación";
  }

  if (catalogCount) {
    catalogCount.textContent = `Total: ${list.length} registros en el catálogo de ${typeLabel.toLowerCase()}s`;
  }

  if (list.length === 0) {
    catalogTableContainer.hidden = true;
    catalogEmptyState.hidden = false;
    catalogTableBody.innerHTML = "";
    return;
  }

  catalogTableContainer.hidden = false;
  catalogEmptyState.hidden = true;

  catalogTableBody.innerHTML = list
    .map((item) => {
      const statusBadge = item.active
        ? '<span class="badge resolved">Activo</span>'
        : '<span class="badge closed">Desactivado</span>';

      const toggleActionBtn = item.active
        ? `<button type="button" class="button button-small button-quiet" data-action="deactivate-catalog" data-id="${item.id}">Desactivar</button>`
        : `<button type="button" class="button button-small button-quiet" data-action="reactivate-catalog" data-id="${item.id}">Reactivar</button>`;

      return `
        <tr>
          <td><strong>${escapeHTML(item.name)}</strong></td>
          <td>${typeLabel}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <button type="button" class="button button-small button-outline" data-action="edit-catalog" data-id="${item.id}">
                Editar
              </button>
              ${toggleActionBtn}
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

// Cambio de sub-pestaña
subtabCategoriesBtn?.addEventListener("click", () => {
  currentCatalogSubtab = "categories";
  renderCatalog();
});

subtabLocationsBtn?.addEventListener("click", () => {
  currentCatalogSubtab = "locations";
  renderCatalog();
});

// Abrir modal nuevo catálogo
btnNewCatalogItem?.addEventListener("click", () => {
  formCatalog.reset();
  clearFieldErrors(formCatalog);
  const isCategories = currentCatalogSubtab === "categories";
  document.getElementById("catalog-id").value = "";
  document.getElementById("catalog-type").value = currentCatalogSubtab;

  modalCatalogTitle.textContent = isCategories ? "Nueva categoría de daño" : "Nueva ubicación";
  catalogNameLabel.textContent = isCategories ? "Nombre de la categoría" : "Nombre de la ubicación";
  document.getElementById("catalog-name").placeholder = isCategories
    ? "Ej. Redes e informática"
    : "Ej. Cancha de básquetbol";

  openModal(modalCatalog);
  setTimeout(() => document.getElementById("catalog-name")?.focus(), 50);
});

// Guardar catálogo (Alta / Edición con validación de vacío y duplicados)
formCatalog?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFieldErrors(formCatalog);

  const idVal = document.getElementById("catalog-id").value;
  const nameVal = document.getElementById("catalog-name").value.trim();
  const list = getActiveCatalogList();
  const typeText = currentCatalogSubtab === "categories" ? "categoría" : "ubicación";

  if (!nameVal) {
    setFieldError("catalog-name", "El nombre no puede estar vacío.");
    return;
  }

  // Validación de nombre duplicado (insensible a mayúsculas/minúsculas)
  const isDuplicate = list.some(
    (item) =>
      item.name.toLowerCase() === nameVal.toLowerCase() &&
      String(item.id) !== idVal,
  );

  if (isDuplicate) {
    setFieldError("catalog-name", `Ya existe una ${typeText} con este nombre.`);
    return;
  }

  if (idVal) {
    // Editar
    const item = list.find((i) => String(i.id) === idVal);
    if (item) {
      item.name = nameVal;
      showToast(`Registro actualizado correctamente.`);
    }
  } else {
    // Agregar
    const nextId = list.length ? Math.max(...list.map((i) => i.id)) + 1 : 1;
    list.push({
      id: nextId,
      name: nameVal,
      active: true,
    });
    showToast(`Nueva ${typeText} agregada correctamente.`);
  }

  closeModal(modalCatalog);
  renderCatalog();
});

document.getElementById("catalog-name")?.addEventListener("input", () => {
  setFieldError("catalog-name", "");
});

// Acciones de tabla catálogo (Editar, Desactivar, Reactivar)
catalogTableBody?.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.getAttribute("data-action");
  const id = Number(btn.getAttribute("data-id"));
  const list = getActiveCatalogList();
  const item = list.find((i) => i.id === id);
  if (!item) return;

  const isCategories = currentCatalogSubtab === "categories";

  if (action === "edit-catalog") {
    clearFieldErrors(formCatalog);
    document.getElementById("catalog-id").value = item.id;
    document.getElementById("catalog-type").value = currentCatalogSubtab;
    document.getElementById("catalog-name").value = item.name;

    modalCatalogTitle.textContent = isCategories ? "Editar categoría" : "Editar ubicación";
    catalogNameLabel.textContent = isCategories ? "Nombre de la categoría" : "Nombre de la ubicación";
    openModal(modalCatalog);
  } else if (action === "deactivate-catalog") {
    catalogItemPendingDeactivation = { item, type: currentCatalogSubtab };
    const label = document.getElementById("deactivate-catalog-name-label");
    if (label) label.textContent = `"${item.name}"`;
    openModal(document.getElementById("modal-deactivate-catalog"));
  } else if (action === "reactivate-catalog") {
    item.active = true;
    renderCatalog();
    showToast(`Elemento "${item.name}" reactivado correctamente.`);
  }
});

// Confirmación de desactivación de catálogo
const btnConfirmDeactivateCatalog = document.getElementById("btn-confirm-deactivate-catalog");
btnConfirmDeactivateCatalog?.addEventListener("click", () => {
  if (catalogItemPendingDeactivation) {
    catalogItemPendingDeactivation.item.active = false;
    showToast(`Elemento "${catalogItemPendingDeactivation.item.name}" desactivado. El historial previo se mantiene intacto.`);
    catalogItemPendingDeactivation = null;
    closeModal(document.getElementById("modal-deactivate-catalog"));
    renderCatalog();
  }
});

// ==========================================================================
// 6. SECCIÓN RESPALDO Y RESTAURACIÓN (RNF-10)
// ==========================================================================

const btnGenerateBackup = document.getElementById("btn-generate-backup");
const btnOpenRestore = document.getElementById("btn-open-restore");
const modalRestore = document.getElementById("modal-restore");
const btnConfirmRestore = document.getElementById("btn-confirm-restore");

// Generar y descargar respaldo
btnGenerateBackup?.addEventListener("click", () => {
  const backupPayload = {
    sistema: "Sistema de Reportes e Incidencias FMO-UES",
    modulo: "Administración",
    fechaRespaldo: new Date().toISOString(),
    version: "1.0-demo",
    datos: {
      cuentas: accounts,
      catalogos: {
        categorias: categories,
        ubicaciones: locations,
      },
    },
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateFormatted = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo_ues_incidencias_${dateFormatted}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Respaldo generado y descargado exitosamente.");
});

// Abrir confirmación de restauración
btnOpenRestore?.addEventListener("click", () => {
  openModal(modalRestore);
});

// Confirmar restauración
btnConfirmRestore?.addEventListener("click", () => {
  // Restablecer copias de datos iniciales
  accounts = JSON.parse(JSON.stringify(initialAccounts));
  categories = JSON.parse(JSON.stringify(initialCategories));
  locations = JSON.parse(JSON.stringify(initialLocations));

  // Actualizar vistas
  renderAccounts();
  renderCatalog();

  closeModal(modalRestore);
  showToast("Datos restaurados satisfactoriamente a los valores de ejemplo.");
});

// ==========================================================================
// 7. INICIALIZACIÓN
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  renderAccounts();
  renderCatalog();
});

// Si el DOM ya estuviese listo al cargar el script
if (document.readyState === "interactive" || document.readyState === "complete") {
  renderAccounts();
  renderCatalog();
}
