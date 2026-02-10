document.addEventListener("DOMContentLoaded", () => {
  const highlightBtn = document.getElementById("highlightBtn");
  const clearBtn = document.getElementById("clearBtn");

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

  message.headings.forEach((h) => {
    const div = document.createElement("div");
    div.className = "heading";
    div.innerHTML = `${h.text}`;
    list.appendChild(div);
  });
});
