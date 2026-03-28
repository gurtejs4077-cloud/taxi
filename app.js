// ============================================================
// app.js — Taxi Dispatch System
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  // 🔴 REPLACE with your actual Firebase config
  
  apiKey: "AIzaSyC0nJQ_xIcXhFTtVEYbNhyc08Gw51gMVJ8",
  authDomain: "taxisystem-b9889.firebaseapp.com",
  projectId: "taxisystem-b9889",
  storageBucket: "taxisystem-b9889.firebasestorage.app",
  messagingSenderId: "259298885271",
  appId: "1:259298885271:web:72552130d05849ae44b3d2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── Shared State ─────────────────────────────────────────────
let currentDriverId = null;
let rideListenerUnsubscribe = null;

// Tracks ride IDs already shown to prevent duplicate popups
const shownRideIds = new Set();


// ============================================================
// DRIVER PAGE LOGIC
// ============================================================

/**
 * Call this from driver.html after driver enters their ID.
 * Sets driver status to "available" and starts GPS + ride listener.
 */
export async function initDriver(driverId) {
  if (!driverId || driverId.trim() === "") {
    alert("Please enter a valid Driver ID.");
    return;
  }

  currentDriverId = driverId.trim();
  console.log(`[Driver] Initialized as: ${currentDriverId}`);

  // Set driver as available in Firestore
  await setDoc(
    doc(db, "drivers", currentDriverId),
    { status: "available", lastUpdated: serverTimestamp() },
    { merge: true }
  );

  startGPSTracking();
  startRideListener();
}

/**
 * Update driver status manually (available / busy).
 */
export async function setDriverStatus(status) {
  if (!currentDriverId) return;
  await updateDoc(doc(db, "drivers", currentDriverId), {
    status,
    lastUpdated: serverTimestamp(),
  });
  console.log(`[Driver] Status set to: ${status}`);
}

/**
 * GPS — push to Firestore every 5 minutes (and once on start).
 */
