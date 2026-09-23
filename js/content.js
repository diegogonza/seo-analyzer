// Resalta los H1-H6 sin tocar el HTML ni los estilos en línea de la página.
// Marca cada heading con el atributo data-kr-h y pinta con una hoja de estilos propia.
// Devuelve la lista de headings como resultado de executeScript (se inyecta en todos los frames).
(() => {
  const STYLE_ID = "kr-seo-analyzer-style";
  const CSS = `
    [data-kr-h] {
      background-color: #008000d7 !important;
      color: #ffffff !important;
      outline: 1px solid #ffffff55 !important;
      outline-offset: 0 !important;
    }
    [data-kr-h="H1"] { background-color: #39FF14d7 !important; }
    [data-kr-h]::before {
      content: attr(data-kr-h) " - ";
      font-weight: bold;
    }
  `;

  const addStyle = (root) => {
    const parent = root === document ? document.head || document.documentElement : root;
    if (!parent || (root.getElementById ? root.getElementById(STYLE_ID) : parent.querySelector("#" + STYLE_ID))) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = CSS;
    parent.appendChild(style);
  };

  const isVisible = (el) => {
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    return el.getClientRects().length > 0;
  };

  const headings = [];

  // Recorre el documento y los shadow roots abiertos en orden de documento.
  const walk = (root) => {
    let rootHasHeadings = false;
    root.querySelectorAll("*").forEach((el) => {
      if (/^H[1-6]$/.test(el.tagName)) {
        rootHasHeadings = true;
        el.setAttribute("data-kr-h", el.tagName);
        el.setAttribute("data-kr-i", String(headings.length));
        headings.push({
          i: headings.length,
          tag: el.tagName,
          text: (el.textContent || "").replace(/\s+/g, " ").trim(),
          hidden: !isVisible(el),
        });
      }
      if (el.shadowRoot) walk(el.shadowRoot);
    });
    if (rootHasHeadings || root === document) addStyle(root);
  };

  walk(document);
  document.documentElement.setAttribute("data-kr-active", "1");

  return {
    isTop: window === window.top,
    url: location.href,
    title: document.title,
    headings,
  };
})();
