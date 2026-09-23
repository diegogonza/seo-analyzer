// Quita el resaltado: borra solo lo que puso la extensión (atributos y hoja de estilos).
(() => {
  const STYLE_ID = "kr-seo-analyzer-style";

  const walk = (root) => {
    root.querySelectorAll("*").forEach((el) => {
      el.removeAttribute("data-kr-h");
      el.removeAttribute("data-kr-i");
      if (el.id === STYLE_ID && el.tagName === "STYLE") el.remove();
      if (el.shadowRoot) walk(el.shadowRoot);
    });
  };

  walk(document);
  document.documentElement.removeAttribute("data-kr-active");
  return true;
})();
