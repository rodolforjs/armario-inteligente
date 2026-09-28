const API = "";

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
    if (btn.dataset.tab === "inventario") cargarInventario();
  });
});

// ---------- Zonas (para el select) ----------
async function cargarZonasEnSelect() {
  const res = await fetch(`${API}/zonas`);
  const zonas = await res.json();
  const select = document.getElementById("select-zona");
  select.innerHTML = '<option value="">— sin asignar —</option>';
  zonas.forEach((z) => {
    const opt = document.createElement("option");
    opt.value = z.id;
    opt.textContent = z.nombre;
    select.appendChild(opt);
  });
}
cargarZonasEnSelect();

// ---------- Subir prenda ----------
let tokenPendiente = null;

document.getElementById("btn-analizar").addEventListener("click", async () => {
  const input = document.getElementById("input-foto");
  const estado = document.getElementById("subir-estado");
  if (!input.files.length) {
    estado.textContent = "Primero selecciona o toma una foto.";
    return;
  }
  estado.textContent = "Analizando con IA...";

  const formData = new FormData();
  formData.append("archivo", input.files[0]);

  try {
    const res = await fetch(`${API}/prendas/foto`, { method: "POST", body: formData });
    if (!res.ok) throw new Error((await res.json()).detail || "Error al analizar");
    const data = await res.json();
    tokenPendiente = data.token;

    document.getElementById("preview-img").src = data.foto_url;
    const form = document.getElementById("form-confirmar");
    form.tipo.value = data.atributos.tipo;
    form.color.value = data.atributos.color;
    form.formalidad.value = data.atributos.formalidad;
    form.abrigo.value = data.atributos.abrigo;

    document.getElementById("preview-atributos").classList.remove("hidden");
    estado.textContent = data.ia_disponible
      ? "Revisa y corrige los atributos si hace falta."
      : "La IA no está disponible ahora mismo — completa los atributos a mano.";
  } catch (err) {
    estado.textContent = `Error: ${err.message}`;
  }
});

document.getElementById("form-confirmar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const estado = document.getElementById("subir-estado");
  const form = e.target;
  const formData = new FormData();
  formData.append("token", tokenPendiente);
  formData.append("tipo", form.tipo.value);
  formData.append("color", form.color.value);
  formData.append("formalidad", form.formalidad.value);
  formData.append("abrigo", form.abrigo.value);
  if (form.zona_actual.value) formData.append("zona_actual", form.zona_actual.value);
  if (form.tag_uid.value) formData.append("tag_uid", form.tag_uid.value);

  try {
    const res = await fetch(`${API}/prendas`, { method: "POST", body: formData });
    if (!res.ok) throw new Error((await res.json()).detail || "Error al guardar");
    estado.textContent = "Prenda guardada en el inventario.";
    document.getElementById("preview-atributos").classList.add("hidden");
    form.reset();
    document.getElementById("input-foto").value = "";
    tokenPendiente = null;
  } catch (err) {
    estado.textContent = `Error: ${err.message}`;
  }
});

// ---------- Inventario ----------
async function cargarInventario() {
  const grid = document.getElementById("grid-inventario");
  grid.innerHTML = "Cargando...";
  const res = await fetch(`${API}/prendas`);
  const prendas = await res.json();
  if (!prendas.length) {
    grid.innerHTML = "<p>Todavía no hay prendas registradas.</p>";
    return;
  }
  grid.innerHTML = "";
  prendas.forEach((p) => {
    const card = document.createElement("div");
    card.className = "prenda-card";
    card.innerHTML = `
      <img src="/${p.foto_path}" alt="${p.tipo}" />
      <div class="info">
        <strong>${p.tipo}</strong><br/>
        ${p.color} · ${p.formalidad}<br/>
        <span class="estado-badge ${p.estado}">${p.estado}</span>
      </div>`;
    grid.appendChild(card);
  });
}
document.getElementById("btn-refrescar-inventario").addEventListener("click", cargarInventario);

// ---------- Voz (Web Speech API) ----------
const btnVoz = document.getElementById("btn-voz");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognizer = new SpeechRecognition();
  recognizer.lang = "es-CL";
  recognizer.interimResults = false;

  recognizer.addEventListener("result", (e) => {
    const texto = e.results[0][0].transcript;
    const textarea = document.getElementById("texto-libre");
    textarea.value = textarea.value ? `${textarea.value} ${texto}` : texto;
  });
  recognizer.addEventListener("end", () => btnVoz.classList.remove("recording"));

  btnVoz.addEventListener("click", () => {
    btnVoz.classList.add("recording");
    recognizer.start();
  });
} else {
  btnVoz.disabled = true;
  btnVoz.title = "Tu navegador no soporta dictado por voz";
}

