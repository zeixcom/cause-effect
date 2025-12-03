// src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency detected in ${where}`);
    this.name = "CircularDependencyError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} callback ${value}`);
    this.name = "InvalidCallbackError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`Invalid signal value ${value} in ${where}`);
    this.name = "InvalidSignalValueError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`Nullish signal values are not allowed in ${where}`);
    this.name = "NullishSignalValueError";
  }
}

class StoreKeyExistsError extends Error {
  constructor(key, value) {
    super(`Could not add store key "${key}" with value ${value} because it already exists`);
    this.name = "StoreKeyExistsError";
  }
}

class StoreKeyRangeError extends RangeError {
  constructor(index) {
    super(`Could not remove store index ${String(index)} because it is out of range`);
    this.name = "StoreKeyRangeError";
  }
}

class StoreKeyReadonlyError extends Error {
  constructor(key, value) {
    super(`Could not set store key "${key}" to ${value} because it is readonly`);
    this.name = "StoreKeyReadonlyError";
  }
}

// src/util.ts
var UNSET = Symbol();
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);
var validArrayIndexes = (keys) => {
  if (!keys.length)
    return null;
  const indexes = keys.map((k) => isString(k) ? parseInt(k, 10) : isNumber(k) ? k : NaN);
  return indexes.every((index) => Number.isFinite(index) && index >= 0) ? indexes.sort((a, b) => a - b) : null;
};
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));
var recordToArray = (record) => {
  const indexes = validArrayIndexes(Object.keys(record));
  if (indexes === null)
    return record;
  const array = [];
  for (const index of indexes)
    array.push(record[String(index)]);
  return array;
};
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

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
  const oldValid = isRecordOrArray(oldObj);
  const newValid = isRecordOrArray(newObj);
  if (!oldValid || !newValid) {
    const changed2 = !Object.is(oldObj, newObj);
    return {
      changed: changed2,
      add: changed2 && newValid ? newObj : {},
      change: {},
      remove: changed2 && oldValid ? oldObj : {}
    };
  }
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  const oldKeys = Object.keys(oldObj);
  const newKeys = Object.keys(newObj);
  const allKeys = new Set([...oldKeys, ...newKeys]);
  for (const key of allKeys) {
    const oldHas = key in oldObj;
    const newHas = key in newObj;
    if (!oldHas && newHas) {
      add[key] = newObj[key];
      continue;
    } else if (oldHas && !newHas) {
      remove[key] = UNSET;
      continue;
    }
    const oldValue = oldObj[key];
    const newValue = newObj[key];
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

// src/system.ts
var activeWatcher;
var pendingWatchers = new Set;
var batchDepth = 0;
var createWatcher = (watch) => {
  const cleanups = new Set;
  const w = watch;
  w.unwatch = (cleanup) => {
    cleanups.add(cleanup);
  };
  w.cleanup = () => {
    for (const cleanup of cleanups)
      cleanup();
    cleanups.clear();
  };
  return w;
};
var subscribe = (watchers) => {
  if (activeWatcher && !watchers.has(activeWatcher)) {
    const watcher = activeWatcher;
    watcher.unwatch(() => {
      watchers.delete(watcher);
    });
    watchers.add(watcher);
  }
};
var notify = (watchers) => {
  for (const watcher of watchers) {
    if (batchDepth)
      pendingWatchers.add(watcher);
    else
      watcher();
  }
};
var flush = () => {
  while (pendingWatchers.size) {
    const watchers = Array.from(pendingWatchers);
    pendingWatchers.clear();
    for (const watcher of watchers)
      watcher();
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
  const prev = activeWatcher;
  activeWatcher = watcher;
  try {
    run();
  } finally {
    activeWatcher = prev;
  }
};

// src/computed.ts
var TYPE_COMPUTED = "Computed";
var createComputed = (callback, initialValue = UNSET) => {
  if (!isComputedCallback(callback))
    throw new InvalidCallbackError("computed", valueString(callback));
  if (initialValue == null)
    throw new NullishSignalValueError("computed");
  const watchers = new Set;
  let value = initialValue;
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
  const settle = (fn) => (arg) => {
    computing = false;
    controller = undefined;
    fn(arg);
    if (changed)
      notify(watchers);
  };
  const watcher = createWatcher(() => {
    dirty = true;
    controller?.abort();
    if (watchers.size)
      notify(watchers);
    else
      watcher.cleanup();
  });
  watcher.unwatch(() => {
    controller?.abort();
  });
  const compute = () => observe(() => {
    if (computing)
      throw new CircularDependencyError("computed");
    changed = false;
    if (isAsyncFunction(callback)) {
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
      result = controller ? callback(value, controller.signal) : callback(value);
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
  }, watcher);
  const computed = {};
  Object.defineProperties(computed, {
    [Symbol.toStringTag]: {
      value: TYPE_COMPUTED
    },
    get: {
      value: () => {
        subscribe(watchers);
        flush();
        if (dirty)
          compute();
        if (error)
          throw error;
        return value;
      }
    }
  });
  return computed;
};
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isComputedCallback = (value) => isFunction(value) && value.length < 3;
// src/effect.ts
var createEffect = (callback) => {
  if (!isFunction(callback) || callback.length > 1)
    throw new InvalidCallbackError("effect", valueString(callback));
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const watcher = createWatcher(() => observe(() => {
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
            watcher.unwatch(cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.unwatch(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Effect callback error:", error);
    }
    running = false;
  }, watcher));
  watcher();
  return () => {
    controller?.abort();
    watcher.cleanup();
  };
};
// src/match.ts
function match(result, handlers) {
  try {
    if (result.pending)
      handlers.nil?.();
    else if (result.errors)
      handlers.err?.(result.errors);
    else if (result.ok)
      handlers.ok(result.values);
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
  let pending = false;
  const values = {};
  for (const [key, signal] of Object.entries(signals)) {
    try {
      const value = signal.get();
      if (value === UNSET)
        pending = true;
      else
        values[key] = value;
    } catch (e) {
      errors.push(toError(e));
    }
  }
  if (pending)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
}
// src/state.ts
var TYPE_STATE = "State";
var createState = (initialValue) => {
  if (initialValue == null)
    throw new NullishSignalValueError("state");
  const watchers = new Set;
  let value = initialValue;
  const setValue = (newValue) => {
    if (newValue == null)
      throw new NullishSignalValueError("state");
    if (isEqual(value, newValue))
      return;
    value = newValue;
    notify(watchers);
    if (UNSET === value)
      watchers.clear();
  };
  const state = {};
  Object.defineProperties(state, {
    [Symbol.toStringTag]: {
      value: TYPE_STATE
    },
    get: {
      value: () => {
        subscribe(watchers);
        return value;
      }
    },
    set: {
      value: (newValue) => {
        setValue(newValue);
      }
    },
    update: {
      value: (updater) => {
        if (!isFunction(updater))
          throw new InvalidCallbackError("state update", valueString(updater));
        setValue(updater(value));
      }
    }
  });
  return state;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/store.ts
var TYPE_STORE = "Store";
var createStore = (initialValue) => {
  if (initialValue == null)
    throw new NullishSignalValueError("store");
  const watchers = new Set;
  const listeners = {
    add: new Set,
    change: new Set,
    remove: new Set,
    sort: new Set
  };
  const signals = new Map;
  const signalWatchers = new Map;
  const isArrayLike = Array.isArray(initialValue);
  const current = () => {
    const record = {};
    for (const [key, signal] of signals)
      record[key] = signal.get();
    return record;
  };
  const emit = (key, changes) => {
    Object.freeze(changes);
    for (const listener of listeners[key])
      listener(changes);
  };
  const getSortedIndexes = () => Array.from(signals.keys()).map((k) => Number(k)).filter((n) => Number.isInteger(n)).sort((a, b) => a - b);
  const isValidValue = (key, value) => {
    if (value == null)
      throw new NullishSignalValueError(`store for key "${key}"`);
    if (value === UNSET)
      return true;
    if (isSymbol(value) || isFunction(value) || isComputed(value))
      throw new InvalidSignalValueError(`store for key "${key}"`, valueString(value));
    return true;
  };
  const addProperty = (key, value, single = false) => {
    if (!isValidValue(key, value))
      return false;
    const signal = isState(value) || isStore(value) ? value : isRecord(value) || Array.isArray(value) ? createStore(value) : createState(value);
    signals.set(key, signal);
    const watcher = createWatcher(() => observe(() => {
      emit("change", { [key]: signal.get() });
    }, watcher));
    watcher();
    signalWatchers.set(key, watcher);
    if (single) {
      notify(watchers);
      emit("add", { [key]: value });
    }
    return true;
  };
  const removeProperty = (key, single = false) => {
    const ok = signals.delete(key);
    if (ok) {
      const watcher = signalWatchers.get(key);
      if (watcher)
        watcher.cleanup();
      signalWatchers.delete(key);
    }
    if (single) {
      notify(watchers);
      emit("remove", { [key]: UNSET });
    }
    return ok;
  };
  const reconcile = (oldValue, newValue, initialRun) => {
    const changes = diff(oldValue, newValue);
    batch(() => {
      if (Object.keys(changes.add).length) {
        for (const key in changes.add)
          addProperty(key, changes.add[key] ?? UNSET);
        if (initialRun) {
          setTimeout(() => {
            emit("add", changes.add);
          }, 0);
        } else {
          emit("add", changes.add);
        }
      }
      if (Object.keys(changes.change).length) {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!isValidValue(key, value))
            continue;
          const signal = signals.get(key);
          if (isMutableSignal(signal))
            signal.set(value);
          else
            throw new StoreKeyReadonlyError(key, valueString(value));
        }
        emit("change", changes.change);
      }
      if (Object.keys(changes.remove).length) {
        for (const key in changes.remove)
          removeProperty(key);
        emit("remove", changes.remove);
      }
    });
    return changes.changed;
  };
  reconcile({}, initialValue, true);
  const store = {};
  Object.defineProperties(store, {
    [Symbol.toStringTag]: {
      value: TYPE_STORE
    },
    [Symbol.isConcatSpreadable]: {
      value: isArrayLike
    },
    [Symbol.iterator]: {
      value: isArrayLike ? function* () {
        const indexes = getSortedIndexes();
        for (const index of indexes) {
          const signal = signals.get(String(index));
          if (signal)
            yield signal;
        }
      } : function* () {
        for (const [key, signal] of signals)
          yield [key, signal];
      }
    },
    add: {
      value: isArrayLike ? (v) => {
        addProperty(String(signals.size), v, true);
      } : (k, v) => {
        if (!signals.has(k))
          addProperty(k, v, true);
        else
          throw new StoreKeyExistsError(k, valueString(v));
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        return recordToArray(current());
      }
    },
    remove: {
      value: isArrayLike ? (index) => {
        const currentArray = recordToArray(current());
        const currentLength = signals.size;
        if (!Array.isArray(currentArray) || index <= -currentLength || index >= currentLength)
          throw new StoreKeyRangeError(index);
        const newArray = [...currentArray];
        newArray.splice(index, 1);
        if (reconcile(currentArray, newArray))
          notify(watchers);
      } : (k) => {
        if (signals.has(k))
          removeProperty(k, true);
      }
    },
    set: {
      value: (v) => {
        if (reconcile(current(), v)) {
          notify(watchers);
          if (UNSET === v)
            watchers.clear();
        }
      }
    },
    update: {
      value: (fn) => {
        const oldValue = current();
        const newValue = fn(recordToArray(oldValue));
        if (reconcile(oldValue, newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    sort: {
      value: (compareFn) => {
        const entries = Array.from(signals.entries()).map(([key, signal]) => [key, signal.get()]).sort(compareFn ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
        const newOrder = entries.map(([key]) => String(key));
        const newSignals = new Map;
        entries.forEach(([key], newIndex) => {
          const oldKey = String(key);
          const newKey = isArrayLike ? String(newIndex) : String(key);
          const signal = signals.get(oldKey);
          if (signal)
            newSignals.set(newKey, signal);
        });
        signals.clear();
        newSignals.forEach((signal, key) => signals.set(key, signal));
        notify(watchers);
        emit("sort", newOrder);
      }
    },
    on: {
      value: (type, listener) => {
        listeners[type].add(listener);
        return () => listeners[type].delete(listener);
      }
    },
    length: {
      get() {
        subscribe(watchers);
        return signals.size;
      }
    }
  });
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (isSymbol(prop))
        return;
      return signals.get(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return signals.has(String(prop));
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      const signalKeys = isArrayLike ? getSortedIndexes().map((key) => String(key)) : Array.from(signals.keys());
      return [...new Set([...signalKeys, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
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
var isSignal = (value) => isState(value) || isComputed(value) || isStore(value);
var isMutableSignal = (value) => isState(value) || isStore(value);
function toSignal(value) {
  if (isSignal(value))
    return value;
  if (isComputedCallback(value))
    return createComputed(value);
  if (Array.isArray(value) || isRecord(value))
    return createStore(value);
  return createState(value);
}
export {
  valueString,
  toSignal,
  toError,
  subscribe,
  resolve,
  observe,
  notify,
  match,
  isSymbol,
  isString,
  isStore,
  isState,
  isSignal,
  isRecordOrArray,
  isRecord,
  isObjectOfType,
  isNumber,
  isMutableSignal,
  isFunction,
  isEqual,
  isComputedCallback,
  isComputed,
  isAsyncFunction,
  isAbortError,
  flush,
  diff,
  createWatcher,
  createStore,
  createState,
  createEffect,
  createComputed,
  batch,
  UNSET,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_COMPUTED,
  StoreKeyReadonlyError,
  StoreKeyRangeError,
  StoreKeyExistsError,
  NullishSignalValueError,
  InvalidSignalValueError,
  InvalidCallbackError,
  CircularDependencyError
};
