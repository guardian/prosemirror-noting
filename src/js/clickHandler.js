import { closest } from "./utils/DOMUtils";
import { setNoteMeta } from "./index";

const clickHandler = ({ dispatch, state, dom }, pos, { target }) => {
  const el = closest(
    target,
    node => (node.dataset ? node.dataset.noteId : false),
    dom
  );
  if (el) {
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
