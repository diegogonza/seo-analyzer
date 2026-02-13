document.addEventListener("DOMContentLoaded", () => {
  const highlightBtn = document.getElementById("highlightBtn");
  const clearBtn = document.getElementById("clearBtn");
  const tabItems = document.querySelectorAll(".tab-item");
  const tabPanes = document.querySelectorAll(".tab-pane");

  // Lógica de cambio de pestañas
  tabItems.forEach((item) => {
    item.addEventListener("click", () => {
      const targetTab = item.dataset.tab;

      // Remover clase active de todas las pestañas
      tabItems.forEach((tab) => tab.classList.remove("active"));
      tabPanes.forEach((pane) => pane.classList.remove("active"));

      // Agregar clase active a la pestaña seleccionada
      item.classList.add("active");
      document.getElementById(targetTab).classList.add("active");
    });
  });

  highlightBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["js/content.js"],
    });
  });

  clearBtn.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["js/unhighlight.js"],
    });

    // Limpiar la lista de encabezados
    list.innerHTML = "";
  });
});

const list = document.getElementById("list");

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  });
});

chrome.runtime.onMessage.addListener((message) => {
  list.innerHTML = "";

  if (!message.headings.length) {
    list.textContent = "No se encontraron titulares.";
    return;
  }

  // Contar H1s para validación SEO
  const h1Count = message.headings.filter((h) => h.tag === "H1").length;
  const hasMultipleH1 = h1Count > 1;

  message.headings.forEach((h) => {
    const div = document.createElement("div");
    div.className = `heading-item ${h.tag.toLowerCase()}`;

    const tag = document.createElement("span");
    tag.className = "heading-tag";
    tag.textContent = h.tag;

    // Cambiar color de la etiqueta si hay múltiples H1 y este es H1
    if (hasMultipleH1 && h.tag === "H1") {
      tag.style.backgroundColor = "#ff6b6b"; // rojo pastel
      tag.title = `Error: Se encontraron ${h1Count} H1s. Solo debería haber uno por página.`;
    }

    const text = document.createElement("span");
    text.className = "heading-text";
    text.textContent = h.text;

    div.appendChild(tag);
    div.appendChild(text);
    list.appendChild(div);
  });

  // Mostrar mensaje de advertencia si hay múltiples H1
  if (hasMultipleH1) {
    const warningDiv = document.createElement("div");
    warningDiv.className = "seo-warning";
    warningDiv.innerHTML = `
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">
        <strong>Problema SEO detectado:</strong> Se encontraron ${h1Count} etiquetas H1.
        Las páginas web deben tener solo una etiqueta H1 para mejor SEO.
      </div>
    `;
    list.insertBefore(warningDiv, list.firstChild);
  }
});
