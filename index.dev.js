// src/util.ts
var UNSET = Symbol();
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isSyncFunction = (fn) => isFunction(fn) && fn.constructor.name !== "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

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

// src/system.ts
var activeWatcher;
var pendingReactions = new Set;
var batchDepth = 0;
var createWatcher = (react) => {
  const cleanups = new Set;
  const watcher = react;
  watcher.onCleanup = (cleanup) => {
    cleanups.add(cleanup);
  };
  watcher.stop = () => {
    for (const cleanup of cleanups)
      cleanup();
    cleanups.clear();
  };
  return watcher;
};
var subscribeActiveWatcher = (watchers) => {
  if (activeWatcher && !watchers.has(activeWatcher)) {
    const watcher = activeWatcher;
    watcher.onCleanup(() => {
      watchers.delete(watcher);
    });
    watchers.add(watcher);
  }
};
var notifyWatchers = (watchers) => {
  for (const react of watchers) {
    if (batchDepth)
      pendingReactions.add(react);
    else
      react();
  }
};
var flushPendingReactions = () => {
  while (pendingReactions.size) {
    const watchers = Array.from(pendingReactions);
    pendingReactions.clear();
    for (const watcher of watchers)
      watcher();
  }
};
var batchSignalWrites = (setSignals) => {
  batchDepth++;
  try {
    setSignals();
  } finally {
    flushPendingReactions();
    batchDepth--;
  }
};
var trackSignalReads = (watcher, run) => {
  const prev = activeWatcher;
  activeWatcher = watcher || undefined;
  try {
    run();
  } finally {
    activeWatcher = prev;
  }
};
var emitNotification = (listeners, payload) => {
  for (const listener of listeners)
    listener(payload);
};