function startGPSTracking() {
  if (!navigator.geolocation) {
    console.warn("[GPS] Geolocation not supported.");
    return;
  }

  const push = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        updateDoc(doc(db, "drivers", currentDriverId), {
          location: { lat, lng },
          fleetRole: "driver",
          lastUpdated: serverTimestamp(),
        });
        console.log(`[GPS] Updated: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      },
      (err) => console.error("[GPS] Error:", err.message),
      { enableHighAccuracy: true, maximumAge: 120000, timeout: 20000 }
    );
  };
  push();
  setInterval(push, 5 * 60 * 1000);
}

// ============================================================
// 🔔 RIDE NOTIFICATION LISTENER  ← CORE FIX
// ============================================================

/**
 * Listens for rides assigned to this driver with status "assigned".
 * Shows popup on new assignment. Handles page refresh gracefully.
 * Safe against duplicate popups via shownRideIds set.
 */
function startRideListener() {
  // Clean up any existing listener first
  if (rideListenerUnsubscribe) {
    rideListenerUnsubscribe();
    console.log("[Listener] Previous ride listener removed.");
  }

  const ridesRef = collection(db, "rides");

  // Query: rides assigned to THIS driver that are still in "assigned" state
  const q = query(
    ridesRef,
    where("driverId", "==", currentDriverId),
    where("status", "==", "assigned")
  );

  console.log(`[Listener] Watching rides for driver: ${currentDriverId}`);

  rideListenerUnsubscribe = onSnapshot(
    q,
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const rideId = change.doc.id;
        const ride = change.doc.data();

        console.log(`[Ride] Change type: ${change.type} | Ride ID: ${rideId}`, ride);

        // Only react to newly added or modified rides
        if (change.type === "added" || change.type === "modified") {
          // Guard: don't show popup for the same ride twice
          if (shownRideIds.has(rideId)) {
            console.log(`[Ride] Already shown popup for ride: ${rideId} — skipping.`);
            return;
          }

          // Extra safety: confirm status is still "assigned"
          if (ride.status !== "assigned") {
            console.log(`[Ride] Ride ${rideId} status is "${ride.status}" — no popup.`);
            return;
          }

          shownRideIds.add(rideId);
          showRidePopup(rideId, ride);
        }
      });
    },
    (error) => {
      console.error("[Listener] Firestore error:", error);
    }
  );
}


// ============================================================
// POPUP UI
// ============================================================

/**
 * Shows the ride assignment popup to the driver.
 * @param {string} rideId - Firestore document ID
 * @param {object} ride   - Ride data { pickup, drop, driverId, status }
 */
function showRidePopup(rideId, ride) {
  console.log(`[Popup] Showing for ride: ${rideId}`);

  // Remove any existing popup first
  const existing = document.getElementById("ride-popup");
  if (existing) existing.remove();

  const popup = document.createElement("div");
  popup.id = "ride-popup";
  popup.innerHTML = `
    <div id="ride-popup-overlay">
      <div id="ride-popup-box">
        <div id="ride-popup-header">
          <span id="ride-popup-icon">🚖</span>
          <h2>New Ride Request</h2>
        </div>
        <div id="ride-popup-body">
          <div class="ride-detail">
            <span class="label">📍 Pickup</span>
            <span class="value">${ride.pickup || "N/A"}</span>
          </div>
          <div class="ride-arrow">↓</div>
          <div class="ride-detail">
            <span class="label">🏁 Drop</span>
            <span class="value">${ride.drop || "N/A"}</span>
          </div>
        </div>
        <div id="ride-popup-actions">
          <button id="btn-accept" class="popup-btn accept">✅ Accept</button>
          <button id="btn-reject" class="popup-btn reject">❌ Reject</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Accept handler
  document.getElementById("btn-accept").addEventListener("click", async () => {
    console.log(`[Ride] Accepted: ${rideId}`);
    await updateDoc(doc(db, "rides", rideId), { status: "ongoing" });
    await updateDoc(doc(db, "drivers", currentDriverId), { status: "busy" });
    closePopup(rideId);
  });

  // Reject handler
  document.getElementById("btn-reject").addEventListener("click", async () => {
    console.log(`[Ride] Rejected: ${rideId}`);
    await updateDoc(doc(db, "rides", rideId), {
      status: "rejected",
      driverId: null,
    });
    // Make driver available again
    await updateDoc(doc(db, "drivers", currentDriverId), { status: "available" });
    closePopup(rideId);
    // Re-assign rejected ride to another available driver
    tryReassignRide(rideId, ride);
  });
}

function closePopup(rideId) {
  const popup = document.getElementById("ride-popup");
  if (popup) {
    popup.classList.add("fade-out");
    setTimeout(() => popup.remove(), 300);
  }
  // Remove from shown set so it could theoretically reappear
  // if re-assigned — but in practice it won't since status changes.
  shownRideIds.delete(rideId);
}

/**
 * If a driver rejects, find the next available driver and assign them.
 */
async function tryReassignRide(rideId, ride) {
  console.log(`[Reassign] Looking for new driver for ride: ${rideId}`);
  const q = query(
    collection(db, "drivers"),
    where("status", "==", "available")
  );
  const snap = await getDocs(q);
  if (snap.empty) {
    console.log("[Reassign] No available drivers found.");
    await updateDoc(doc(db, "rides", rideId), { status: "pending" });
    return;
  }

  // Pick first available driver (excluding current rejector)
  let newDriver = null;
  snap.forEach((d) => {
    if (!newDriver && d.id !== currentDriverId) newDriver = d;
  });

  if (!newDriver) {
    console.log("[Reassign] No other available drivers.");
    await updateDoc(doc(db, "rides", rideId), { status: "pending" });
    return;
  }

  await updateDoc(doc(db, "rides", rideId), {
    status: "assigned",
    driverId: newDriver.id,
  });
  await updateDoc(doc(db, "drivers", newDriver.id), { status: "busy" });
  console.log(`[Reassign] Ride ${rideId} reassigned to ${newDriver.id}`);
}


// ============================================================
// ADMIN PAGE LOGIC
// ============================================================

/**
 * Admin creates a new ride. Automatically assigns nearest available driver.
 * @param {string} pickup
 * @param {string} drop
 */
export async function createRide(pickup, drop) {
  if (!pickup || !drop) {
    alert("Enter both pickup and drop locations.");
    return;
  }

  // Find first available driver
  const q = query(
    collection(db, "drivers"),
    where("status", "==", "available")
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    alert("No available drivers right now.");
    const ridesRef = collection(db, "rides");
    await setDoc(doc(ridesRef), {
      pickup,
      drop,
      status: "pending",
      driverId: null,
      createdAt: serverTimestamp(),
    });
    console.log("[Admin] Ride created as pending (no drivers available).");
    return;
  }

  const driverDoc = snap.docs[0];
  const assignedDriverId = driverDoc.id;

  const ridesRef = collection(db, "rides");
  const newRideRef = doc(ridesRef);

  await setDoc(newRideRef, {
    pickup,
    drop,
    status: "assigned",
    driverId: assignedDriverId,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "drivers", assignedDriverId), { status: "busy" });

  console.log(`[Admin] Ride ${newRideRef.id} assigned to driver ${assignedDriverId}`);
  alert(`Ride assigned to driver: ${assignedDriverId}`);
}


// ============================================================
// LIVE MAP (Leaflet)
// ============================================================

let map = null;
const driverMarkers = {}; // driverId → Leaflet marker

/**
 * Initialize Leaflet map. Call from index.html after DOM is ready.
 */
export function initMap(containerId = "map") {
  map = L.map(containerId).setView([20.5937, 78.9629], 5); // India default
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  startDriverMapListener();
}

function startDriverMapListener() {
  onSnapshot(collection(db, "drivers"), (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const driverId = change.doc.id;
      const data = change.doc.data();

      if (change.type === "removed") {
        if (driverMarkers[driverId]) {
          map.removeLayer(driverMarkers[driverId]);
          delete driverMarkers[driverId];
        }
        return;
      }

      if (!data.location) return;

      const { lat, lng } = data.location;

      if (driverMarkers[driverId]) {
        driverMarkers[driverId].setLatLng([lat, lng]);
      } else {
        driverMarkers[driverId] = L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`Driver: ${driverId}<br>Status: ${data.status}`);
      }

      driverMarkers[driverId]
        .getPopup()
        .setContent(`Driver: ${driverId}<br>Status: ${data.status}`);
    });
  });
}