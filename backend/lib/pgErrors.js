export function friendlyPgError(err) {
  if (err && err.code === "23505") {
    return { status: 409, message: "This role is already filled for the selected branch." };
  }
  return null;
}