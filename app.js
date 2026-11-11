(function () {
  "use strict";

  var WA_NUMBER = "541100000000";
  var STORAGE_KEY = "Kerberos_carrito_v1";
  var productos = window.PRODUCTOS || [];

  var state = {
    categoria: "todas",
    marca: "todas",
    carrito: loadCart() // { [id]: cantidad }
  };

  var $ = function (sel) { return document.querySelector(sel); };

  // ---------- Persistencia (puede fallar en modo privado: se protege) ----------
  function loadCart() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.carrito)); } catch (e) { /* sin storage: sigue funcionando */ }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function unique(arr) {
    return arr.filter(function (v, i) { return arr.indexOf(v) === i; });
  }
  function findProd(id) {
    for (var i = 0; i < productos.length; i++) if (productos[i].id === id) return productos[i];
    return null;
  }
  function totalItems() {
    return Object.keys(state.carrito).reduce(function (t, k) { return t + state.carrito[k]; }, 0);
  }

  // ---------- Filtros ----------
  function buildFilters() {
    var cats = unique(productos.map(function (p) { return p.categoria; })).sort();
    var marcas = unique(productos.map(function (p) { return p.marca; })).sort();

    var chips = $("#catChips");
    chips.innerHTML = ["todas"].concat(cats).map(function (c) {
      var label = c === "todas" ? "Todas" : c;
      return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' +
        (c === state.categoria) + '">' + esc(label) + "</button>";
    }).join("");

    var sel = $("#marcaSelect");
    sel.innerHTML = '<option value="todas">Todas las marcas</option>' +
      marcas.map(function (m) { return '<option value="' + esc(m) + '">' + esc(m) + "</option>"; }).join("");
  }

  // ---------- Grilla de productos ----------
  function renderProductos() {
    var list = productos.filter(function (p) {
      return (state.categoria === "todas" || p.categoria === state.categoria) &&
             (state.marca === "todas" || p.marca === state.marca);
    });

    var html = list.map(function (p) {
      var qty = state.carrito[p.id] || 0;
      var foto = p.imagen
        ? '<img src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + '" loading="lazy">'
        : "Foto próximamente";
      var precio = p.precio ? "$ " + esc(p.precio) : "Consultar precio";
      return (
        '<article class="card">' +
          '<div class="ph">' + foto + "</div>" +
          '<div class="info">' +
            '<p class="marca">' + esc(p.marca) + "</p>" +
            "<h3>" + esc(p.nombre) + "</h3>" +
            '<p class="pres">' + esc(p.presentacion) + "</p>" +
            '<p class="precio">' + precio + "</p>" +
            '<div class="stepper">' +
              '<button type="button" data-act="menos" data-id="' + p.id + '" aria-label="Quitar uno de ' + esc(p.nombre) + '">−</button>' +
              '<span class="qty" aria-live="polite">' + qty + "</span>" +
              '<button type="button" data-act="mas" data-id="' + p.id + '" aria-label="Agregar uno de ' + esc(p.nombre) + '">+</button>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");

    $("#grid").innerHTML = html || '<p class="muted">No hay productos con esos filtros.</p>';
  }

  // ---------- Carrito ----------
  function renderCarrito() {
    var ids = Object.keys(state.carrito).filter(function (k) { return state.carrito[k] > 0; });
    var count = totalItems();
    $("#cartCount").textContent = count;

    var lines = $("#cartLines");
    if (!ids.length) {
      lines.innerHTML = '<p class="empty">Todavía no agregaste productos.</p>';
      return;
    }
    lines.innerHTML = ids.map(function (id) {
      var p = findProd(Number(id));
      if (!p) return "";
      return (
        '<div class="line">' +
          '<div class="txt">' + esc(p.nombre) + "<small>" + esc(p.marca) + " · " + esc(p.presentacion) + "</small></div>" +
          '<div class="stepper">' +
            '<button type="button" data-act="menos" data-id="' + p.id + '" aria-label="Quitar uno">−</button>' +
            '<span class="qty">' + state.carrito[p.id] + "</span>" +
            '<button type="button" data-act="mas" data-id="' + p.id + '" aria-label="Agregar uno">+</button>' +
          "</div>" +
          '<button type="button" class="rm" data-act="quitar" data-id="' + p.id + '">Quitar</button>' +
        "</div>"
      );
    }).join("");
  }

  function cambiar(id, accion) {
    var actual = state.carrito[id] || 0;
    if (accion === "mas") actual += 1;
    if (accion === "menos") actual -= 1;
    if (accion === "quitar") actual = 0;
    if (actual <= 0) delete state.carrito[id];
    else state.carrito[id] = actual;
    saveCart();
    renderProductos();
    renderCarrito();
  }

  // ---------- Armar mensaje y abrir WhatsApp ----------
  function enviarWhatsApp() {
    var ids = Object.keys(state.carrito).filter(function (k) { return state.carrito[k] > 0; });
    if (!ids.length) { alert("Agregá al menos un producto."); return; }

    var entrega = document.querySelector('input[name="entrega"]:checked');
    var nota = ($("#nota").value || "").trim();

    var lineas = ids.map(function (id) {
      var p = findProd(Number(id));
      return "- " + state.carrito[id] + " x " + p.nombre + " (" + p.marca + ", " + p.presentacion + ")";
    });

    var msg = "Hola! Quiero hacer el siguiente pedido:\n\n" + lineas.join("\n") +
      "\n\nEntrega: " + (entrega ? entrega.value : "a coordinar") +
      (nota ? "\nAclaración: " + nota : "") +
      "\n\n¿Me confirman precio y disponibilidad? Gracias!";

    var url = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
    window.open(url, "_blank", "noopener");
  }

  // ---------- Panel del carrito ----------
  function abrirCarrito(abrir) {
    $("#cart").hidden = !abrir;
    $("#overlay").hidden = !abrir;
    if (abrir) $("#cartClose").focus();
    else $("#cartToggle").focus();
  }

  // ---------- Eventos ----------
  function init() {
    buildFilters();
    renderProductos();
    renderCarrito();

    $("#catChips").addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]");
      if (!b) return;
      state.categoria = b.getAttribute("data-cat");
      document.querySelectorAll(".chip").forEach(function (c) {
        c.setAttribute("aria-pressed", String(c === b));
      });
      renderProductos();
    });

    $("#marcaSelect").addEventListener("change", function (e) {
      state.marca = e.target.value;
      renderProductos();
    });

    // Delegación para + / − / quitar, tanto en la grilla como en el carrito
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      cambiar(Number(b.getAttribute("data-id")), b.getAttribute("data-act"));
    });

    $("#cartToggle").addEventListener("click", function () { abrirCarrito(true); });
    $("#cartClose").addEventListener("click", function () { abrirCarrito(false); });
    $("#overlay").addEventListener("click", function () { abrirCarrito(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("#cart").hidden) abrirCarrito(false);
    });

    $("#sendWa").addEventListener("click", enviarWhatsApp);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
