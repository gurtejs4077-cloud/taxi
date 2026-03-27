import { auth, db } from "./auth.js";
import { 
  doc, collection, query, where, onSnapshot, updateDoc, serverTimestamp, getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

let currentDriverId = null;
let rideListenerUnsubscribe = null;
const shownRideIds = new Set();

/**
 * Initialize Driver after Auth
 */
export async function initDriver(driverId) {
  currentDriverId = driverId;
  
  // Set status to available
  await updateDoc(doc(db, "drivers", currentDriverId), {
    status: "available",
    lastUpdated: serverTimestamp()
  });

  startGPSTracking();
  startRideListener();
}

/**
 * Real-time Ride Listener
 */
function startRideListener() {
  if (rideListenerUnsubscribe) rideListenerUnsubscribe();

  const q = query(
    collection(db, "rides"),
    where("driverId", "==", currentDriverId),
    where("status", "==", "assigned")
  );

  rideListenerUnsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === "added" || change.type === "modified") {
        const rideId = change.doc.id;
        const ride = change.doc.data();

        if (ride.status === "assigned" && !shownRideIds.has(rideId)) {
          shownRideIds.add(rideId);
          showRidePopup(rideId, ride); // This triggers the UI popup
        }
      }
    });
  });
}

/**
 * Handle Accept/Reject
 */
export async function handleRideAction(rideId, action) {
  const rideRef = doc(db, "rides", rideId);
  if (action === "accept") {
    await updateDoc(rideRef, { status: "ongoing" });
    await updateDoc(doc(db, "drivers", currentDriverId), { status: "busy" });
    document.getElementById("active-ride-card").classList.add("visible");
  } else {
    await updateDoc(rideRef, { status: "pending", driverId: null });
    shownRideIds.delete(rideId);
  }
}

/**
 * Finish Ride & Move to History
 */
export async function completeRide(rideId) {
  await updateDoc(doc(db, "rides", rideId), { 
    status: "completed",
    completedAt: serverTimestamp() 
  });
  await updateDoc(doc(db, "drivers", currentDriverId), { status: "available" });
  document.getElementById("active-ride-card").classList.remove("visible");
  alert("Ride Finished!");
}
