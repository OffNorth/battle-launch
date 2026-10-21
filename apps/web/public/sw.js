/*
 * Service worker de BATTLE LAUNCH : affiche les notifications web push envoyées par le worker
 * (lancement d'une battle, résultat) et ouvre la battle au clic. Rien d'autre (pas de cache).
 */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" ? data.title : "BATTLE LAUNCH";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      data: { url: typeof data.url === "string" ? data.url : "/" },
      icon: "/favicon.ico",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (typeof url === "string") event.waitUntil(self.clients.openWindow(url));
});
