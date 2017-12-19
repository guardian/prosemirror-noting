export const closest = ({ parentNode }, predicate, topNode = null) =>
  parentNode && parentNode !== topNode
    ? predicate(parentNode)
      ? parentNode
      : closest(parentNode, predicate, topNode)
    : false;
