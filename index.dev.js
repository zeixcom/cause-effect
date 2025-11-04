// src/scheduler.ts
var active;
var pending = new Set;
var batchDepth = 0;
var updateMap = new Map;
var requestId;
var updateDOM = () => {
  requestId = undefined;
  const updates = Array.from(updateMap.values());
  updateMap.clear();
  for (const update of updates) {
    update();
  }
};
var requestTick = () => {
  if (requestId)
    cancelAnimationFrame(requestId);
  requestId = requestAnimationFrame(updateDOM);
};
queueMicrotask(updateDOM);
var watch = (notice) => {
  const cleanups = new Set;
  const w = notice;
  w.off = (on) => {
    cleanups.add(on);
  };
  w.cleanup = () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.clear();
  };
  return w;
};
var subscribe = (watchers) => {
  if (active && !watchers.has(active)) {
    const watcher = active;
    watchers.add(watcher);
    active.off(() => {
      watchers.delete(watcher);
    });
  }
};
var notify = (watchers) => {
  for (const watcher of watchers) {
    if (batchDepth)
      pending.add(watcher);
    else
      watcher();
  }
};
var flush = () => {
  while (pending.size) {
    const watchers = Array.from(pending);
    pending.clear();
    for (const watcher of watchers) {
      watcher();
    }
  }
};
var batch = (fn) => {
  batchDepth++;
  try {
    fn();
  } finally {
    flush();
    batchDepth--;
  }
};
var observe = (run, watcher) => {
  const prev = active;
  active = watcher;
  try {
    run();
  } finally {
    active = prev;
  }
};
var enqueue = (fn, dedupe) => new Promise((resolve, reject) => {
  updateMap.set(dedupe || Symbol(), () => {
    try {
      resolve(fn());
    } catch (error) {
      reject(error);
    }
  });
  requestTick();
});

// src/util.ts
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var arrayToRecord = (array) => {
  const record = {};
  for (let i = 0;i < array.length; i++) {
    if (i in array)
      record[String(i)] = array[i];
  }
  return record;
};
var hasMethod = (obj, methodName) => (methodName in obj) && isFunction(obj[methodName]);
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));

