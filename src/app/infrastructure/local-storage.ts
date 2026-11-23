// Persistencia local reemplazable por la API institucional
export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}
export function writeLocal(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