// ---------- Recomendación ----------
let sesionActual = null;

function renderClima(clima) {
  document.getElementById("clima-info").innerHTML = clima
    ? `<p>Santiago ahora: ${clima.temperatura_c}°C, ${clima.categoria}${clima.precipitacion_mm > 0 ? " (con lluvia)" : ""}</p>`
    : "";
}

function renderConjuntos(conjuntos) {
  const cont = document.getElementById("conjuntos");
  cont.innerHTML = "";
  conjuntos.forEach((c, idx) => {
    const div = document.createElement("div");
    div.className = "conjunto-card";
    const piezasHtml = c.piezas
      .map((p) => `<img src="/${p.foto_path}" alt="${p.tipo}" title="${p.tipo} (id ${p.id})" />`)
      .join("");
    div.innerHTML = `
      <strong>Conjunto ${idx + 1}</strong>
      <div class="piezas">${piezasHtml}</div>
      <p class="razon">${c.razon}</p>
      <div class="acciones-conjunto">
        <button data-accion="aceptar" data-idx="${idx}">Confirmar este conjunto</button>
        ${c.piezas
          .map(
            (p) =>
              `<button class="btn-secundario" data-accion="rechazar-prenda" data-idx="${idx}" data-prenda="${p.id}">Cambiar ${p.tipo}</button>`
          )
          .join("")}
      </div>`;
    cont.appendChild(div);
  });
  document.getElementById("btn-otras-opciones").classList.remove("hidden");
}

document.getElementById("form-recomendar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const estado = document.getElementById("recomendar-estado");
  estado.textContent = "Pensando en tu conjunto...";
  document.getElementById("conjuntos").innerHTML = "";
  document.getElementById("btn-otras-opciones").classList.add("hidden");

  const body = {
    modo: form.modo.value,
    ocasion: form.ocasion.value || null,
    texto_libre: form.texto_libre.value || null,
  };

  try {
    const res = await fetch(`${API}/recomendaciones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Error al recomendar");
    const data = await res.json();
    sesionActual = data.sesion_id;
    renderClima(data.clima);
    renderConjuntos(data.conjuntos);
    estado.textContent = "";
  } catch (err) {
    estado.textContent = `Error: ${err.message}`;
  }
});

document.getElementById("conjuntos").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-accion]");
  if (!btn || !sesionActual) return;
  const estado = document.getElementById("recomendar-estado");

  if (btn.dataset.accion === "aceptar") {
    const idx = Number(btn.dataset.idx);
    const res = await fetch(`${API}/recomendaciones/${sesionActual}`, {});
    const sesion = await res.json();
    const prendaIds = sesion.conjuntos[idx].prenda_ids;
    await fetch(`${API}/recomendaciones/${sesionActual}/aceptar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prenda_ids: prendaIds }),
    });
    estado.textContent = "¡Conjunto confirmado! Que lo disfrutes.";
    document.getElementById("conjuntos").innerHTML = "";
    document.getElementById("btn-otras-opciones").classList.add("hidden");
    sesionActual = null;
  }

  if (btn.dataset.accion === "rechazar-prenda") {
    const idx = Number(btn.dataset.idx);
    const prendaId = Number(btn.dataset.prenda);
    const res = await fetch(`${API}/recomendaciones/${sesionActual}/rechazar-prenda`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conjunto_idx: idx, prenda_id: prendaId }),
    });
    if (!res.ok) {
      estado.textContent = `Error: ${(await res.json()).detail}`;
      return;
    }
    const data = await res.json();
    renderConjuntos(data.conjuntos);
  }
});

document.getElementById("btn-otras-opciones").addEventListener("click", async () => {
  if (!sesionActual) return;
  const estado = document.getElementById("recomendar-estado");
  estado.textContent = "Buscando otras opciones...";
  const res = await fetch(`${API}/recomendaciones/${sesionActual}/rechazar-conjunto`, { method: "POST" });
  const data = await res.json();

  if (data.estado === "modo_libre") {
    estado.textContent = "Ya van 2 rechazos. Pasamos a modo libre: revisa el inventario y elige tú mismo.";
    document.getElementById("conjuntos").innerHTML = "";
    document.getElementById("btn-otras-opciones").classList.add("hidden");
    return;
  }

  renderClima(data.clima);
  renderConjuntos(data.conjuntos);
  estado.textContent = "";
});