class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency in ${where} detected`);
    this.name = "CircularDependencyError";
  }
}

// src/state.ts
var TYPE_STATE = "State";
var state = (initialValue) => {
  const watchers = new Set;
  let value = initialValue;
  const s = {
    [Symbol.toStringTag]: TYPE_STATE,
    get: () => {
      subscribe(watchers);
      return value;
    },
    set: (v) => {
      if (isEqual(value, v))
        return;
      value = v;
      notify(watchers);
      if (UNSET === value)
        watchers.clear();
    },
    update: (fn) => {
      s.set(fn(value));
    }
  };
  return s;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/effect.ts
var effect = (callback) => {
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const run = watch(() => observe(() => {
    if (running)
      throw new CircularDependencyError("effect");
    running = true;
    controller?.abort();
    controller = undefined;
    let cleanup;
    try {
      if (isAsync) {
        controller = new AbortController;
        const currentController = controller;
        callback(controller.signal).then((cleanup2) => {
          if (isFunction(cleanup2) && controller === currentController)
            run.off(cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          run.off(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Effect callback error:", error);
    }
    running = false;
  }, run));
  run();
  return () => {
    controller?.abort();
    run.cleanup();
  };
};

// src/store.ts
var TYPE_STORE = "Store";
var store = (initialValue) => {
  const watchers = new Set;
  const eventTarget = new EventTarget;
  const signals = new Map;
  const cleanups = new Map;
  const size = state(0);
  const current = () => {
    const record = {};
    for (const [key, value] of signals) {
      record[key] = value.get();
    }
    return record;
  };
  const emit = (type, detail) => eventTarget.dispatchEvent(new CustomEvent(type, { detail }));
  const addSignalAndEffect = (key, value) => {
    const signal = toMutableSignal(value);
    signals.set(key, signal);
    const cleanup = effect(() => {
      const value2 = signal.get();
      if (value2 != null)
        emit("store-change", { [key]: value2 });
    });
    cleanups.set(key, cleanup);
  };
  const removeSignalAndEffect = (key) => {
    signals.delete(key);
    const cleanup = cleanups.get(key);
    if (cleanup)
      cleanup();
    cleanups.delete(key);
  };
  const reconcile = (oldValue, newValue) => {
    const changes = diff(oldValue, newValue);
    batch(() => {
      if (Object.keys(changes.add).length) {
        for (const key in changes.add) {
          const value = changes.add[key];
          if (value != null)
            addSignalAndEffect(key, value);
        }
        emit("store-add", changes.add);
      }
      if (Object.keys(changes.change).length) {
        for (const key in changes.change) {
          const signal = signals.get(key);
          const value = changes.change[key];
          if (signal && value != null && hasMethod(signal, "set"))
            signal.set(value);
        }
        emit("store-change", changes.change);
      }
      if (Object.keys(changes.remove).length) {
        for (const key in changes.remove) {
          removeSignalAndEffect(key);
        }
        emit("store-remove", changes.remove);
      }
      size.set(signals.size);
    });
    return changes.changed;
  };
  reconcile({}, initialValue);
  setTimeout(() => {
    const initialAdditionsEvent = new CustomEvent("store-add", {
      detail: initialValue
    });
    eventTarget.dispatchEvent(initialAdditionsEvent);
  }, 0);
  const storeProps = [
    "add",
    "get",
    "remove",
    "set",
    "update",
    "addEventListener",
    "removeEventListener",
    "dispatchEvent",
    "size"
  ];
  return new Proxy({}, {
    get(_target, prop) {
      switch (prop) {
        case "add":
          return (k, v) => {
            if (!signals.has(k)) {
              addSignalAndEffect(k, v);
              notify(watchers);
              emit("store-add", {
                [k]: v
              });
              size.set(signals.size);
            }
          };
        case "get":
          return () => {
            subscribe(watchers);
            return current();
          };
        case "remove":
          return (k) => {
            if (signals.has(k)) {
              removeSignalAndEffect(k);
              notify(watchers);
              emit("store-remove", { [k]: UNSET });
              size.set(signals.size);
            }
          };
        case "set":
          return (v) => {
            if (reconcile(current(), v)) {
              notify(watchers);
              if (UNSET === v)
                watchers.clear();
            }
          };
        case "update":
          return (fn) => {
            const oldValue = current();
            const newValue = fn(oldValue);
            if (reconcile(oldValue, newValue)) {
              notify(watchers);
              if (UNSET === newValue)
                watchers.clear();
            }
          };
        case "addEventListener":
          return eventTarget.addEventListener.bind(eventTarget);
        case "removeEventListener":
          return eventTarget.removeEventListener.bind(eventTarget);
        case "dispatchEvent":
          return eventTarget.dispatchEvent.bind(eventTarget);
        case "size":
          return size;
      }
      if (prop === Symbol.toStringTag)
        return TYPE_STORE;
      if (prop === Symbol.iterator) {
        return function* () {
          for (const [key, signal] of signals) {
            yield [key, signal];
          }
        };
      }
      return signals.get(String(prop));
    },
    has(_target, prop) {
      const key = String(prop);
      return signals.has(key) || storeProps.includes(key) || prop === Symbol.toStringTag || prop === Symbol.iterator;
    },
    ownKeys() {
      return Array.from(signals.keys());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const signal = signals.get(String(prop));
      return signal ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: signal
      } : undefined;
    }
  });
};
var isStore = (value) => isObjectOfType(value, TYPE_STORE);

// src/signal.ts
var UNSET = Symbol();
var isSignal = (value) => isState(value) || isComputed(value) || isStore(value);
function toSignal(value) {
  if (isSignal(value))
    return value;
  if (isComputedCallback(value))
    return computed(value);
  if (Array.isArray(value))
    return store(arrayToRecord(value));
  if (isRecord(value))
    return store(value);
  return state(value);
}
function toMutableSignal(value) {
  if (isState(value) || isStore(value))
    return value;
  if (Array.isArray(value))
    return store(arrayToRecord(value));
  if (isRecord(value))
    return store(value);
  return state(value);
}

// src/diff.ts
var isEqual = (a, b, visited) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (typeof a !== "object" || a === null || b === null)
    return false;
  if (!visited)
    visited = new WeakSet;
  if (visited.has(a) || visited.has(b))
    throw new CircularDependencyError("isEqual");
  visited.add(a);
  visited.add(b);
  try {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0;i < a.length; i++) {
        if (!isEqual(a[i], b[i], visited))
          return false;
      }
      return true;
    }
    if (Array.isArray(a) !== Array.isArray(b))
      return false;
    if (isRecord(a) && isRecord(b)) {
      const aKeys = Object.keys(a);
      const bKeys = Object.keys(b);
      if (aKeys.length !== bKeys.length)
        return false;
      for (const key of aKeys) {
        if (!(key in b))
          return false;
        if (!isEqual(a[key], b[key], visited))
          return false;
      }
      return true;
    }
    return false;
  } finally {
    visited.delete(a);
    visited.delete(b);
  }
};
var diff = (oldObj, newObj) => {
  const visited = new WeakSet;
  const diffRecords = (oldRecord, newRecord) => {
    const add = {};
    const change = {};
    const remove = {};
    const oldKeys = Object.keys(oldRecord);
    const newKeys = Object.keys(newRecord);
    const allKeys = new Set([...oldKeys, ...newKeys]);
    for (const key of allKeys) {
      const oldHas = key in oldRecord;
      const newHas = key in newRecord;
      if (!oldHas && newHas) {
        add[key] = newRecord[key];
        continue;
      } else if (oldHas && !newHas) {
        remove[key] = UNSET;
        continue;
      }
      const oldValue = oldRecord[key];
      const newValue = newRecord[key];
      if (!isEqual(oldValue, newValue, visited))
        change[key] = newValue;
    }
    const changed = Object.keys(add).length > 0 || Object.keys(change).length > 0 || Object.keys(remove).length > 0;
    return {
      changed,
      add,
      change,
      remove
    };
  };
  return diffRecords(oldObj, newObj);
};

// src/computed.ts
var TYPE_COMPUTED = "Computed";
var computed = (fn) => {
  const watchers = new Set;
  let value = UNSET;
  let error;
  let controller;
  let dirty = true;
  let changed = false;
  let computing = false;
  const ok = (v) => {
    if (!isEqual(v, value)) {
      value = v;
      changed = true;
    }
    error = undefined;
    dirty = false;
  };
  const nil = () => {
    changed = UNSET !== value;
    value = UNSET;
    error = undefined;
  };
  const err = (e) => {
    const newError = toError(e);
    changed = !error || newError.name !== error.name || newError.message !== error.message;
    value = UNSET;
    error = newError;
  };
  const settle = (settleFn) => (arg) => {
    computing = false;
    controller = undefined;
    settleFn(arg);
    if (changed)
      notify(watchers);
  };
  const mark = watch(() => {
    dirty = true;
    controller?.abort();
    if (watchers.size)
      notify(watchers);
    else
      mark.cleanup();
  });
  mark.off(() => {
    controller?.abort();
  });
  const compute = () => observe(() => {
    if (computing)
      throw new CircularDependencyError("computed");
    changed = false;
    if (isAsyncFunction(fn)) {
      if (controller)
        return value;
      controller = new AbortController;
      controller.signal.addEventListener("abort", () => {
        computing = false;
        controller = undefined;
        compute();
      }, {
        once: true
      });
    }
    let result;
    computing = true;
    try {
      result = controller ? fn(controller.signal) : fn();
    } catch (e) {
      if (isAbortError(e))
        nil();
      else
        err(e);
      computing = false;
      return;
    }
    if (result instanceof Promise)
      result.then(settle(ok), settle(err));
    else if (result == null || UNSET === result)
      nil();
    else
      ok(result);
    computing = false;
  }, mark);
  const c = {
    [Symbol.toStringTag]: TYPE_COMPUTED,
    get: () => {
      subscribe(watchers);
      flush();
      if (dirty)
        compute();
      if (error)
        throw error;
      return value;
    }
  };
  return c;
};
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isComputedCallback = (value) => isFunction(value) && value.length < 2;
// src/match.ts
function match(result, handlers) {
  try {
    if (result.pending)
      handlers.nil?.();
    else if (result.errors)
      handlers.err?.(result.errors);
    else
      handlers.ok?.(result.values);
  } catch (error) {
    if (handlers.err && (!result.errors || !result.errors.includes(toError(error))))
      handlers.err(result.errors ? [...result.errors, toError(error)] : [toError(error)]);
    else
      throw error;
  }
}
// src/resolve.ts
function resolve(signals) {
  const errors = [];
  let pending2 = false;
  const values = {};
  for (const [key, signal] of Object.entries(signals)) {
    try {
      const value = signal.get();
      if (value === UNSET)
        pending2 = true;
      else
        values[key] = value;
    } catch (e) {
      errors.push(toError(e));
    }
  }
  if (pending2)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
}
export {
  watch,
  toSignal,
  toMutableSignal,
  toError,
  subscribe,
  store,
  state,
  resolve,
  observe,
  notify,
  match,
  isStore,
  isState,
  isSignal,
  isFunction,
  isEqual,
  isComputedCallback,
  isComputed,
  isAsyncFunction,
  isAbortError,
  flush,
  enqueue,
  effect,
  diff,
  computed,
  batch,
  UNSET,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_COMPUTED,
  CircularDependencyError
};
