// Service worker: fa funzionare l'app offline e riceve i file condivisi (es. da Huawei Health).
// Quando modifichi l'app, aumenta il numero di versione qui sotto.
const CACHE = "corsa-v14";
const FILES = ["./", "index.html", "manifest.json", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "corsa-share").map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // File condiviso da un'altra app: lo parcheggio e apro l'app, che lo importa.
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const form = await e.request.formData();
        const file = form.get("file");
        const c = await caches.open("corsa-share");
        if (file && file.size) {
          await c.put("shared-file", new Response(file, { headers: { "X-File-Name": encodeURIComponent(file.name || "") } }));
        } else {
          // condivisione di un link/testo (es. «Condividi» da Strava)
          const txt = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join(" ");
          if (txt) await c.put("shared-text", new Response(txt));
        }
      } catch (err) {}
      return Response.redirect(new URL("./?shared=1", self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== "GET") return;
  // Prima prova la rete (così prendi gli aggiornamenti), se sei offline usa la copia salvata.
  e.respondWith(
    fetch(e.request).then(r => {
      const copy = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
