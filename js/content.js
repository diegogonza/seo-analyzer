(() => {
  const colors = [
    "#39FF14d7", // H1 - verde brillante KICKRANKING
    "#008000d7", // H2-H6 - verde oscuro KICKRANKING
  ];

  for (let i = 1; i <= 6; i++) {
    const headers = document.querySelectorAll("h" + i);
    const colorIndex = i === 1 ? 0 : 1; // H1 usa color[0], H2-H6 usan color[1]

    headers.forEach((header) => {
      header.style.backgroundColor = colors[colorIndex];
      header.style.border = "1px solid #ffffff55"; // borde blanco semitransparente
      header.style.padding = "4px";
      header.style.color = "white"; // texto blanco forzado para todos
      if (!header.innerHTML.startsWith(`H${i} - `)) {
        header.innerHTML = `H${i} - ` + header.innerHTML;
      }
    });
  }
})();

(() => {
  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6"),
  ).map((h) => {
    let text = h.innerText.trim();
    // Eliminar el prefijo "Hn - " si existe
    const headingLevel = h.tagName.substring(1); // Obtener el número del heading
    const prefix = `H${headingLevel} - `;
    if (text.startsWith(prefix)) {
      text = text.substring(prefix.length);
    }

    return {
      tag: h.tagName,
      text: text,
    };
  });

  chrome.runtime.sendMessage({ headings });
})();
