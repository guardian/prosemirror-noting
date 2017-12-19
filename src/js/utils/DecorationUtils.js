import { DecorationSet, Decoration } from "prosemirror-view";
import { notesFromDoc } from "./StateUtils";

const noteWrapperClasses = (id, positions) => [
  ...positions.map(pos => `note--${pos}`),
  `note-${id}`
];

const markSpec = (id, positions) => ({
  nodeName: "span",
  class: noteWrapperClasses(id, positions).join(" ")
});

const noteWrapper = (id, { start, end }, ...positions) =>
  Decoration.inline(start, end, markSpec(id, positions));

export const createDecorateNotes = markType => ({ doc }) =>
  DecorationSet.create(
    doc,
    notesFromDoc(doc, markType).reduce(
      (out, { id, nodes }) => [
        ...out,
        ...nodes.map((node, i) => {
          if (nodes.length === 1) {
            return noteWrapper(id, node, "start", "end");
          } else if (i === 0) {
            return noteWrapper(id, node, "start");
          } else if (i === nodes.length - 1) {
            return noteWrapper(id, node, "end");
          }
          return noteWrapper(id, node, "inner");
        })
      ],
      []
    )
  );
