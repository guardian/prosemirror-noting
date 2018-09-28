import noop from 'lodash/noop';

export function runWithCancel<T>(fn: (...args: any[]) => IterableIterator<T>, ...args: any[]) {
  const gen = fn(...args);
  let cancelled = false;
  let cancel = noop;
  const promise = new Promise((resolve, reject) => {
    // We define a cancel function to return it from our function.
    cancel = () => {
      cancelled = true;
      reject({ reason: "cancelled" });
    };

    function onFulfilled(res?: T) {
      if (!cancelled) {
        let result;
        try {
          result = gen.next(res);
        } catch (e) {
          return reject(e);
        }
        next(result);
        return null;
      }
    }

    onFulfilled();

    function onRejected(err: string) {
      var result;
      try {
        result = gen.throw!(err);
      } catch (e) {
        return reject(e);
      }
      next(result);
    }

    function next({ done, value }: any) {
      if (done) {
        return resolve(value);
      }
      // we assume we always receive promises, so no type checks
      return onFulfilled(value);
    }
  });

  return { promise, cancel };
}
