// Se carga en <head> para aplicar el tema antes de pintar (evita parpadeo).
(() => {
  let theme = null;
  try { theme = localStorage.getItem("kr-theme"); } catch (e) {}
  if (theme !== "light" && theme !== "dark") {
    theme = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  document.documentElement.setAttribute("data-theme", theme);
})();