// src/signals/computed.ts
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
      notifyWatchers(watchers);
  };
  const watcher = createWatcher(() => {
    dirty = true;
    controller?.abort();
    if (watchers.size)
      notifyWatchers(watchers);
    else
      watcher.stop();
  });
  watcher.onCleanup(() => {
    controller?.abort();
  });
  const compute = () => trackSignalReads(watcher, () => {
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
  });
  const computed = {};
  Object.defineProperties(computed, {
    [Symbol.toStringTag]: {
      value: TYPE_COMPUTED
    },
    get: {
      value: () => {
        subscribeActiveWatcher(watchers);
        flushPendingReactions();
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
var isComputedCallback = (value) => isFunction(value) && value.length < 3;

// src/signals/collection.ts
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
    const watcher = createWatcher(() => trackSignalReads(watcher, () => {
      signal.get();
      emitNotification(listeners.change, [key]);
    }));
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
    if (watcher) {
      watcher.stop();
      signalWatchers.delete(key);
    }
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
    notifyWatchers(watchers);
    emitNotification(listeners.add, additions);
  });
  origin.on("remove", (removals) => {
    for (const key of Object.keys(removals)) {
      if (!signals.has(key))
        continue;
      removeProperty(key);
    }
    order = order.filter(() => true);
    notifyWatchers(watchers);
    emitNotification(listeners.remove, removals);
  });
  origin.on("sort", (newOrder) => {
    order = [...newOrder];
    notifyWatchers(watchers);
    emitNotification(listeners.sort, newOrder);
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
        subscribeActiveWatcher(watchers);
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
        notifyWatchers(watchers);
        emitNotification(listeners.sort, order);
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
        subscribeActiveWatcher(watchers);
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

// src/classes/list.ts
var TYPE_LIST = "List";

class List {
  watchers = new Set;
  listeners = {
    add: new Set,
    change: new Set,
    remove: new Set,
    sort: new Set
  };
  signals = new Map;
  order = [];
  ownWatchers = new Map;
  batching = false;
  keyCounter = 0;
  keyConfig;
  constructor(initialValue, keyConfig) {
    validateSignalValue("list", initialValue, Array.isArray);
    this.keyConfig = keyConfig;
    this.reconcile([], initialValue, true);
  }
  generateKey(item) {
    const id = this.keyCounter++;
    return isString(this.keyConfig) ? `${this.keyConfig}${id}` : isFunction(this.keyConfig) ? this.keyConfig(item) : String(id);
  }
  arrayToRecord(array) {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = this.order[i];
      if (!key) {
        key = this.generateKey(value);
        this.order[i] = key;
      }
      record[key] = value;
    }
    return record;
  }
  isValidValue(key, value) {
    validateSignalValue(`list for key "${key}"`, value);
    return true;
  }
  addOwnWatcher(key, signal) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        signal.get();
        if (!this.batching)
          emitNotification(this.listeners.change, [key]);
      });
    });
    this.ownWatchers.set(key, watcher);
    watcher();
  }
  addProperty(key, value, single = false) {
    if (!this.isValidValue(key, value))
      return false;
    const signal = createMutableSignal(value);
    this.signals.set(key, signal);
    if (!this.order.includes(key))
      this.order.push(key);
    if (this.listeners.change.size)
      this.addOwnWatcher(key, signal);
    if (single) {
      notifyWatchers(this.watchers);
      emitNotification(this.listeners.add, [key]);
    }
    return true;
  }
  removeProperty(key, single = false) {
    const ok = this.signals.delete(key);
    if (!ok)
      return;
    const index = this.order.indexOf(key);
    if (index >= 0)
      this.order.splice(index, 1);
    const watcher = this.ownWatchers.get(key);
    if (watcher) {
      watcher.stop();
      this.ownWatchers.delete(key);
    }
    if (single) {
      this.order = this.order.filter(() => true);
      notifyWatchers(this.watchers);
      emitNotification(this.listeners.remove, [key]);
    }
  }
  batchChanges(changes, initialRun) {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.addProperty(key, changes.add[key], false);
      if (initialRun)
        setTimeout(() => {
          emitNotification(this.listeners.add, Object.keys(changes.add));
        }, 0);
      else
        emitNotification(this.listeners.add, Object.keys(changes.add));
    }
    if (Object.keys(changes.change).length) {
      this.batching = true;
      batchSignalWrites(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.isValidValue(key, value))
            continue;
          const signal = this.signals.get(key);
          if (guardMutableSignal(`list item "${key}"`, value, signal))
            signal.set(value);
        }
      });
      this.batching = false;
      emitNotification(this.listeners.change, Object.keys(changes.change));
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.removeProperty(key);
      this.order = this.order.filter(() => true);
      emitNotification(this.listeners.remove, Object.keys(changes.remove));
    }
    return changes.changed;
  }
  reconcile(oldValue, newValue, initialRun) {
    return this.batchChanges(diff(this.arrayToRecord(oldValue), this.arrayToRecord(newValue)), initialRun);
  }
  get [Symbol.toStringTag]() {
    return TYPE_LIST;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.order) {
      const signal = this.signals.get(key);
      if (signal)
        yield signal;
    }
  }
  get length() {
    subscribeActiveWatcher(this.watchers);
    return this.signals.size;
  }
  get() {
    subscribeActiveWatcher(this.watchers);
    return this.order.map((key) => this.signals.get(key)?.get()).filter((v) => v !== undefined);
  }
  set(newValue) {
    if (this.reconcile(this.get(), newValue)) {
      notifyWatchers(this.watchers);
      if (UNSET === newValue)
        this.watchers.clear();
    }
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  at(index) {
    return this.signals.get(this.order[index]);
  }
  keys() {
    return this.order.values();
  }
  byKey(key) {
    return this.signals.get(key);
  }
  keyAt(index) {
    return this.order[index];
  }
  indexOfKey(key) {
    return this.order.indexOf(key);
  }
  add(value) {
    const key = this.generateKey(value);
    if (!this.signals.has(key)) {
      this.addProperty(key, value, true);
      return key;
    } else
      throw new DuplicateKeyError("store", key, value);
  }
  remove(keyOrIndex) {
    const key = isNumber(keyOrIndex) ? this.order[keyOrIndex] : keyOrIndex;
    if (key && this.signals.has(key))
      this.removeProperty(key, true);
  }
  sort(compareFn) {
    const entries = this.order.map((key) => [key, this.signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
    const newOrder = entries.map(([key]) => key);
    if (!isEqual(this.order, newOrder)) {
      this.order = newOrder;
      notifyWatchers(this.watchers);
      emitNotification(this.listeners.sort, this.order);
    }
  }
  splice(start, deleteCount, ...items) {
    const length = this.signals.size;
    const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
    const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
    const add = {};
    const remove = {};
    for (let i = 0;i < actualDeleteCount; i++) {
      const index = actualStart + i;
      const key = this.order[index];
      if (key) {
        const signal = this.signals.get(key);
        if (signal)
          remove[key] = signal.get();
      }
    }
    const newOrder = this.order.slice(0, actualStart);
    for (const item of items) {
      const key = this.generateKey(item);
      newOrder.push(key);
      add[key] = item;
    }
    newOrder.push(...this.order.slice(actualStart + actualDeleteCount));
    this.order = newOrder.filter(() => true);
    const changed = !!(Object.keys(add).length || Object.keys(remove).length);
    if (changed)
      this.batchChanges({
        add,
        change: {},
        remove,
        changed
      });
    notifyWatchers(this.watchers);
    return Object.values(remove);
  }
  on(type, listener) {
    this.listeners[type].add(listener);
    if (type === "change" && !this.ownWatchers.size) {
      this.batching = true;
      for (const [key, signal] of this.signals)
        this.addOwnWatcher(key, signal);
      for (const watcher of this.ownWatchers.values())
        watcher();
      this.batching = false;
    }
    return () => {
      this.listeners[type].delete(listener);
      if (type === "change" && !this.listeners.change.size) {
        if (this.ownWatchers.size) {
          for (const watcher of this.ownWatchers.values())
            watcher.stop();
          this.ownWatchers.clear();
        }
      }
    };
  }
  deriveCollection(callback) {
    return createCollection(this, callback);
  }
}
var createList = (initialValue, keyConfig) => {
  const instance = new List(initialValue, keyConfig);
  const getSignal = (prop) => {
    const index = Number(prop);
    return Number.isInteger(index) && index >= 0 ? instance.at(index) : instance.byKey(prop);
  };
  return new Proxy(instance, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      return !isSymbol(prop) ? getSignal(prop) : undefined;
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return !isSymbol(prop) ? getSignal(prop) !== undefined : false;
    },
    ownKeys(target) {
      return Object.getOwnPropertyNames(target.keys());
    },
    getOwnPropertyDescriptor(target, prop) {
      if (isSymbol(prop))
        return;
      if (prop === "length") {
        return {
          enumerable: false,
          configurable: false,
          writable: false,
          value: target.length
        };
      }
      const index = Number(prop);
      if (Number.isInteger(index) && index >= 0 && index < target.length) {
        const signal = target.at(index);
        return signal ? {
          enumerable: true,
          configurable: true,
          writable: true,
          value: signal
        } : undefined;
      }
      return;
    }
  });
};
var isList = (value) => isObjectOfType(value, TYPE_LIST);

