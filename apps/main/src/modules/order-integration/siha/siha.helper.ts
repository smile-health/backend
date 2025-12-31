export function getLabel(object, value) {
  let key = Object.keys(object).find((idx) => object[idx] === value)
  if (key) {
    key = key.replace("_", " ")
  }
  return key
}
