chrome.commands.onCommand.addListener((command) => {
  console.log("Command received:", command);

  if (command === "highlight-headings") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const tab = tabs[0];
        console.log("Toggling headings on tab:", tab.id);

        // Primero verificamos si ya hay encabezados resaltados
        chrome.scripting.executeScript(
          {
            target: { tabId: tab.id },
            func: checkHighlightedHeadings,
          },
          (result) => {
            if (chrome.runtime.lastError) {
              console.error("Check error:", chrome.runtime.lastError);
              return;
            }

            const hasHighlighted = result && result[0] && result[0].result;
            console.log("Has highlighted headings:", hasHighlighted);

            if (hasHighlighted) {
              // Si ya están resaltados, los quitamos
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["js/unhighlight.js"],
              });
            } else {
              // Si no están resaltados, los activamos
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["js/content.js"],
              });
            }
          },
        );
      }
    });
  }
});

// Función para verificar si hay encabezados resaltados
function checkHighlightedHeadings() {
  const highlightedHeadings = document.querySelectorAll(
    'h1[style*="background-color"], h2[style*="background-color"], h3[style*="background-color"], h4[style*="background-color"], h5[style*="background-color"], h6[style*="background-color"]',
  );
  return highlightedHeadings.length > 0;
}
