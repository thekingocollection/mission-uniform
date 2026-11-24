self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "MISSION UNIFORM OP";
  const options = {
    body: payload.body || "A new student update is waiting for you.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.notificationId || "mission-uniform-update",
    renotify: false,
    data: { url: payload.url || "/notifications", notificationId: payload.notificationId || "" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const data = event.notification.data || {};
  let target = data.url || "/notifications";
  if (!target.startsWith("/") || target.startsWith("//")) target = "/notifications";
  if (data.notificationId) target = "/notifications?openNotification=" + encodeURIComponent(data.notificationId) + "&target=" + encodeURIComponent(target);
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ("focus" in client) { client.navigate(target); return client.focus(); }
    }
    return clients.openWindow(target);
  }));
});
