document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // Manejo del Menú Superior
  // ==========================================================================
  const etiqueta = document.getElementById('seccionActual');
  const enlaces = document.querySelectorAll('.menu-lista a');

  function marcar(enlace) {
    if (!enlace) return;
    enlaces.forEach(a => a.removeAttribute('aria-current'));
    enlace.setAttribute('aria-current', 'page');
    if (etiqueta) {
      etiqueta.textContent = enlace.textContent.trim();
    }
  }

  enlaces.forEach(a => {
    a.addEventListener('click', () => {
      marcar(a);
      if (document.activeElement) {
        document.activeElement.blur();
      }
    });
  });

  const enlaceInicial = document.querySelector('.menu-lista a[aria-current="page"]') || enlaces[0];
  if (enlaceInicial) {
    marcar(enlaceInicial);
  }

  // ==========================================================================
  // Elementos del Formulario
  // ==========================================================================
  const form = document.getElementById('formIncidencia');
  const alerta = document.getElementById('alertaFormulario');
  const contadorTexto = document.getElementById('contadorTexto');
  const descripcionInput = document.getElementById('descripcion');
  const inputEvidencias = document.getElementById('evidencias');
  const galeriaPrevia = document.getElementById('galeriaPrevia');
  const zonaSubida = document.getElementById('zonaSubida');

  // SVG de icono de error
  const svgError = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  `;

  // SVG de icono de éxito
  const svgExito = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  `;

  // ==========================================================================
  // Contador en Tiempo Real para la Descripción
  // ==========================================================================
  if (descripcionInput && contadorTexto) {
    descripcionInput.addEventListener('input', () => {
      const cantidad = descripcionInput.value.trim().length;
      contadorTexto.textContent = `${cantidad} caracter${cantidad === 1 ? '' : 'es'}`;
      if (cantidad < 20) {
        contadorTexto.style.color = 'var(--texto-mutado)';
      } else {
        contadorTexto.style.color = 'var(--exito)';
      }
    });
  }

  // ==========================================================================
  // Subida de Archivos y Vista Previa
  // ==========================================================================
  if (zonaSubida) {
    ['dragenter', 'dragover'].forEach(evt => {
      zonaSubida.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zonaSubida.classList.add('arrastre-activo');
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      zonaSubida.addEventListener(evt, (e) => {
        e.preventDefault();
        e.stopPropagation();
        zonaSubida.classList.remove('arrastre-activo');
      });
    });
  }

  if (inputEvidencias && galeriaPrevia) {
    inputEvidencias.addEventListener('change', () => {
      galeriaPrevia.innerHTML = '';
      const archivos = Array.from(inputEvidencias.files).slice(0, 3);

      archivos.forEach((archivo, idx) => {
        if (!archivo.type.startsWith('image/')) return;

        const lector = new FileReader();
        lector.onload = (e) => {
          const item = document.createElement('div');
          item.className = 'item-previa';
          item.innerHTML = `
            <img src="${e.target.result}" alt="Evidencia ${idx + 1}">
            <button type="button" class="btn-eliminar-foto" title="Eliminar foto" aria-label="Eliminar foto">&times;</button>
          `;

          item.querySelector('.btn-eliminar-foto').addEventListener('click', (ev) => {
            ev.stopPropagation();
            item.remove();
          });

          galeriaPrevia.appendChild(item);
        };
        lector.readAsDataURL(archivo);
      });
    });
  }

  // ==========================================================================
  // Sistema de Validación de Campos Requeridos
  // ==========================================================================
  function limpiarErrorCampo(campoElemento) {
    if (!campoElemento) return;
    campoElemento.classList.remove('con-error');
    const msgPrevio = campoElemento.querySelector('.mensaje-error');
    if (msgPrevio) {
      msgPrevio.remove();
    }
  }

  function mostrarErrorCampo(campoElemento, mensaje) {
    if (!campoElemento) return;
    limpiarErrorCampo(campoElemento);
    campoElemento.classList.add('con-error');

    const errorSpan = document.createElement('span');
    errorSpan.className = 'mensaje-error';
    errorSpan.setAttribute('role', 'alert');
    errorSpan.innerHTML = `${svgError} ${mensaje}`;
    campoElemento.appendChild(errorSpan);
  }

  function validarEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function validarCampo(input) {
    const contenedor = input.closest('.campo');
    const valor = input.value ? input.value.trim() : '';

    // Si no es un campo con contenedor, salimos
    if (!contenedor) return true;

    // Validación por ID de campo
    if (input.id === 'tipoReportante') {
      if (!valor) {
        mostrarErrorCampo(contenedor, 'Selecciona tu rol universitario.');
        return false;
      }
    } else if (input.id === 'nombreReportante') {
      if (valor.length === 0) {
        mostrarErrorCampo(contenedor, 'El nombre completo es requerido.');
        return false;
      }
      if (valor.length < 3) {
        mostrarErrorCampo(contenedor, 'El nombre debe tener al menos 3 caracteres.');
        return false;
      }
    } else if (input.id === 'correoReportante') {
      if (valor.length === 0) {
        mostrarErrorCampo(contenedor, 'El correo institucional es requerido.');
        return false;
      }
      if (!validarEmail(valor)) {
        mostrarErrorCampo(contenedor, 'Ingresa un correo electrónico válido (ej. usuario@ues.edu.sv).');
        return false;
      }
    } else if (input.id === 'categoria') {
      if (!valor) {
        mostrarErrorCampo(contenedor, 'Selecciona una categoría para clasificar el daño.');
        return false;
      }
    } else if (input.id === 'ubicacion') {
      if (!valor) {
        mostrarErrorCampo(contenedor, 'Selecciona el edificio o área general.');
        return false;
      }
    } else if (input.id === 'detalleUbicacion') {
      if (valor.length === 0) {
        mostrarErrorCampo(contenedor, 'Especifica el detalle exacto de la ubicación.');
        return false;
      }
      if (valor.length < 3) {
        mostrarErrorCampo(contenedor, 'El detalle de ubicación debe ser más descriptivo.');
        return false;
      }
    } else if (input.id === 'descripcion') {
      if (valor.length === 0) {
        mostrarErrorCampo(contenedor, 'La descripción de la falla es requerida.');
        return false;
      }
      if (valor.length < 20) {
        mostrarErrorCampo(contenedor, `La descripción debe contener al menos 20 caracteres (actual: ${valor.length}).`);
        return false;
      }
    }

    limpiarErrorCampo(contenedor);
    return true;
  }

  // Escuchar cambios en vivo para retirar mensajes de error tan pronto se corrijan
  const camposRequeridos = form ? form.querySelectorAll('input[required], select[required], textarea[required]') : [];
  camposRequeridos.forEach(input => {
    input.addEventListener('input', () => {
      const contenedor = input.closest('.campo');
      if (contenedor && contenedor.classList.contains('con-error')) {
        validarCampo(input);
      }
    });

    input.addEventListener('change', () => {
      const contenedor = input.closest('.campo');
      if (contenedor && contenedor.classList.contains('con-error')) {
        validarCampo(input);
      }
    });

    input.addEventListener('blur', () => {
      validarCampo(input);
    });
  });

  // ==========================================================================
  // Control de Envío (Submit) con Restricciones
  // ==========================================================================
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault(); // Detiene el envío si hay errores o por defecto en esta fase de diseño

      let hayErrores = false;
      let primerElementoInvalido = null;

      // Validar todos los campos requeridos
      camposRequeridos.forEach(input => {
        const esValido = validarCampo(input);
        if (!esValido) {
          hayErrores = true;
          if (!primerElementoInvalido) {
            primerElementoInvalido = input;
          }
        }
      });

      if (hayErrores) {
        // Mostrar alerta superior de campos faltantes
        if (alerta) {
          alerta.className = 'alerta-formulario alerta-error';
          alerta.style.display = 'flex';
          alerta.innerHTML = `
            ${svgError}
            <div>
              <strong>Formulario incompleto:</strong>
              Por favor completa todos los campos obligatorios marcados en rojo antes de enviar tu reporte.
            </div>
          `;
        }

        // Enfocar y desplazar la vista al primer campo con error
        if (primerElementoInvalido) {
          primerElementoInvalido.focus();
          primerElementoInvalido.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Si todos los campos requeridos son válidos:
      const codigoSeguimiento = `INC-2026-${Math.floor(10000 + Math.random() * 90000)}`;

      if (alerta) {
        alerta.className = 'alerta-formulario alerta-exito';
        alerta.style.display = 'flex';
        alerta.innerHTML = `
          ${svgExito}
          <div>
            <strong>¡Incidencia registrada con éxito!</strong><br>
            Se ha generado tu código de seguimiento: <span class="codigo-destacado">${codigoSeguimiento}</span>.<br>
            Conserva este código para dar seguimiento al estado de atención por parte de Servicios Generales.
          </div>
        `;
        alerta.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Reiniciar formulario manteniendo limpio el estado
      form.reset();
      if (galeriaPrevia) galeriaPrevia.innerHTML = '';
      if (contadorTexto) {
        contadorTexto.textContent = '0 caracteres';
        contadorTexto.style.color = 'var(--texto-mutado)';
      }
    });

    // Limpieza al pulsar "Limpiar Formulario"
    form.addEventListener('reset', () => {
      camposRequeridos.forEach(input => {
        const contenedor = input.closest('.campo');
        limpiarErrorCampo(contenedor);
      });
      if (alerta) alerta.style.display = 'none';
      if (galeriaPrevia) galeriaPrevia.innerHTML = '';
      if (contadorTexto) {
        contadorTexto.textContent = '0 caracteres';
        contadorTexto.style.color = 'var(--texto-mutado)';
      }
    });
  }
});
