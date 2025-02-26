export function getId(idsToAvoid = new Set()) {
  let id;
  while (id == null || idsToAvoid.has(id)) {
    id = quickRandomId();
  }
  return id;
}
function quickRandomId(length = 8) {
  return Math.random().toString(36).substring(2, 2 + length);
}
