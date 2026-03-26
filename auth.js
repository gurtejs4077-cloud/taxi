// ============================================================
// auth.js — Firebase Authentication (Email & Password)
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
  doc,
  getDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC0nJQ_xIcXhFTtVEYbNhyc08Gw51gMVJ8",
  authDomain: "taxisystem-b9889.firebaseapp.com",
  projectId: "taxisystem-b9889",
  storageBucket: "taxisystem-b9889.firebasestorage.app",
  messagingSenderId: "259298885271",
  appId: "1:259298885271:web:72552130d05849ae44b3d2"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ──────────────────────────────────────────────────────────
// REGISTER
// Creates Firebase Auth user + users doc + drivers doc
// ──────────────────────────────────────────────────────────
export async function registerUser(email, password, role = "driver") {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // Save to users collection
  await setDoc(doc(db, "users", user.uid), {
    email,
    role,
    driverId: user.uid,
    createdAt: new Date(),
  });

  // If driver → also create drivers doc
  if (role === "driver") {
    await setDoc(doc(db, "drivers", user.uid), {
      email,
      status:      "offline",
      location:    null,
      lastUpdated: new Date(),
    });
  }

  console.log("[Auth] Registered:", email, "| role:", role, "| uid:", user.uid);
  return { user, role, driverId: user.uid, email };
}

// ──────────────────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────────────────
export async function loginUser(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const user       = credential.user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("auth/user-not-found");
  }

  const profile = snap.data();
  console.log("[Auth] Logged in:", email, "| role:", profile.role);
  return {
    user,
    role:     profile.role     || "driver",
    driverId: profile.driverId || user.uid,
    email:    profile.email    || email,
  };
}

// ──────────────────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────────────────
export async function logoutUser() {
  await signOut(auth);
}

// ──────────────────────────────────────────────────────────
// REQUIRE AUTH — guards protected pages
//
// Returns Promise<{ user, role, driverId, email }>
// Redirects to login.html if:
//   - not logged in
//   - users doc missing (auto-repairs by creating it)
//   - wrong role
// Never hangs — wraps Firestore read in try/catch
// ──────────────────────────────────────────────────────────
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      // Not logged in → go to login
      if (!user) {
        console.log("[Auth] No user → login.html");
        window.location.href = "login.html";
        return;
      }

      console.log("[Auth] User detected:", user.email, "| uid:", user.uid);

      let profile = null;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));

        if (snap.exists()) {
          profile = snap.data();
          console.log("[Auth] Profile loaded:", profile);
        } else {
          // ── AUTO-REPAIR: users doc missing ──────────────
          // This happens when a driver registered via old code
          // that didn't create the users doc, or Firestore rules
          // blocked the write. We rebuild it from Auth data.
          console.warn("[Auth] users doc missing — auto-creating for:", user.email);

          profile = {
            email:    user.email,
            role:     "driver",
            driverId: user.uid,
            createdAt: new Date(),
          };

          // Create users doc
          await setDoc(doc(db, "users", user.uid), profile);

          // Create drivers doc if missing
          const driverSnap = await getDoc(doc(db, "drivers", user.uid));
          if (!driverSnap.exists()) {
            await setDoc(doc(db, "drivers", user.uid), {
              email:       user.email,
              status:      "offline",
              location:    null,
              lastUpdated: new Date(),
            });
          }

          console.log("[Auth] Auto-repair complete.");
        }
      } catch (err) {
        // Firestore read failed (permissions / network)
        console.error("[Auth] Firestore read failed:", err.message);

        // Use minimal fallback profile from Auth data so page still loads
        profile = {
          email:    user.email,
          role:     "driver",
          driverId: user.uid,
        };
      }

      const role     = profile.role     || "driver";
      const driverId = profile.driverId || user.uid;
      const email    = profile.email    || user.email;

      // Wrong role → redirect to correct page
      if (requiredRole && role !== requiredRole) {
        console.log("[Auth] Wrong role:", role, "→ redirecting");
        window.location.href = role === "admin" ? "index.html" : "driver.html";
        return;
      }

      console.log("[Auth] ✅ Auth resolved | role:", role, "| driverId:", driverId);
      resolve({ user, role, driverId, email });
    });
  });
}