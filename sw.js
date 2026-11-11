const CACHE = 'invokers-shell-v6';
const BASE = new URL('./', self.registration.scope);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([BASE.href, new URL('manifest.webmanifest', BASE).href, new URL('icon-192.png', BASE).href, new URL('icon-512.png', BASE).href])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))));
  self.clients.claim();
});
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('invokers-web-manager', 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('imports')) db.createObjectStore('imports', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('share-inbox')) db.createObjectStore('share-inbox', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveShared(files) {
  const db = await openDatabase();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('share-inbox', 'readwrite');
      tx.objectStore('share-inbox').put({ id: 'latest', files, receivedAt: new Date().toISOString() });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname === new URL('share', BASE).pathname) {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const files = form.getAll('snapshots').filter(value => value instanceof File);
        if (!files.length || files.length > 100 || files.some(file => !(/\.(dat|json)$/i.test(file.name)) || file.size > 100 * 1024 * 1024) || files.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024) throw new Error('Lote de snapshots no válido');
        await saveShared(files);
        return Response.redirect(new URL('?shared=1', BASE).href, 303);
      } catch (_) { return Response.redirect(new URL('?share_error=1', BASE).href, 303); }
    })());
    return;
  }
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith(new URL('game/', BASE).pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    })());
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && url.pathname.includes('/assets/')) {
      const copy = response.clone(); caches.open(CACHE).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request)));
});
