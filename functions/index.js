/**
 * When any client writes to `app_notifications`, send native push (FCM) to users
 * whose `users/{uid}.fcmTokens` contains registration tokens (set by the web app).
 *
 * Deploy (billing/Blaze required):
 *   cd functions && npm install && cd .. && firebase deploy --only functions
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function collectTokensFromUserDoc(docSnap) {
  const tokens = [];
  if (!docSnap.exists) return tokens;
  const raw = docSnap.get("fcmTokens");
  if (Array.isArray(raw)) {
    for (const t of raw) {
      if (typeof t === "string" && t.length > 10) tokens.push(t);
    }
  }
  return tokens;
}

exports.forwardAppNotificationPush = onDocumentCreated(
  {
    document: "app_notifications/{docId}",
    region: "us-central1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const title = String(data.title || "RideApp");
    const body = String(data.body || "");
    const kind = String(data.kind || "alert");

    const roles = Array.isArray(data.roles) ? data.roles : [];
    const targetUids = Array.isArray(data.targetUids) ? data.targetUids : [];

    const tokenSet = new Set();

    for (const role of roles) {
      const qs = await db.collection("users").where("role", "==", role).get();
      for (const d of qs.docs) {
        for (const t of collectTokensFromUserDoc(d)) tokenSet.add(t);
      }
    }

    for (const uid of targetUids) {
      if (!uid) continue;
      const u = await db.collection("users").doc(uid).get();
      for (const t of collectTokensFromUserDoc(u)) tokenSet.add(t);
    }

    const all = [...tokenSet];
    if (!all.length) {
      console.log("[forwardAppNotificationPush] No FCM tokens for this notification.");
      return;
    }

    const messaging = getMessaging();

    for (const tokens of chunk(all, 500)) {
      const res = await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { kind },
      });
      if (res.failureCount > 0) {
        res.responses.forEach((r, i) => {
          if (!r.success) console.warn("[FCM]", tokens[i], r.error?.code, r.error?.message);
        });
      }
    }
  }
);
