import { DecorationSet, Decoration } from "prosemirror-view";
import { notesFromDoc } from "./StateUtils";

const noteWrapper = (id, pos, side, inside) => {
  const span = document.createElement("span");
  span.classList.add(`note-${id}`, `note--${side < 0 ? "start" : "end"}`);
  return Decoration.widget(pos, span, {
    side: inside ? side : 0 - side,
    marks: []
  });
};

export const createDecorateNotes = (markType, noteTransaction) => ({ doc }) =>
  DecorationSet.create(
    doc,
    notesFromDoc(doc, markType).reduce(
      (out, { id, nodes }) => [
        ...out,
        noteWrapper(id, nodes[0].start, -1, noteTransaction.inside),
        noteWrapper(id, nodes[nodes.length - 1].end, 1, noteTransaction.inside)
      ],
      []
    )
  );
