import { hyphenatePascal } from "./StringUtils";

// Coerce trues
const attToVal = att => (att === "true" ? true : att);

export const removeUndefinedValues = obj =>
  Object.keys(obj).reduce((acc, key) => {
    const val = obj[key];
    return typeof val === "undefined"
      ? acc
      : Object.assign(acc, {
          [key]: val
        });
  }, {});

const noteToAttrs = (id, meta, attrGenerator = () => {}) => {
  const classes = ["note"]; // allow classes to be added by all
  const generatedAttrs = attrGenerator(meta) || {};
  const attrs = removeUndefinedValues(generatedAttrs);

  if (attrs.class) {
    classes.push(attrs.class);
  }

  return Object.assign(
    {},
    attrs,
    Object.keys(meta)
      .filter(key => meta[key] !== false) // remove specials
      .reduce(
        (out, key) =>
          Object.assign({}, out, {
            [`data-${hyphenatePascal(key)}`]: meta[key]
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

export const createNoteMark = (_typeTagMap, attrGenerator = () => {}) => {
  const typeTagMap = filterTagTypeMap(_typeTagMap);
  const values = Object.keys(typeTagMap).map(key => typeTagMap[key]);
  if (values.length !== new Set(values).size) {
    throw new Error(
      "[prosemirror-noting]: type tags: element types must be unique"
    );
  }
  return {
    attrs: {
      id: {},
      meta: {
        default: {}
      }
    },
    inclusive: false,
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
      typeTagMap[meta.type],
      noteToAttrs(id, meta, attrGenerator)
    ]
  };
};
