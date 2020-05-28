// This might need improving, pretty thing implementation but for now it will
// suffice
export const cloneDeep = val => {
  if (val instanceof Array) {
    return val.map(cloneDeep);
  } else if (val instanceof Object) {
    return [...Object.getOwnPropertySymbols(val), ...Object.keys(val)].reduce(
      (out, key) =>
        Object.assign({}, out, {
          [key]: cloneDeep(val[key])
        }),
      {}
    );
  }
  return val;
};
