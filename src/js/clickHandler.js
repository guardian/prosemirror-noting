import { setNoteMeta } from "./index";

const clickHandler = ({ dispatch, state }, pos, { target }) => {
  const { toggleNoteId } = target.dataset || {};
  const el = document.querySelector(`[data-note-id=${toggleNoteId}]`);
  if (el) {
    // TODO remove from the package
    const toggleTypes = ["flag", "correct"];
    const toggleIndex = toggleTypes.indexOf(el.dataset.type);
    if (toggleIndex > -1) {
      setNoteMeta(el.dataset.noteId, {
        type: toggleTypes[1 - toggleIndex]
      })(state, dispatch);
    } else {
      setNoteMeta(el.dataset.noteId, {
        hidden: !el.dataset.hidden
      })(state, dispatch);
    }
  }
  return true;
};

export default clickHandler;
