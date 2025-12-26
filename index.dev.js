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
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

// src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency detected in ${where}`);
    this.name = "CircularDependencyError";
  }
}

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`Could not add ${where} key "${key}"${value ? ` with value ${valueString(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}

class ForbiddenMethodCallError extends Error {
  constructor(method, where, reason) {
    super(`Forbidden method call ${method} in ${where} because ${reason}`);
    this.name = "ForbiddenMethodCallError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} callback ${valueString(value)}`);
    this.name = "InvalidCallbackError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`Invalid signal value ${valueString(value)} in ${where}`);
    this.name = "InvalidSignalValueError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`Nullish signal values are not allowed in ${where}`);
    this.name = "NullishSignalValueError";
  }
}

class StoreIndexRangeError extends RangeError {
  constructor(index) {
    super(`Could not remove store index ${String(index)} because it is out of range`);
    this.name = "StoreIndexRangeError";
  }
}

class StoreKeyReadonlyError extends Error {
  constructor(key, value) {
    super(`Could not set store key "${key}" to ${valueString(value)} because it is read-only`);
    this.name = "StoreKeyReadonlyError";
  }
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
  const oldValid = isRecordOrArray(oldObj);
  const newValid = isRecordOrArray(newObj);
  if (!oldValid || !newValid) {
    const changed = !Object.is(oldObj, newObj);
    return {
      changed,
      add: changed && newValid ? newObj : {},
      change: {},
      remove: changed && oldValid ? oldObj : {}
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
  return {
    add,
    change,
    remove,
    changed: !!(Object.keys(add).length || Object.keys(change).length || Object.keys(remove).length)
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
var emit = (listeners, payload) => {
  for (const listener of listeners)
    listener(payload);
};

// src/computed.ts
var TYPE_COMPUTED = "Computed";
var createComputed = (callback, initialValue = UNSET) => {
  if (!isComputedCallback(callback))
    throw new InvalidCallbackError("computed", callback);
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

// src/collection.ts
var TYPE_COLLECTION = "Collection";
var createCollection = (origin, callback) => {
  const watchers = new Set;
  const listeners = {
    add: new Set,
    change: new Set,
    remove: new Set,
    sort: new Set
  };
  const signals = new Map;
  const signalWatchers = new Map;
  let order = [];
  const addProperty = (key) => {
    const computedCallback = isAsyncFunction(callback) ? async (_, abort) => {
      const originSignal = origin.byKey(key);
      if (!originSignal)
        return UNSET;
      let result = UNSET;
      match(resolve({ originSignal }), {
        ok: async ({ originSignal: originValue }) => {
          result = await callback(originValue, abort);
        },
        err: (errors) => {
          console.log(errors);
        }
      });
      return result;
    } : () => {
      const originSignal = origin.byKey(key);
      if (!originSignal)
        return UNSET;
      let result = UNSET;
      match(resolve({ originSignal }), {
        ok: ({ originSignal: originValue }) => {
          result = callback(originValue);
        },
        err: (errors) => {
          console.log(errors);
        }
      });
      return result;
    };
    const signal = createComputed(computedCallback);
    signals.set(key, signal);
    if (!order.includes(key))
      order.push(key);
    const watcher = createWatcher(() => observe(() => {
      signal.get();
      emit(listeners.change, [key]);
    }, watcher));
    watcher();
    signalWatchers.set(key, watcher);
    return true;
  };
  const removeProperty = (key) => {
    const ok = signals.delete(key);
    if (!ok)
      return;
    const index = order.indexOf(key);
    if (index >= 0)
      order.splice(index, 1);
    const watcher = signalWatchers.get(key);
    if (watcher)
      watcher.cleanup();
    signalWatchers.delete(key);
  };
  for (let i = 0;i < origin.length; i++) {
    const key = origin.keyAt(i);
    if (!key)
      continue;
    addProperty(key);
  }
  origin.on("add", (additions) => {
    for (const key of additions) {
      if (!signals.has(key))
        addProperty(key);
    }
    notify(watchers);
    emit(listeners.add, additions);
  });
  origin.on("remove", (removals) => {
    for (const key of Object.keys(removals)) {
      if (!signals.has(key))
        continue;
      removeProperty(key);
    }
    order = order.filter(() => true);
    notify(watchers);
    emit(listeners.remove, removals);
  });
  origin.on("sort", (newOrder) => {
    order = [...newOrder];
    notify(watchers);
    emit(listeners.sort, newOrder);
  });
  const getSignal = (prop) => {
    let key = prop;
    const index = Number(prop);
    if (Number.isInteger(index) && index >= 0)
      key = order[index] ?? prop;
    return signals.get(key);
  };
  const current = () => order.map((key) => signals.get(key)?.get()).filter((v) => v !== UNSET);
  const collection = {};
  Object.defineProperties(collection, {
    [Symbol.toStringTag]: {
      value: TYPE_COLLECTION
    },
    [Symbol.isConcatSpreadable]: {
      value: true
    },
    [Symbol.iterator]: {
      value: function* () {
        for (const key of order) {
          const signal = signals.get(key);
          if (signal)
            yield signal;
        }
      }
    },
    byKey: {
      value(key) {
        return getSignal(key);
      }
    },
    keyAt: {
      value(index) {
        return order[index];
      }
    },
    indexOfKey: {
      value(key) {
        return order.indexOf(key);
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        return current();
      }
    },
    sort: {
      value: (compareFn) => {
        const entries = order.map((key, index) => {
          const signal = signals.get(key);
          return [
            index,
            key,
            signal ? signal.get() : undefined
          ];
        }).sort(compareFn ? (a, b) => compareFn(a[2], b[2]) : (a, b) => String(a[2]).localeCompare(String(b[2])));
        order = entries.map(([_, key]) => key);
        notify(watchers);
        emit(listeners.sort, order);
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
  return new Proxy(collection, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (!isSymbol(prop))
        return getSignal(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return signals.has(String(prop));
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      return [...new Set([...order, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      if (isSymbol(prop))
        return;
      const signal = getSignal(prop);
      return signal ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: signal
      } : undefined;
    }
  });
};
var isCollection = (value) => isObjectOfType(value, TYPE_COLLECTION);
// src/effect.ts
var createEffect = (callback) => {
  if (!isFunction(callback) || callback.length > 1)
    throw new InvalidCallbackError("effect", callback);
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
          throw new InvalidCallbackError("state update", updater);
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
  let order = [];
  const current = () => {
    const record = {};
    for (const key of order) {
      const signal = signals.get(key);
      if (signal)
        record[key] = signal.get();
    }
    return record;
  };
  const isValidValue = (key, value) => {
    if (value == null)
      throw new NullishSignalValueError(`store for key "${key}"`);
    if (value === UNSET)
      return true;
    if (isSymbol(value) || isFunction(value) || isComputed(value))
      throw new InvalidSignalValueError(`store for key "${key}"`, value);
    return true;
  };
  const addProperty = (key, value, single = false) => {
    if (!isValidValue(key, value))
      return false;
    const signal = isState(value) || isStore(value) ? value : isRecord(value) || Array.isArray(value) ? createStore(value) : createState(value);
    signals.set(key, signal);
    if (!order.includes(key))
      order.push(key);
    const watcher = createWatcher(() => observe(() => {
      signal.get();
      emit(listeners.change, [key]);
    }, watcher));
    watcher();
    signalWatchers.set(key, watcher);
    if (single) {
      notify(watchers);
      emit(listeners.add, [key]);
    }
    return true;
  };
  const removeProperty = (key, single = false) => {
    const ok = signals.delete(key);
    if (!ok)
      return;
    const index = order.indexOf(key);
    if (index >= 0)
      order.splice(index, 1);
    const watcher = signalWatchers.get(key);
    if (watcher)
      watcher.cleanup();
    signalWatchers.delete(key);
    if (single) {
      order = order.filter(() => true);
      notify(watchers);
      emit(listeners.remove, [key]);
    }
  };
  const batchChanges = (changes, initialRun) => {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        addProperty(key, changes.add[key], false);
      if (initialRun)
        setTimeout(() => {
          emit(listeners.add, Object.keys(changes.add));
        }, 0);
      else
        emit(listeners.add, Object.keys(changes.add));
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!isValidValue(key, value))
            continue;
          const signal = signals.get(key);
          if (isMutableSignal(signal))
            signal.set(value);
          else
            throw new StoreKeyReadonlyError(key, value);
        }
        emit(listeners.change, Object.keys(changes.change));
      });
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        removeProperty(key);
      order = order.filter(() => true);
      emit(listeners.remove, Object.keys(changes.remove));
    }
    return changes.changed;
  };
  const reconcile = (oldValue, newValue, initialRun) => batchChanges(diff(oldValue, newValue), initialRun);
  reconcile({}, initialValue, true);
  const prototype = {};
  Object.defineProperties(prototype, {
    [Symbol.toStringTag]: {
      value: TYPE_STORE
    },
    [Symbol.iterator]: {
      value: function* () {
        for (const key of order) {
          const signal = signals.get(key);
          if (signal)
            yield [key, signal];
        }
      }
    },
    add: {
      value: (key, value) => {
        if (!signals.has(key)) {
          addProperty(key, value, true);
          return key;
        } else
          throw new DuplicateKeyError("store", key, value);
      }
    },
    byKey: {
      value: (key) => {
        return signals.get(key);
      }
    },
    keyAt: {
      value(index) {
        return order[index];
      }
    },
    indexOfKey: {
      value(key) {
        return order.indexOf(key);
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        return current();
      }
    },
    remove: {
      value: (keyOrIndex) => {
        let key = String(keyOrIndex);
        if (isNumber(keyOrIndex)) {
          if (!order[keyOrIndex])
            throw new StoreIndexRangeError(keyOrIndex);
          key = order[keyOrIndex];
        }
        if (signals.has(key))
          removeProperty(key, true);
      }
    },
    set: {
      value: (newValue) => {
        if (reconcile(current(), newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    update: {
      value: (fn) => {
        const oldValue = current();
        const newValue = fn(oldValue);
        if (reconcile(oldValue, newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    sort: {
      value: (compareFn) => {
        const entries = order.map((key, index) => {
          const signal = signals.get(key);
          return [
            index,
            key,
            signal ? signal.get() : undefined
          ];
        }).sort(compareFn ? (a, b) => compareFn(a[2], b[2]) : (a, b) => String(a[2]).localeCompare(String(b[2])));
        order = entries.map(([_, key]) => key);
        notify(watchers);
        emit(listeners.sort, order);
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
  const store = new Proxy(prototype, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (!isSymbol(prop))
        return signals.get(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return signals.has(String(prop));
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      return [...new Set([...order, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      if (isSymbol(prop))
        return;
      const signal = signals.get(prop);
      return signal ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: signal
      } : undefined;
    }
  });
  return store;
};
var isStore = (value) => isObjectOfType(value, TYPE_STORE);

// src/signal.ts
var isSignal = (value) => isState(value) || isComputed(value) || isStore(value);
var isMutableSignal = (value) => isState(value) || isStore(value) || isList(value);
function toSignal(value) {
  if (isSignal(value))
    return value;
  if (isComputedCallback(value))
    return createComputed(value);
  if (Array.isArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}

// src/list.ts
var TYPE_LIST = "List";
var createList = (initialValue, keyConfig) => {
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
  let keyCounter = 0;
  let order = [];
  const getSignal = (prop) => {
    let key = prop;
    const index = Number(prop);
    if (Number.isInteger(index) && index >= 0)
      key = order[index] ?? prop;
    return signals.get(key);
  };
  const generateKey = (item) => {
    const id = keyCounter++;
    return isString(keyConfig) ? `${keyConfig}${id}` : isFunction(keyConfig) ? keyConfig(item) : String(id);
  };
  const arrayToRecord = (array) => {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = order[i];
      if (!key) {
        key = generateKey(value);
        order[i] = key;
      }
      record[key] = value;
    }
    return record;
  };
  const current = () => order.map((key) => signals.get(key)?.get()).filter((v) => v !== undefined);
  const isValidValue = (key, value) => {
    if (value == null)
      throw new NullishSignalValueError(`store for key "${key}"`);
    if (value === UNSET)
      return true;
    if (isSymbol(value) || isFunction(value) || isComputed(value))
      throw new InvalidSignalValueError(`store for key "${key}"`, value);
    return true;
  };
  const addProperty = (key, value, single = false) => {
    if (!isValidValue(key, value))
      return false;
    const signal = isState(value) || isStore(value) || isList(value) ? value : isRecord(value) ? createStore(value) : Array.isArray(value) ? createList(value) : createState(value);
    signals.set(key, signal);
    if (!order.includes(key))
      order.push(key);
    const watcher = createWatcher(() => observe(() => {
      signal.get();
      emit(listeners.change, [key]);
    }, watcher));
    watcher();
    signalWatchers.set(key, watcher);
    if (single) {
      notify(watchers);
      emit(listeners.add, [key]);
    }
    return true;
  };
  const removeProperty = (key, single = false) => {
    const ok = signals.delete(key);
    if (!ok)
      return;
    const index = order.indexOf(key);
    if (index >= 0)
      order.splice(index, 1);
    const watcher = signalWatchers.get(key);
    if (watcher)
      watcher.cleanup();
    signalWatchers.delete(key);
    if (single) {
      order = order.filter(() => true);
      notify(watchers);
      emit(listeners.remove, [key]);
    }
  };
  const batchChanges = (changes, initialRun) => {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        addProperty(key, changes.add[key], false);
      if (initialRun)
        setTimeout(() => {
          emit(listeners.add, Object.keys(changes.add));
        }, 0);
      else
        emit(listeners.add, Object.keys(changes.add));
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!isValidValue(key, value))
            continue;
          const signal = signals.get(key);
          if (isMutableSignal(signal))
            signal.set(value);
          else
            throw new StoreKeyReadonlyError(key, value);
        }
        emit(listeners.change, Object.keys(changes.change));
      });
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        removeProperty(key);
      order = order.filter(() => true);
      emit(listeners.remove, Object.keys(changes.remove));
    }
    return changes.changed;
  };
  const reconcile = (oldValue, newValue, initialRun) => batchChanges(diff(arrayToRecord(oldValue), arrayToRecord(newValue)), initialRun);
  reconcile([], initialValue, true);
  const prototype = {};
  Object.defineProperties(prototype, {
    [Symbol.toStringTag]: {
      value: TYPE_LIST
    },
    [Symbol.isConcatSpreadable]: {
      value: true
    },
    [Symbol.iterator]: {
      value: function* () {
        for (const key of order) {
          const signal = signals.get(key);
          if (signal)
            yield signal;
        }
      }
    },
    add: {
      value: (value) => {
        const key = generateKey(value);
        if (!signals.has(key)) {
          addProperty(key, value, true);
          return key;
        } else
          throw new DuplicateKeyError("store", key, value);
      }
    },
    byKey: {
      value: (key) => {
        return getSignal(key);
      }
    },
    deriveCollection: {
      value: (callback) => {
        const collection = createCollection(list, callback);
        return collection;
      }
    },
    keyAt: {
      value(index) {
        return order[index];
      }
    },
    indexOfKey: {
      value(key) {
        return order.indexOf(key);
      }
    },
    get: {
      value: () => {
        subscribe(watchers);
        return current();
      }
    },
    remove: {
      value: (keyOrIndex) => {
        let key = String(keyOrIndex);
        if (isNumber(keyOrIndex)) {
          if (!order[keyOrIndex])
            throw new StoreIndexRangeError(keyOrIndex);
          key = order[keyOrIndex];
        }
        if (signals.has(key))
          removeProperty(key, true);
      }
    },
    set: {
      value: (newValue) => {
        if (reconcile(current(), newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    update: {
      value: (fn) => {
        const oldValue = current();
        const newValue = fn(oldValue);
        if (reconcile(oldValue, newValue)) {
          notify(watchers);
          if (UNSET === newValue)
            watchers.clear();
        }
      }
    },
    sort: {
      value: (compareFn) => {
        const entries = order.map((key, index) => {
          const signal = signals.get(key);
          return [
            index,
            key,
            signal ? signal.get() : undefined
          ];
        }).sort(compareFn ? (a, b) => compareFn(a[2], b[2]) : (a, b) => String(a[2]).localeCompare(String(b[2])));
        order = entries.map(([_, key]) => key);
        notify(watchers);
        emit(listeners.sort, order);
      }
    },
    splice: {
      value: (start, deleteCount, ...items) => {
        const length = signals.size;
        const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
        const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
        const add = {};
        const remove = {};
        for (let i = 0;i < actualDeleteCount; i++) {
          const index = actualStart + i;
          const key = order[index];
          if (key) {
            const signal = signals.get(key);
            if (signal)
              remove[key] = signal.get();
          }
        }
        const newOrder = order.slice(0, actualStart);
        for (const item of items) {
          const key = generateKey(item);
          newOrder.push(key);
          add[key] = item;
        }
        newOrder.push(...order.slice(actualStart + actualDeleteCount));
        order = newOrder.filter(() => true);
        const changed = !!(Object.keys(add).length || Object.keys(remove).length);
        if (changed)
          batchChanges({
            add,
            change: {},
            remove,
            changed
          });
        notify(watchers);
        return Object.values(remove);
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
  const list = new Proxy(prototype, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (!isSymbol(prop))
        return getSignal(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return signals.has(String(prop));
    },
    ownKeys(target) {
      const staticKeys = Reflect.ownKeys(target);
      return [...new Set([...order, ...staticKeys])];
    },
    getOwnPropertyDescriptor(target, prop) {
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      if (isSymbol(prop))
        return;
      const signal = getSignal(prop);
      return signal ? {
        enumerable: true,
        configurable: true,
        writable: true,
        value: signal
      } : undefined;
    }
  });
  return list;
};
var isList = (value) => isObjectOfType(value, TYPE_LIST);
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
  isList,
  isFunction,
  isEqual,
  isComputedCallback,
  isComputed,
  isCollection,
  isAsyncFunction,
  isAbortError,
  flush,
  emit,
  diff,
  createWatcher,
  createStore,
  createState,
  createList,
  createEffect,
  createComputed,
  createCollection,
  batch,
  UNSET,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_LIST,
  TYPE_COMPUTED,
  TYPE_COLLECTION,
  StoreKeyReadonlyError,
  StoreIndexRangeError,
  NullishSignalValueError,
  InvalidSignalValueError,
  InvalidCallbackError,
  ForbiddenMethodCallError,
  DuplicateKeyError,
  CircularDependencyError
};
