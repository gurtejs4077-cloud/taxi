// Web Push via Firebase Cloud Messaging (background + token on users/{uid}.fcmTokens)

import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { doc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { FCM_VAPID_KEY } from "./auth.js";

const SW_PATH = "./firebase-messaging-sw.js";

/**
 * Register SW, prompt notification permission if needed, save FCM token to Firestore.
 * Harmless no-op if unsupported, denied, or VAPID not configured.
 */
export async function tryEnableWebPush({ app, db, userId }) {
  if (!FCM_VAPID_KEY || typeof FCM_VAPID_KEY !== "string" || !FCM_VAPID_KEY.trim()) {
    console.info(
      "[Push] FCM_VAPID_KEY is empty — add Web Push public key from Firebase Console (see auth.js)."
    );
    return;
  }
  if (!app || !db || !userId) return;
  if (!(await isSupported())) {
    console.info("[Push] FCM not supported in this browser.");
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.register(SW_PATH, { scope: "./" });
    await navigator.serviceWorker.ready;

    let p = Notification.permission;
    if (p === "denied") return;
    if (p === "default") {
      p = await Notification.requestPermission();
      if (p !== "granted") return;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: FCM_VAPID_KEY.trim(),
      serviceWorkerRegistration: reg,
    });
    if (!token) return;

    await updateDoc(doc(db, "users", userId), {
      fcmTokens: arrayUnion(token),
    });

    onMessage(messaging, () => {
      // Firestore app_notifications still drives in-app bell + sound when the tab is open.
    });
  } catch (e) {
    console.warn("[Push]", e?.message || e);
  }
}
