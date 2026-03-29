/**
 * Fields stored on drivers/{uid}: carModel, carSeats, carRegistration (+ name, phone, email, profilePhotoURL).
 * Copied onto rides / ride_requests when a driver is assigned so customers see a stable snapshot.
 */
export function assignmentFieldsFromDriverDoc(driverData, session = {}) {
  const d = driverData || {};
  const sessionName = (session.name && String(session.name).trim()) || "";
  const sessionEmail = session.email || "";
  const sessionPhone = (session.phone && String(session.phone).trim()) || "";
  const nm = sessionName || d.name || "";
  const em = sessionEmail || d.email || "";
  const ph = sessionPhone || d.phone || "";
  return {
    driverName: nm || em || "",
    driverPhone: ph,
    driverPhotoURL: d.profilePhotoURL || "",
    carModel: d.carModel || "",
    carSeats: d.carSeats != null && d.carSeats !== "" ? d.carSeats : "",
    carRegistration: d.carRegistration || "",
  };
}
