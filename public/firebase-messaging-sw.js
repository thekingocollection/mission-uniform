/* Firebase Cloud Messaging background worker.
 * Firebase web configuration is public client configuration, not a server secret.
 */
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAs7Pp515kBwrRqqN19UewSmlZLPnkC5xQ",
  authDomain: "mission-uniform-f61be.firebaseapp.com",
  projectId: "mission-uniform-f61be",
  storageBucket: "mission-uniform-f61be.firebasestorage.app",
  messagingSenderId: "421694737193",
  appId: "1:421694737193:web:79db0e0338c85781354538",
  measurementId: "G-TJ86E8NG71"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  const title = notification.title || data.title || "MISSION UNIFORM OP";
  const options = {
    body: notification.body || data.body || "A new update is waiting for you.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: data.url || "/notifications" },
    tag: data.tag || "mission-uniform-fcm"
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let target = event.notification.data?.url || "/notifications";
  if (!target.startsWith("/") || target.startsWith("//")) target = "/notifications";
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    for (const client of windows) {
      if ("focus" in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return clients.openWindow(target);
  }));
});
