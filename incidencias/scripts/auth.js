// Sesión de demostración
import { startSession } from "./data.js";

// Elementos del formulario
const form = document.querySelector("#auth-form");
const registration = document.body.dataset.page === "registro";
const status = document.querySelector("#auth-status");

// Mensajes de error junto a cada campo
function error(id, message) {
  const input = form.elements[id];
  input.setAttribute("aria-invalid", String(!!message));
  document.getElementById(id + "-error").textContent = message;
}

// Mostrar y ocultar contraseñas
document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  const input = document.getElementById(button.dataset.passwordToggle);
  input.dataset.password = "true";
  button.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    button.textContent = show ? "Ocultar" : "Mostrar";
    button.setAttribute(
      "aria-label",
      `${show ? "Ocultar" : "Mostrar"} ${input.id === "confirmPassword" ? "confirmación de contraseña" : "contraseña"}`,
    );
  });
});

// Validación del inicio y registro
form.addEventListener("submit", (event) => {
  event.preventDefault();
  status.hidden = true;
  const value = (id) => form.elements[id].value;
  const errors = {
    email: !value("email").trim()
      ? "Ingresa tu correo electrónico."
      : !form.elements.email.validity.valid
        ? "Ingresa un correo electrónico válido."
        : "",
    password: !value("password") ? "Ingresa tu contraseña." : "",
  };

  // Validaciones adicionales del registro
  if (registration) {
    errors.fullName = value("fullName").trim().length < 2 ? "Ingresa tu nombre." : "";
    errors.universityRole = !value("universityRole")
      ? "Selecciona tu vínculo con la universidad."
      : "";
    errors.password =
      value("password").length < 8
        ? "Usa al menos 8 caracteres para esta demostración."
        : "";
    errors.confirmPassword =
      value("confirmPassword") !== value("password") || !value("confirmPassword")
        ? "Las contraseñas deben coincidir."
        : "";
  }
  Object.entries(errors).forEach(([id, msg]) => error(id, msg));
  const first = Object.entries(errors).find(([, msg]) => msg);
  if (first) {
    form.elements[first[0]].focus();
    return;
  }
  try {
    // La sesión es de demostración y no almacena contraseñas
    startSession({ name: registration ? value("fullName").trim() : "Reportante" });
    form.reset();
    window.location.assign("index.html");
  } catch {
    status.hidden = false;
    status.textContent =
      "No se pudo abrir la sesión de demostración. Puedes continuar como invitado.";
  }
});

// Limpieza del mensaje al editar un campo
form.addEventListener("input", (event) => {
  if (event.target.id && document.getElementById(event.target.id + "-error"))
    error(event.target.id, "");
});
