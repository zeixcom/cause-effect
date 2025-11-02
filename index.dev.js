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
var isPrimitive = (value) => !isObjectOfType(value, "Object") && !Array.isArray(value) && !isFunction(value);
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
      if (Object.is(value, v))
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

// src/store.ts
var TYPE_STORE = "Store";
var store = (initialValue) => {
  const watchers = new Set;
  const data = new Map;
  const tracker = (watcher) => {
    const trackWatchers = new Set;
    if (watcher)
      trackWatchers.add(watcher);
    let trackRecord = {};
    return {
      get: () => {
        subscribe(trackWatchers);
        const value = { ...trackRecord };
        trackRecord = {};
        return value;
      },
      merge: (other) => {
        trackRecord = { ...trackRecord, ...other };
        notify(trackWatchers);
      }
    };
  };
  const additions = tracker();
  const track = watch(() => {
    const newKeys = Object.keys(additions.get());
    console.log("Additions watcher called", newKeys);
    for (const key of newKeys) {
      data.get(key);
    }
  });
  const mutations = tracker(track);
  const removals = tracker();
  const size = state(0);
  const current = () => {
    const record = {};
    for (const [key, value] of data) {
      record[key] = value.get();
    }
    return record;
  };
  const reconcile = (oldValue, newValue) => {
    const oldKeys = new Set(Object.keys(oldValue));
    const newKeys = new Set(Object.keys(newValue));
    const allKeys = new Set([...oldKeys, ...newKeys]);
    const changes = {
      additions: {},
      mutations: {},
      removals: {}
    };
    for (const key of allKeys) {
      const oldHas = oldKeys.has(key);
      const newHas = newKeys.has(key);
      const value = newValue[key];
      if (oldHas && !newHas) {
        data.delete(key);
        changes.removals[key] = UNSET;
      } else if (!oldHas && newHas) {
        const signal = toMutableSignal(value);
        data.set(key, signal);
        changes.additions[key] = value;
      } else {
        console.log(key, oldValue[key], value);
        const signal = data.get(key);
        if (isState(signal) && isPrimitive(value) || isStore(signal) && (isObjectOfType(value, "Object") || Array.isArray(value))) {
          signal.set(value);
        } else {
          if (signal && hasMethod(signal, "set"))
            signal.set(UNSET);
          data.set(key, toMutableSignal(value));
        }
        changes.mutations[key] = value;
      }
    }
    const hasAdditions = Object.keys(changes.additions).length > 0;
    const hasMutations = Object.keys(changes.mutations).length > 0;
    const hasRemovals = Object.keys(changes.removals).length > 0;
    if (hasAdditions)
      additions.merge(changes.additions);
    if (hasMutations)
      mutations.merge(changes.mutations);
    if (hasRemovals)
      removals.merge(changes.removals);
    size.set(data.size);
    return hasAdditions || hasMutations || hasRemovals;
  };
  reconcile({}, initialValue);
  return new Proxy({}, {
    get(_target, prop) {
      const key = String(prop);
      if (prop === Symbol.toStringTag)
        return TYPE_STORE;
      if (prop === Symbol.iterator) {
        return function* () {
          for (const [key2, signal] of data) {
            yield [key2, signal];
          }
        };
      }
      if (prop === "get") {
        return () => {
          subscribe(watchers);
          return current();
        };
      }
      if (prop === "set") {
        return (v) => {
          if (reconcile(current(), v)) {
            notify(watchers);
            if (UNSET === v)
              watchers.clear();
          }
        };
      }
      if (prop === "update") {
        return (fn) => {
          const oldValue = current();
          const newValue = fn(oldValue);
          if (reconcile(oldValue, newValue)) {
            notify(watchers);
            if (UNSET === newValue)
              watchers.clear();
          }
        };
      }
      if (prop === "additions")
        return additions;
      if (prop === "mutations")
        return mutations;
      if (prop === "removals")
        return removals;
      if (prop === "size")
        return size;
      return data.get(key);
    },
    has(_target, prop) {
      const key = String(prop);
      return data.has(key) || prop === "get" || prop === "set" || prop === "update" || prop === "additions" || prop === "mutations" || prop === "removals" || prop === "size" || prop === Symbol.toStringTag || prop === Symbol.iterator;
    },
    ownKeys() {
      return Array.from(data.keys());
    },
    getOwnPropertyDescriptor(_target, prop) {
      const signal = data.get(String(prop));
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
  if (Array.isArray(value)) {
    const record = {};
    for (let i = 0;i < value.length; i++) {
      record[String(i)] = value[i];
    }
    return store(record);
  }
  if (isObjectOfType(value, "Object"))
    return store(value);
  return state(value);
}
function toMutableSignal(value) {
  if (isSignal(value))
    return value;
  if (isComputedCallback(value))
    return computed(value);
  if (Array.isArray(value)) {
    const record = {};
    for (let i = 0;i < value.length; i++) {
      record[String(i)] = value[i];
    }
    return store(record);
  }
  if (isObjectOfType(value, "Object"))
    return store(value);
  return state(value);
}

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
    if (!Object.is(v, value)) {
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
          if (isFunction(cleanup2) && controller === currentController) {
            run.off(cleanup2);
          }
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
// src/match.ts
function match(result, handlers) {
  try {
    if (result.pending) {
      handlers.nil?.();
    } else if (result.errors) {
      handlers.err?.(result.errors);
    } else {
      handlers.ok?.(result.values);
    }
  } catch (error) {
    if (handlers.err && (!result.errors || !result.errors.includes(toError(error)))) {
      const allErrors = result.errors ? [...result.errors, toError(error)] : [toError(error)];
      handlers.err(allErrors);
    } else {
      throw error;
    }
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
      if (value === UNSET) {
        pending2 = true;
      } else {
        values[key] = value;
      }
    } catch (e) {
      errors.push(toError(e));
    }
  }
  if (pending2) {
    return { ok: false, pending: true };
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, values };
}
export {
  watch,
  toSignal,
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
  isComputedCallback,
  isComputed,
  isAsyncFunction,
  isAbortError,
  flush,
  enqueue,
  effect,
  computed,
  batch,
  UNSET,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_COMPUTED,
  CircularDependencyError
};
