// Who counts as an admin on the portal.
// Either the user's role is "admin", or their `you_are` is the special admin code.
// The code can only be assigned in the database / Admin Panel — register and
// profile-update refuse it (see assertCanSetYouAre), so users can't self-promote.

export const ADMIN_YOU_ARE = "admin987";

export const isAdminUser = (user) =>
  user?.role === "admin" || user?.you_are === ADMIN_YOU_ARE;

// Mongo filter matching every admin (either way)
export const adminFilter = { $or: [{ role: "admin" }, { you_are: ADMIN_YOU_ARE }] };

// true if this request may store `nextYouAre` for a user whose current value is `currentYouAre`
export const canSetYouAre = (nextYouAre, currentYouAre) => {
  if (typeof nextYouAre !== "string") return true;
  if (nextYouAre.trim().toLowerCase() !== ADMIN_YOU_ARE) return true;
  // keeping an already-assigned code (e.g. re-saving the settings form) is fine
  return currentYouAre === ADMIN_YOU_ARE && nextYouAre === ADMIN_YOU_ARE;
};
