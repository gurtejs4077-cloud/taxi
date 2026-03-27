// ============================================================
// auth.js — Shared Firebase Auth + Firestore bootstrap
// Roles: "admin" | "driver" | "customer"
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyC0nJQ_xIcXhFTtVEYbNhyc08Gw51gMVJ8",
  authDomain:        "taxisystem-b9889.firebaseapp.com",
  projectId:         "taxisystem-b9889",
  storageBucket:     "taxisystem-b9889.firebasestorage.app",
  messagingSenderId: "259298885271",
  appId:             "1:259298885271:web:72552130d05849ae44b3d2",
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ──────────────────────────────────────────────────────────
// REGISTER
// role: "driver" | "customer" | "admin"
// ──────────────────────────────────────────────────────────
export async function registerUser(email, password, role = "customer", name = "") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  // users collection — shared profile
  await setDoc(doc(db, "users", user.uid), {
    email,
    name:      name || email.split("@")[0],
    role,
    driverId:  role === "driver"   ? user.uid : null,
    createdAt: new Date(),
  });

  // drivers collection — only for drivers
  if (role === "driver") {
    await setDoc(doc(db, "drivers", user.uid), {
      email,
      name:        name || email.split("@")[0],
      status:      "offline",
      location:    null,
      lastUpdated: new Date(),
    });
  }

  console.log("[Auth] Registered:", email, "role:", role);
  return { user, role, driverId: user.uid, email, name };
}

// ──────────────────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;
  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("auth/user-not-found");
  }
  const p = snap.data();
  return {
    user,
    role:     p.role     || "customer",
    driverId: p.driverId || null,
    email:    p.email    || email,
    name:     p.name     || "",
  };
}

export async function logoutUser() {
  await signOut(auth);
}

// ──────────────────────────────────────────────────────────
// REQUIRE AUTH — always resolves (never hangs)
// Auto-repairs missing Firestore docs
// ──────────────────────────────────────────────────────────
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) { window.location.href = "login.html"; return; }

      let profile = null;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          profile = snap.data();
        } else {
          // Auto-repair: create missing user doc as customer
          console.warn("[Auth] Missing users doc — auto-creating as customer");
          profile = { email: user.email, name: user.email.split("@")[0], role: "customer", driverId: null, createdAt: new Date() };
          await setDoc(doc(db, "users", user.uid), profile);
        }
      } catch (err) {
        console.error("[Auth] Firestore error:", err.message);
        // Fallback so page never hangs
        profile = { email: user.email, name: user.email.split("@")[0], role: "customer", driverId: null };
      }

      const role     = profile.role     || "customer";
      const driverId = profile.driverId || null;
      const email    = profile.email    || user.email;
      const name     = profile.name     || email.split("@")[0];

      // Wrong role → redirect
      if (requiredRole && role !== requiredRole) {
        const dest = { admin: "index.html", driver: "driver.html", customer: "customer.html" };
        window.location.href = dest[role] || "login.html";
        return;
      }

      console.log("[Auth] ✅ Resolved | role:", role, "| uid:", user.uid);
      resolve({ user, role, driverId, email, name });
    });
  });
}

// ──────────────────────────────────────────────────────────
// Redirect helper — used after login/register
// ──────────────────────────────────────────────────────────
export function redirectByRole(role) {
  const dest = { admin: "index.html", driver: "driver.html", customer: "customer.html" };
  window.location.href = dest[role] || "login.html";
}
