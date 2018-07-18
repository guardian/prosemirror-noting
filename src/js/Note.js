import { cloneDeep } from "./utils/helpers";

/*
 * NOTE: All ends for ranges are EXCLUSIVE
 */

const clamp = (num, min, max) => Math.max(Math.min(num, max), min);

export default class Note {
  constructor(start, end, id, meta = {}) {
    this.start = start;
    this.end = end;
    this.id = id;
    this.meta = meta;
  }

  /*
    * Writes
    */

  mapPositions(startFunc, endFunc = startFunc) {
    return new Note(
      startFunc(this.start, this.id),
      endFunc(this.end, this.id),
      this.id,
      cloneDeep(this.meta)
    );
  }

  updateMeta(meta) {
    this.meta = Object.assign({}, this.meta, meta);
  }

  /*
    * Reads
    */

  rangesAround(from, to) {
    const { start, end } = this;

    return [
      {
        start,
        end: clamp(from, start, end)
      },
      {
        start: clamp(to, start, end),
        end
      }
    ];
  }

  containsPosition(pos, inside = false) {
    return this.coversRange(pos, pos, inside);
  }

  // End is exclusive
  coversRange(from, to, inside = false) {
    return inside
      ? this.start <= from && this.end >= to
      : this.start < from && this.end > to;
  }

  // End is exclusive
  touchesRange(from, to) {
    return this.start <= to && this.end >= from;
  }

  eq({ start, end }) {
    return this.start === start && this.end === end;
  }

  get isEmpty() {
    return this.start >= this.end;
  }
}
