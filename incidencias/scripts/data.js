// Categorías de demostración para reemplazar al conectar el servidor
export const categories = [
  "Mobiliario",
  "Electricidad",
  "Agua y saneamiento",
  "Edificios",
  "Espacios comunes",
];

// Ubicaciones ilustrativas del campus
export const locations = [
  { id: "biblioteca", name: "Biblioteca", x: 24, y: 27 },
  { id: "aulas", name: "Edificio de aulas", x: 68, y: 24 },
  { id: "laboratorios", name: "Laboratorios", x: 26, y: 52 },
  { id: "administracion", name: "Administración", x: 73, y: 62 },
  { id: "zonas-comunes", name: "Áreas comunes", x: 43, y: 79 },
];

// Estados de atención
export const states = [
  "Recibido",
  "En proceso",
  "En espera de materiales/autorización",
  "Resuelto",
  "Rechazado/Cerrado",
];

// Reportes de ejemplo
const samples = [
  [
    "UESDEMO0001",
    "Electricidad",
    "biblioteca",
    "La lámpara del pasillo de la biblioteca no enciende. El área queda oscura al final de la tarde.",
    1,
  ],
  [
    "UESDEMO0002",
    "Mobiliario",
    "aulas",
    "Dos pupitres del salón de clases tienen el respaldo suelto y necesitan revisión.",
    0,
  ],
  [
    "UESDEMO0003",
    "Agua y saneamiento",
    "laboratorios",
    "El grifo del lavamanos presenta una fuga continua de agua después de cerrarlo.",
    2,
  ],
  [
    "UESDEMO0004",
    "Espacios comunes",
    "zonas-comunes",
    "La tapa de una canaleta estaba desplazada en el paso peatonal del área común.",
    3,
  ],
  [
    "UESDEMO0005",
    "Edificios",
    "administracion",
    "Se solicita una revisión de la pintura de la pared en el acceso al edificio.",
    4,
  ],
];

// Conexión con la base de datos local
let dbPromise;
function openDatabase() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("ues-incidencias-demo", 1);
      req.onupgradeneeded = () =>
        req.result.createObjectStore("reports", { keyPath: "code" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  return dbPromise;
}

// Operaciones de lectura y escritura
async function transaction(mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("reports", mode);
    const req = action(tx.objectStore("reports"));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(tx.error || new Error("No se pudo guardar el reporte."));
  });
}

// Consulta y guardado de reportes
export const getReport = (code) => transaction("readonly", (s) => s.get(code));
export const getReports = () => transaction("readonly", (s) => s.getAll());
export const saveReport = (report) => transaction("readwrite", (s) => s.add(report));

// Carga inicial de los ejemplos
export async function seed() {
  // Los ejemplos se agregan sin reemplazar reportes existentes
  for (let i = 0; i < samples.length; i++) {
    const [code, category, location, description, state] = samples[i];
    if (await getReport(code)) continue;
    const created = new Date(Date.UTC(2026, 10, 3 + i, 14)).toISOString();
    const history = [
      {
        date: created,
        state: states[0],
        note: "Reporte de ejemplo recibido para su evaluación.",
      },
    ];
    if (state !== 0)
      history.push({
        date: new Date(Date.UTC(2026, 10, 8, 14)).toISOString(),
        state: states[state],
        note:
          state === 1
            ? "La unidad responsable inspeccionó el lugar e inició la atención."
            : state === 2
              ? "Se solicitó el repuesto necesario. La atención está en espera de materiales."
              : state === 3
                ? "Se colocó y aseguró la tapa. El paso peatonal quedó habilitado."
                : "Tras la inspección no se identificó un daño de infraestructura que requiera intervención.",
      });
    try {
      await saveReport({
        code,
        category,
        location,
        description,
        state: states[state],
        created,
        history,
        photos: [],
        reference: "",
        sample: true,
      });
    } catch (error) {
      if (error.name !== "ConstraintError") throw error;
    }
  }
}

// Nombre de una ubicación
export function locationName(id) {
  return locations.find((l) => l.id === id)?.name || id;
}

// Lectura de la sesión de demostración
export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem("ues-demo-session"));
  } catch {
    return null;
  }
}

// Inicio de una sesión sin guardar contraseñas
export function startSession(user) {
  sessionStorage.setItem(
    "ues-demo-session",
    JSON.stringify({ name: user.name, profile: "reportante", demo: true }),
  );
}

// Cierre de la sesión
export function endSession() {
  sessionStorage.removeItem("ues-demo-session");
}

// Formato de fecha y hora de El Salvador
export function formatDate(date) {
  return new Intl.DateTimeFormat("es-SV", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/El_Salvador",
  }).format(new Date(date));
}

// Protección del texto antes de mostrarlo en la página
export function escapeHTML(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// Etiqueta visual del estado
export function badge(state) {
  const style =
    ["received", "process", "wait", "resolved", "closed"][states.indexOf(state)] ||
    "received";
  return /* HTML */ `
    <span class="badge ${style}">${escapeHTML(state)}</span>
  `;
}
