/* eslint-disable no-undef */
// Firebase Messaging service worker — must live next to your HTML (same origin).

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC0nJQ_xIcXhFTtVEYbNhyc08Gw51gMVJ8",
  authDomain: "taxisystem-b9889.firebaseapp.com",
  projectId: "taxisystem-b9889",
  storageBucket: "taxisystem-b9889.firebasestorage.app",
  messagingSenderId: "259298885271",
  appId: "1:259298885271:web:72552130d05849ae44b3d2",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  const title = n.title || "RideApp";
  const body = n.body || "";
  const data = payload.data || {};
  return self.registration.showNotification(title, {
    body,
    data,
    tag: data.kind || "rideapp",
    renotify: true,
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || self.location.origin + "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const c of clientList) {
        if (c.url.includes(self.location.origin) && "focus" in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
