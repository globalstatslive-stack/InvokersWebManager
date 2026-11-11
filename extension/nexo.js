// Avisa a la web de Nexo de que la extensión está instalada (oculta los pasos del marcador).
document.documentElement.dataset.nexoExtension = chrome.runtime.getManifest().version
