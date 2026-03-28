// ================================================================
// auth.js  —  RideApp Shared Auth
// Roles:  "superadmin" | "admin" | "driver" | "customer"
//
// Firestore  users/{uid}  structure:
//   email, name, phone, role, driverId, createdAt, approvedAt
//
// Firestore  drivers/{uid}  structure (drivers + admins who drive):
//   email, name, phone, status, location, lastUpdated
// ================================================================

import { initializeApp }             from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ─────────────────────────────────────────
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

// ── Role hierarchy ───────────────────────────────────────────
// superadmin > admin > driver > customer
const ROLE_RANK = { superadmin: 4, admin: 3, driver: 2, customer: 1 };

export function roleRank(role) {
  return ROLE_RANK[role] || 0;
}

// ── Redirect map ─────────────────────────────────────────────
const ROLE_PAGE = {
  superadmin: "superadmin.html",
  admin:      "index.html",
  driver:     "driver.html",
  customer:   "customer.html",
};

export function redirectByRole(role) {
  window.location.href = ROLE_PAGE[role] || "login.html";
}

// ================================================================
// REGISTER
// All new users start as "customer" — superadmin/admin promotes them.
// ================================================================
export async function registerUser(email, password, name = "", phone = "") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const profile = {
    email,
    name:      name  || email.split("@")[0],
    phone:     phone || "",
    role:      "customer",   // always start as customer
    driverId:  null,
    createdAt: new Date().toISOString(),
    approvedAt: null,
  };

  await setDoc(doc(db, "users", user.uid), profile);

  console.log("[Auth] Registered:", email, "as customer");
  return { user, ...profile };
}

// ================================================================
// LOGIN
// ================================================================
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const user = cred.user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("auth/user-not-found");
  }

  const p = snap.data();
  console.log("[Auth] Login:", email, "role:", p.role);
  return {
    user,
    role:     p.role  || "customer",
    driverId: p.driverId || null,
    email:    p.email || email,
    name:     p.name  || "",
    phone:    p.phone || "",
  };
}

export async function logoutUser() {
  await signOut(auth);
}

// ================================================================
// PROMOTE USER  (called by superadmin / admin panels)
// Changes role in users doc + creates/removes drivers doc as needed.
// Only superadmin can promote to admin/superadmin.
// Admin can promote customer → driver only.
// ================================================================
export async function promoteUser(targetUid, newRole, callerRole) {
  // Permission check
  if (newRole === "superadmin" && callerRole !== "superadmin") {
    throw new Error("Only superadmin can assign superadmin role.");
  }
  if ((newRole === "admin") && callerRole !== "superadmin") {
    throw new Error("Only superadmin can assign admin role.");
  }

  const userRef  = doc(db, "users", targetUid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error("User not found.");

  const userData = userSnap.data();
  const updates  = {
    role:       newRole,
    approvedAt: new Date().toISOString(),
  };

  // If promoting to driver/admin → create drivers collection doc
  if (newRole === "driver" || newRole === "admin") {
    updates.driverId = targetUid;
    await setDoc(doc(db, "drivers", targetUid), {
      email:       userData.email  || "",
      name:        userData.name   || "",
      phone:       userData.phone  || "",
      status:      "offline",
      location:    null,
      lastUpdated: new Date().toISOString(),
    }, { merge: true });
  }

  // If demoting back to customer → mark driver offline but keep doc for history
  if (newRole === "customer") {
    updates.driverId = null;
    try {
      await updateDoc(doc(db, "drivers", targetUid), { status: "offline" });
    } catch(e) { /* driver doc may not exist */ }
  }

  await updateDoc(userRef, updates);
  console.log("[Auth] Promoted", targetUid, "to", newRole);
}

// ================================================================
// REQUIRE AUTH
// Always resolves — never hangs.
// Auto-repairs missing Firestore docs.
// Redirects wrong roles to their correct page.
// ================================================================
export function requireAuth(requiredRole = null) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "login.html";
        return;
      }

      let profile = null;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          profile = snap.data();
        } else {
          // Auto-repair missing profile
          console.warn("[Auth] Missing profile — auto-creating as customer");
          profile = {
            email:     user.email,
            name:      user.email.split("@")[0],
            phone:     "",
            role:      "customer",
            driverId:  null,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, "users", user.uid), profile);
        }
      } catch (err) {
        console.error("[Auth] Firestore error:", err.message);
        // Fallback — never hang the page
        profile = {
          email:    user.email,
          name:     user.email.split("@")[0],
          phone:    "",
          role:     "customer",
          driverId: null,
        };
      }

      const role     = profile.role     || "customer";
      const driverId = profile.driverId || user.uid;
      const email    = profile.email    || user.email;
      const name     = profile.name     || email.split("@")[0];
      const phone    = profile.phone    || "";

      // Superadmin can access any page
      if (role === "superadmin" && requiredRole !== "superadmin") {
        // Let superadmin through — they can view any panel
        resolve({ user, role, driverId, email, name, phone });
        return;
      }

      // Wrong role — redirect to correct page
      if (requiredRole && role !== requiredRole) {
        console.log("[Auth] Wrong role:", role, "→ redirecting to", ROLE_PAGE[role]);
        window.location.href = ROLE_PAGE[role] || "login.html";
        return;
      }

      console.log("[Auth] ✅ Resolved | role:", role, "uid:", user.uid);
      resolve({ user, role, driverId, email, name, phone });
    });
  });
}
