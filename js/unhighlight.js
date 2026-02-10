(() => {
  for (let i = 1; i <= 6; i++) {
    const headers = document.querySelectorAll('h' + i);
    headers.forEach(header => {
      // Quitar estilos visuales
      header.style.backgroundColor = '';
      header.style.border = '';
      header.style.padding = '';
      header.style.color = '';

      // Eliminar el prefijo "Hn - " si existe
      const prefix = `H${i} - `;
      if (header.innerHTML.startsWith(prefix)) {
        header.innerHTML = header.innerHTML.replace(prefix, '');
      }
    });
  }
})();
