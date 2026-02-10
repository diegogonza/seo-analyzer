(() => {
  const colors = [
    "#042940", // H1 - azul profundo
    "#5E60CE", // H2 - violeta azulado
    "#748CAB", // H3 - azul grisáceo claro
    "#9F86C0", // H4 - lavanda pastel
    "#C9B6E4", // H5 - lila claro
    "#E0CFF7", // H6 - lila muy suave
  ];

  for (let i = 1; i <= 6; i++) {
    const headers = document.querySelectorAll("h" + i);
    headers.forEach((header) => {
      header.style.backgroundColor = colors[i - 1];
      header.style.border = "1px solid #ffffff55"; // borde blanco semitransparente
      header.style.padding = "4px";
      header.style.color = "white"; // texto blanco para todos
      if (!header.innerHTML.startsWith(`H${i} - `)) {
        header.innerHTML = `H${i} - ` + header.innerHTML;
      }
    });
  }
})();

(() => {
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6")
  ).map((h) => ({
    tag: h.tagName,
    text: h.innerText.trim(),
  }));

  chrome.runtime.sendMessage({ headings });
})();
