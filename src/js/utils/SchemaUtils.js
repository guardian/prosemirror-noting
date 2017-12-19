import { hyphenatePascal } from "./StringUtils";

// Helps type coercion
const valToAtt = val => JSON.stringify(val);
const attToVal = att => JSON.parse(att);

const noteToAttrs = (id, meta, attrGenerator = () => {}) => {
  const classes = ["note"]; // allow classes to be added by all
  const generatedMeta = attrGenerator(meta) || {};

  if (generatedMeta.class) {
    classes.push(generatedMeta.class);
  }

  return Object.assign(
    {},
    generatedMeta,
    Object.keys(meta)
      .filter(key => meta[key] !== false) // remove specials
      .reduce(
        (out, key) =>
          Object.assign({}, out, {
            [`data-${hyphenatePascal(key)}`]: valToAtt(meta[key])
          }),
        {}
      ),
    {
      class: classes.join(" "),
      "data-note-id": id
    }
  );
};

const datasetToAttrs = (dataset, defaults = {}) => ({
  id: dataset.noteId || false,
  meta: Object.keys(dataset)
    .filter(key => key !== "noteId" && dataset[key] !== "false") // remove special or falses
    .reduce(
      (out, key) =>
        Object.assign({}, out, {
          [key]: attToVal(dataset[key]) || defaults[key]
        }),
      {}
    )
});

const filterTagTypeMap = tagTypeMap =>
  typeof tagTypeMap === "string" ? { note: tagTypeMap } : tagTypeMap;

export const createNoteMark = (typeTagMap, attrGenerator = () => {}) => ({
  attrs: {
    id: {},
    meta: {
      default: {}
    }
  },
  // Create a rule for every type
  parseDOM: Object.keys(typeTagMap).map(type => ({
    tag: typeTagMap[type],
    getAttrs: ({ dataset }) => {
      const attrs = datasetToAttrs(dataset);

      return Object.assign({}, attrs, {
        meta: Object.assign({}, attrs.meta, {
          type
        })
      });
    }
  })),
  // Spit out the node based on the type
  toDOM: ({ attrs: { id, meta } }) => [
    typeTagMap[meta.type] || fallbackType,
    noteToAttrs(id, meta, attrGenerator)
  ]
});
