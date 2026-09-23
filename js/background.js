// Clic en el ícono → abre el panel lateral.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Atajo de teclado: alterna el resaltado y avisa al panel si está abierto.
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "highlight-headings") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const [check] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.hasAttribute("data-kr-active"),
    });
    const active = check && check.result;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: [active ? "js/unhighlight.js" : "js/content.js"],
    });

    const message = active
      ? { type: "kr-cleared", tabId: tab.id }
      : { type: "kr-results", tabId: tab.id, results };
    chrome.runtime.sendMessage(message).catch(() => {}); // sin panel abierto no hay receptor
  } catch (err) {
    console.warn("SEO Analyzer: no se puede analizar esta página.", err.message);
  }
});
