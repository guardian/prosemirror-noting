export const hyphenatePascal = str =>
  str
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]{2})[a-z]/, "$1-")
    .toLowerCase();
