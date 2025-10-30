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
  const propertyStores = new Map;
  const createPropertyStore = (key, value) => {
    if (typeof value === "function") {
      throw new Error(`Functions are not allowed as store property values (property: ${String(key)})`);
    }
    if (isObjectOfType(value, "Object")) {
      return store(value);
    } else {
      return state(value);
    }
  };
  for (const [key, value] of Object.entries(initialValue)) {
    propertyStores.set(key, createPropertyStore(key, value));
  }
  const proxy = new Proxy({}, {
    get(_target, prop) {
      if (prop === Symbol.toStringTag)
        return TYPE_STORE;
      if (prop === "get") {
        return () => {
          subscribe(watchers);
          const result = {};
          for (const [key, store2] of propertyStores) {
            result[key] = store2.get();
          }
          return result;
        };
      }
      if (prop === "has") {
        return (key) => {
          return propertyStores.has(key);
        };
      }
      if (prop === "add") {
        return (key, value) => {
          if (propertyStores.has(key)) {
            throw new Error(`Property '${key}' already exists`);
          }
          const newStore = createPropertyStore(key, value);
          propertyStores.set(key, newStore);
          notify(watchers);
          return proxy;
        };
      }
      if (prop === "delete") {
        return (key) => {
          if (!propertyStores.has(key)) {
            throw new Error(`Property '${key}' does not exist`);
          }
          const childStore = propertyStores.get(key);
          if (isState(childStore)) {
            childStore.set(UNSET);
          }
          propertyStores.delete(key);
          notify(watchers);
          return proxy;
        };
      }
      if (propertyStores.has(prop)) {
        return propertyStores.get(prop);
      }
      throw new Error(`Property '${String(prop)}' does not exist on store`);
    },
    has(_target, prop) {
      return propertyStores.has(prop) || prop === "get" || prop === "has" || prop === "add" || prop === "delete" || prop === Symbol.toStringTag;
    },
    ownKeys(_target) {
      return Array.from(propertyStores.keys());
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (this.has?.(_target, prop)) {
        return {
          enumerable: true,
          configurable: true
        };
      }
      return;
    }
  });
  return proxy;
};
var isStore = (value) => isObjectOfType(value, TYPE_STORE);

// src/signal.ts
var UNSET = Symbol();
var isSignal = (value) => isState(value) || isComputed(value) || isStore(value);
var toSignal = (value) => isSignal(value) ? value : isComputedCallback(value) ? computed(value) : isObjectOfType(value, "Object") ? store(value) : state(value);

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
