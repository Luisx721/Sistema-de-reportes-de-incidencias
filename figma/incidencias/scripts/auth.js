const statusBox = document.querySelector("#formStatus");

function showStatus(message, type = "error") {
  if (!statusBox) return;

  statusBox.textContent = message;
  statusBox.hidden = false;
  statusBox.classList.toggle("is-success", type === "success");
}

function clearStatus() {
  if (!statusBox) return;

  statusBox.hidden = true;
  statusBox.textContent = "";
  statusBox.classList.remove("is-success");
}

function setFieldError(field, message) {
  const container = field.closest(".field");
  const error = document.querySelector(`#${field.id}Error`);

  container?.classList.toggle("has-error", Boolean(message));
  field.setAttribute("aria-invalid", String(Boolean(message)));
  if (error) error.textContent = message;
}

function validateEmail(field) {
  const value = field.value.trim();
  if (!value) return "Ingresa tu correo electrónico.";
  if (!field.validity.valid) return "Ingresa un correo electrónico válido.";
  return "";
}

function validatePassword(field) {
  if (!field.value) return "Ingresa tu contraseña.";
  if (field.value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return "";
}

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.querySelector(`#${button.dataset.passwordToggle}`);
    if (!input) return;

    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    button.textContent = isVisible ? "Mostrar" : "Ocultar";
    button.setAttribute("aria-label", `${isVisible ? "Mostrar" : "Ocultar"} contraseña`);
    input.focus();
  });
});

document.querySelectorAll("[data-demo-link]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showStatus(link.dataset.demoLink);
    statusBox?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
});

const loginForm = document.querySelector("#loginForm");

loginForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearStatus();

  const email = loginForm.elements.email;
  const password = loginForm.elements.password;
  const errors = [
    [email, validateEmail(email)],
    [password, validatePassword(password)],
  ];

  errors.forEach(([field, message]) => setFieldError(field, message));
  const firstInvalid = errors.find(([, message]) => message);

  if (firstInvalid) {
    showStatus("Revisa los campos señalados antes de continuar.");
    firstInvalid[0].focus();
    return;
  }

  showStatus(
    "Acceso de demostración validado. La autenticación real se habilitará al conectar el backend.",
    "success",
  );
});

const registerForm = document.querySelector("#registerForm");

registerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearStatus();

  const fullName = registerForm.elements.fullName;
  const email = registerForm.elements.email;
  const universityRole = registerForm.elements.universityRole;
  const password = registerForm.elements.password;
  const confirmPassword = registerForm.elements.confirmPassword;

  const errors = [
    [
      fullName,
      fullName.value.trim().length < 3
        ? "Ingresa tu nombre completo."
        : "",
    ],
    [email, validateEmail(email)],
    [
      universityRole,
      universityRole.value ? "" : "Selecciona tu vínculo con la universidad.",
    ],
    [password, validatePassword(password)],
    [
      confirmPassword,
      !confirmPassword.value
        ? "Confirma tu contraseña."
        : confirmPassword.value !== password.value
          ? "Las contraseñas no coinciden."
          : "",
    ],
  ];

  errors.forEach(([field, message]) => setFieldError(field, message));
  const firstInvalid = errors.find(([, message]) => message);

  if (firstInvalid) {
    showStatus("Revisa los campos señalados antes de crear tu cuenta.");
    firstInvalid[0].focus();
    return;
  }

  showStatus(
    "Registro de demostración completado. La cuenta se guardará y abrirá sesión cuando el backend esté disponible.",
    "success",
  );
  registerForm.reset();
});

document.querySelectorAll(".auth-form input, .auth-form select").forEach((field) => {
  field.addEventListener("input", () => {
    if (field.getAttribute("aria-invalid") === "true") {
      setFieldError(field, "");
    }
  });
});