// src/classes/state.ts
var TYPE_STATE = "State";

class State {
  #watchers = new Set;
  #value;
  constructor(initialValue) {
    validateSignalValue("state", initialValue);
    this.#value = initialValue;
  }
  get [Symbol.toStringTag]() {
    return TYPE_STATE;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    return this.#value;
  }
  set(newValue) {
    validateSignalValue("state", newValue);
    if (isEqual(this.#value, newValue))
      return;
    this.#value = newValue;
    notifyWatchers(this.#watchers);
    if (UNSET === this.#value)
      this.#watchers.clear();
  }
  update(updater) {
    validateCallback("state update", updater);
    this.set(updater(this.#value));
  }
}
var createState = (initialValue) => new State(initialValue);
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/classes/store.ts
var TYPE_STORE = "Store";

class Store {
  watchers = new Set;
  listeners = {
    add: new Set,
    change: new Set,
    remove: new Set
  };
  signals = new Map;
  ownWatchers = new Map;
  batching = false;
  constructor(initialValue) {
    validateSignalValue("store", initialValue, isRecord);
    this.reconcile({}, initialValue, true);
  }
  isValidValue(key, value) {
    validateSignalValue(`store for key "${key}"`, value);
    return true;
  }
  addOwnWatcher(key, signal) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        signal.get();
        if (!this.batching)
          emitNotification(this.listeners.change, [key]);
      });
    });
    this.ownWatchers.set(key, watcher);
    watcher();
  }
  addProperty(key, value, single = false) {
    validateSignalValue(`store for key "${key}"`, value);
    const signal = createMutableSignal(value);
    this.signals.set(key, signal);
    if (this.listeners.change.size)
      this.addOwnWatcher(key, signal);
    if (single) {
      notifyWatchers(this.watchers);
      emitNotification(this.listeners.add, [key]);
    }
    return true;
  }
  removeProperty(key, single = false) {
    const ok = this.signals.delete(key);
    if (!ok)
      return;
    const watcher = this.ownWatchers.get(key);
    if (watcher) {
      watcher.stop();
      this.ownWatchers.delete(key);
    }
    if (single) {
      notifyWatchers(this.watchers);
      emitNotification(this.listeners.remove, [key]);
    }
  }
  batchChanges(changes, initialRun) {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.addProperty(key, changes.add[key], false);
      if (initialRun)
        setTimeout(() => {
          emitNotification(this.listeners.add, Object.keys(changes.add));
        }, 0);
      else
        emitNotification(this.listeners.add, Object.keys(changes.add));
    }
    if (Object.keys(changes.change).length) {
      this.batching = true;
      batchSignalWrites(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.isValidValue(key, value))
            continue;
          const signal = this.signals.get(key);
          if (guardMutableSignal(`store key "${key}"`, value, signal))
            signal.set(value);
        }
      });
      this.batching = false;
      emitNotification(this.listeners.change, Object.keys(changes.change));
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.removeProperty(key);
      emitNotification(this.listeners.remove, Object.keys(changes.remove));
    }
    return changes.changed;
  }
  reconcile(oldValue, newValue, initialRun) {
    return this.batchChanges(diff(oldValue, newValue), initialRun);
  }
  get [Symbol.toStringTag]() {
    return TYPE_STORE;
  }
  get [Symbol.isConcatSpreadable]() {
    return false;
  }
  *[Symbol.iterator]() {
    for (const [key, signal] of this.signals)
      yield [key, signal];
  }
  get() {
    subscribeActiveWatcher(this.watchers);
    const record = {};
    for (const [key, signal] of this.signals)
      record[key] = signal.get();
    return record;
  }
  set(newValue) {
    if (this.reconcile(this.get(), newValue)) {
      notifyWatchers(this.watchers);
      if (UNSET === newValue)
        this.watchers.clear();
    }
  }
  keys() {
    return this.signals.keys();
  }
  byKey(key) {
    return this.signals.get(key);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  add(key, value) {
    if (this.signals.has(key))
      throw new DuplicateKeyError("store", key, value);
    this.addProperty(key, value, true);
    return key;
  }
  remove(key) {
    if (this.signals.has(key))
      this.removeProperty(key, true);
  }
  on(type, listener) {
    this.listeners[type].add(listener);
    if (type === "change" && !this.ownWatchers.size) {
      this.batching = true;
      for (const [key, signal] of this.signals)
        this.addOwnWatcher(key, signal);
      for (const watcher of this.ownWatchers.values())
        watcher();
      this.batching = false;
    }
    return () => {
      this.listeners[type].delete(listener);
      if (type === "change" && !this.listeners.change.size) {
        if (this.ownWatchers.size) {
          for (const watcher of this.ownWatchers.values())
            watcher.stop();
          this.ownWatchers.clear();
        }
      }
    };
  }
}
var createStore = (initialValue) => {
  const instance = new Store(initialValue);
  return new Proxy(instance, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (!isSymbol(prop))
        return target.byKey(prop);
    },
    has(target, prop) {
      if (prop in target)
        return true;
      return target.byKey(String(prop)) !== undefined;
    },
    ownKeys(target) {
      return Array.from(target.keys());
    },
    getOwnPropertyDescriptor(target, prop) {
      if (isSymbol(prop))
        return;
      if (prop in target) {
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
      const signal = target.byKey(String(prop));
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
var isMutableSignal = (value) => isState(value) || isStore(value) || isList(value);
var createSignal = (value) => {
  if (isMemoCallback(value))
    return new Memo(value);
  if (isTaskCallback(value))
    return new Task(value);
  if (Array.isArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
};
var createMutableSignal = (value) => {
  if (Array.isArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
};

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

class ReadonlySignalError extends Error {
  constructor(what, value) {
    super(`Could not set ${what} to ${valueString(value)} because signal is read-only`);
    this.name = "ReadonlySignalError";
  }
}
var validateCallback = (where, value, guard = isFunction) => {
  if (!guard(value))
    throw new InvalidCallbackError(where, value);
};
var validateSignalValue = (where, value, guard = () => !(isSymbol(value) && value !== UNSET) || isFunction(value)) => {
  if (value == null)
    throw new NullishSignalValueError(where);
  if (!guard(value))
    throw new InvalidSignalValueError(where, value);
};
var guardMutableSignal = (what, value, signal) => {
  if (!isMutableSignal(signal))
    throw new ReadonlySignalError(what, value);
  return true;
};

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

// src/classes/computed.ts
var TYPE_COMPUTED2 = "Computed";

class Memo {
  #watchers = new Set;
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #watcher;
  constructor(callback, initialValue = UNSET) {
    validateCallback("memo", callback, isMemoCallback);
    validateSignalValue("memo", initialValue);
    this.#callback = callback;
    this.#value = initialValue;
    this.#watcher = createWatcher(() => {
      this.#dirty = true;
      if (this.#watchers.size)
        notifyWatchers(this.#watchers);
      else
        this.#watcher.stop();
    });
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED2;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    flushPendingReactions();
    if (this.#dirty) {
      trackSignalReads(this.#watcher, () => {
        if (this.#computing)
          throw new CircularDependencyError("memo");
        let result;
        this.#computing = true;
        try {
          result = this.#callback(this.#value);
        } catch (e) {
          this.#value = UNSET;
          this.#error = toError(e);
          this.#computing = false;
          return;
        }
        if (result == null || UNSET === result) {
          this.#value = UNSET;
          this.#error = undefined;
        } else {
          this.#value = result;
          this.#error = undefined;
          this.#dirty = false;
        }
        this.#computing = false;
      });
    }
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
}

class Task {
  #watchers = new Set;
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #changed = false;
  #watcher;
  #controller;
  constructor(callback, initialValue = UNSET) {
    validateCallback("task", callback, isTaskCallback);
    validateSignalValue("task", initialValue);
    this.#callback = callback;
    this.#value = initialValue;
    this.#watcher = createWatcher(() => {
      this.#dirty = true;
      this.#controller?.abort();
      if (this.#watchers.size)
        notifyWatchers(this.#watchers);
      else
        this.#watcher.stop();
    });
    this.#watcher.onCleanup(() => {
      this.#controller?.abort();
    });
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED2;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    flushPendingReactions();
    const ok = (v) => {
      if (!isEqual(v, this.#value)) {
        this.#value = v;
        this.#changed = true;
      }
      this.#error = undefined;
      this.#dirty = false;
    };
    const nil = () => {
      this.#changed = UNSET !== this.#value;
      this.#value = UNSET;
      this.#error = undefined;
    };
    const err = (e) => {
      const newError = toError(e);
      this.#changed = !this.#error || newError.name !== this.#error.name || newError.message !== this.#error.message;
      this.#value = UNSET;
      this.#error = newError;
    };
    const settle = (fn) => (arg) => {
      this.#computing = false;
      this.#controller = undefined;
      fn(arg);
      if (this.#changed)
        notifyWatchers(this.#watchers);
    };
    const compute = () => trackSignalReads(this.#watcher, () => {
      if (this.#computing)
        throw new CircularDependencyError("task");
      this.#changed = false;
      if (this.#controller)
        return this.#value;
      this.#controller = new AbortController;
      this.#controller.signal.addEventListener("abort", () => {
        this.#computing = false;
        this.#controller = undefined;
        compute();
      }, {
        once: true
      });
      let result;
      this.#computing = true;
      try {
        result = this.#callback(this.#value, this.#controller.signal);
      } catch (e) {
        if (isAbortError(e))
          nil();
        else
          err(e);
        this.#computing = false;
        return;
      }
      if (result instanceof Promise)
        result.then(settle(ok), settle(err));
      else if (result == null || UNSET === result)
        nil();
      else
        ok(result);
      this.#computing = false;
    });
    if (this.#dirty)
      compute();
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
}
var createComputed2 = (callback, initialValue = UNSET) => isAsyncFunction(callback) ? new Task(callback, initialValue) : new Memo(callback, initialValue);
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED2);
var isMemoCallback = (value) => isSyncFunction(value) && value.length < 2;
var isTaskCallback = (value) => isAsyncFunction(value) && value.length < 3;
// src/effect.ts
var createEffect = (callback) => {
  if (!isFunction(callback) || callback.length > 1)
    throw new InvalidCallbackError("effect", callback);
  const isAsync = isAsyncFunction(callback);
  let running = false;
  let controller;
  const watcher = createWatcher(() => trackSignalReads(watcher, () => {
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
            watcher.onCleanup(cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.onCleanup(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Effect callback error:", error);
    }
    running = false;
  }));
  watcher();
  return () => {
    controller?.abort();
    watcher.stop();
  };
};
export {
  valueString,
  trackSignalReads,
  toError,
  subscribeActiveWatcher,
  resolve,
  notifyWatchers,
  match,
  isTaskCallback,
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
  isMemoCallback,
  isList,
  isFunction,
  isEqual,
  isComputed,
  isCollection,
  isAsyncFunction,
  isAbortError,
  flushPendingReactions,
  emitNotification,
  diff,
  createWatcher,
  createStore,
  createState,
  createSignal,
  createList,
  createEffect,
  createComputed2 as createComputed,
  createCollection,
  batchSignalWrites,
  UNSET,
  Task,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_LIST,
  TYPE_COMPUTED2 as TYPE_COMPUTED,
  TYPE_COLLECTION,
  Store,
  State,
  ReadonlySignalError,
  NullishSignalValueError,
  Memo,
  List,
  InvalidSignalValueError,
  InvalidCallbackError,
  DuplicateKeyError,
  CircularDependencyError
};
