/* PRV service worker.
 *
 * Only handles push display and notification clicks. It deliberately caches nothing: PRV data is
 * private and must never be written to the HTTP cache, so responses pass straight through.
 */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "PRV", body: "Nouvelle notification", url: "/prv" };
  try {
    if (event.data) {
      const parsed = JSON.parse(event.data.text());
      payload = {
        title: typeof parsed.title === "string" ? parsed.title.slice(0, 120) : payload.title,
        body: typeof parsed.body === "string" ? parsed.body.slice(0, 300) : payload.body,
        url: typeof parsed.url === "string" && parsed.url.startsWith("/") ? parsed.url : payload.url,
      };
    }
  } catch {
    // Keep the safe defaults.
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "prv-notification",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/prv";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(target) && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});

// Never serve private content from a cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});
