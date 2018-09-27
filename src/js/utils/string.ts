/**
 * From a string, get a range from the given index that looks
 * outward for the given number of words.
 */
export const getExpandedRange = (index: number, str: string, noOfWords = 1) => {
  const lastIndex = str.length - 1;
  const from =
    index === 0
      ? 0
      : getPositionOfNthWord(str.slice(0, index), noOfWords, false);
  const to =
    index >= lastIndex
      ? lastIndex
      : getPositionOfNthWord(str.slice(index), noOfWords) + index;
  return {
    from,
    to,
    diffFrom: from - index,
    diffTo: to - index
  };
};

export const getPositionOfNthWord = (
  str: String,
  noOfWords: number,
  forward = true
) => {
  let words = forward ? str.split(" ") : str.split(" ").reverse();
  let offset = -1;
  // Ignore leading spaces
  if (words[0] === "") {
    words = words.slice(1, words.length - 1);
    offset++;
  }
  for (let i = 0; i <= noOfWords && i <= words.length - 1; i++) {
    offset += words[i].length + 1;
  }
  return forward ? offset : str.length - offset;
};

export const isString = (str: any) => {
  return typeof str === "string" || str instanceof String;
};

export function uuid(
  a: number // placeholder
): string {
  return a // if the placeholder was passed, return
    ? // a random number from 0 to 15
      (
        a ^ // unless b is 8,
        ((Math.random() * // in which case
          16) >> // a random number from
          (a / 4))
      ) // 8 to 11
        .toString(16) // in hexadecimal
    : // or otherwise a concatenated string:
      (
        String(1e7) + // 10000000 +
        String(-1e3) + // -1000 +
        String(-4e3) + // -4000 +
        String(-8e3) + // -80000000 +
        String(-1e11)
      ) // -100000000000,
        .replace(
          // replacing
          /[018]/g, // zeroes, ones, and eights with
          uuid.toString() // random hex digits
        );
}
