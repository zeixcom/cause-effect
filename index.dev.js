// src/system.ts
var activeWatcher;
var pendingReactions = new Set;
var batchDepth = 0;
var UNSET = Symbol();
var HOOK_ADD = "add";
var HOOK_CHANGE = "change";
var HOOK_CLEANUP = "cleanup";
var HOOK_REMOVE = "remove";
var HOOK_SORT = "sort";
var HOOK_WATCH = "watch";
var createWatcher = (react) => {
  const cleanups = new Set;
  const watcher = react;
  watcher.on = (type, cleanup) => {
    if (type === HOOK_CLEANUP)
      cleanups.add(cleanup);
    else
      throw new InvalidHookError("watcher", type);
  };
  watcher.stop = () => {
    for (const cleanup of cleanups)
      cleanup();
    cleanups.clear();
  };
  return watcher;
};
var subscribeActiveWatcher = (watchers) => {
  const isFirst = !watchers.size;
  if (activeWatcher && !watchers.has(activeWatcher)) {
    const watcher = activeWatcher;
    watcher.on(HOOK_CLEANUP, () => watchers.delete(watcher));
    watchers.add(watcher);
  }
  return isFirst;
};
var notifyWatchers = (watchers) => {
  if (!watchers.size)
    return false;
  for (const react of watchers) {
    if (batchDepth)
      pendingReactions.add(react);
    else
      react();
  }
  return true;
};
var flushPendingReactions = () => {
  while (pendingReactions.size) {
    const watchers = Array.from(pendingReactions);
    pendingReactions.clear();
    for (const watcher of watchers)
      watcher();
  }
};
var batchSignalWrites = (callback) => {
  batchDepth++;
  try {
    callback();
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
var triggerHook = (callbacks, payload) => {
  if (!callbacks)
    return;
  const cleanups = [];
  for (const callback of callbacks) {
    const cleanup = callback(payload);
    if (cleanup)
      cleanups.push(cleanup);
  }
  return () => {
    for (const cleanup of cleanups)
      cleanup();
  };
};
var isHandledHook = (type, handled) => handled.includes(type);

// src/util.ts
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isSyncFunction = (fn) => isFunction(fn) && fn.constructor.name !== "AsyncFunction";
var isNonNullObject = (value) => value != null && typeof value === "object";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);
var isUniformArray = (value, guard = (item) => item != null) => Array.isArray(value) && value.every(guard);
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var valueString = (value) => isString(value) ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);

// src/diff.ts
var isEqual = (a, b, visited) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (!isNonNullObject(a) || !isNonNullObject(b))
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
var TYPE_COMPUTED = "Computed";

class Memo {
  #watchers = new Set;
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #watcher;
  #hookCallbacks = {};
  constructor(callback, initialValue = UNSET) {
    validateCallback(this.constructor.name, callback, isMemoCallback);
    validateSignalValue(this.constructor.name, initialValue);
    this.#callback = callback;
    this.#value = initialValue;
  }
  #getWatcher() {
    if (!this.#watcher) {
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        if (!notifyWatchers(this.#watchers))
          this.#watcher?.stop();
      });
      const unwatch = triggerHook(this.#hookCallbacks[HOOK_WATCH]);
      this.#watcher.on(HOOK_CLEANUP, () => {
        if (unwatch)
          unwatch();
        this.#watcher = undefined;
      });
    }
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    flushPendingReactions();
    if (this.#dirty) {
      const watcher = this.#getWatcher();
      trackSignalReads(watcher, () => {
        if (this.#computing)
          throw new CircularDependencyError("memo");
        let result;
        this.#computing = true;
        try {
          result = this.#callback(this.#value);
        } catch (e) {
          this.#value = UNSET;
          this.#error = createError(e);
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
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#hookCallbacks[HOOK_WATCH] ||= new Set;
      this.#hookCallbacks[HOOK_WATCH].add(callback);
      return () => {
        this.#hookCallbacks[HOOK_WATCH]?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
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
  #hookCallbacks = {};
  constructor(callback, initialValue = UNSET) {
    validateCallback(this.constructor.name, callback, isTaskCallback);
    validateSignalValue(this.constructor.name, initialValue);
    this.#callback = callback;
    this.#value = initialValue;
  }
  #getWatcher() {
    if (!this.#watcher) {
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        this.#controller?.abort();
        if (!notifyWatchers(this.#watchers))
          this.#watcher?.stop();
      });
      const unwatch = triggerHook(this.#hookCallbacks[HOOK_WATCH]);
      this.#watcher.on(HOOK_CLEANUP, () => {
        this.#controller?.abort();
        this.#controller = undefined;
        if (unwatch)
          unwatch();
        this.#watcher = undefined;
      });
    }
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
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
      const newError = createError(e);
      this.#changed = !this.#error || newError.name !== this.#error.name || newError.message !== this.#error.message;
      this.#value = UNSET;
      this.#error = newError;
    };
    const settle = (fn) => (arg) => {
      this.#computing = false;
      this.#controller = undefined;
      fn(arg);
      if (this.#changed && !notifyWatchers(this.#watchers))
        this.#watcher?.stop();
    };
    const compute = () => trackSignalReads(this.#getWatcher(), () => {
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
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#hookCallbacks[HOOK_WATCH] ||= new Set;
      this.#hookCallbacks[HOOK_WATCH].add(callback);
      return () => {
        this.#hookCallbacks[HOOK_WATCH]?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
  }
}
var createComputed = (callback, initialValue = UNSET) => isAsyncFunction(callback) ? new Task(callback, initialValue) : new Memo(callback, initialValue);
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isMemoCallback = (value) => isSyncFunction(value) && value.length < 2;
var isTaskCallback = (value) => isAsyncFunction(value) && value.length < 3;

// src/classes/composite.ts
class Composite {
  signals = new Map;
  #validate;
  #create;
  #watchers = new Map;
  #hookCallbacks = {};
  #batching = false;
  constructor(values, validate, create) {
    this.#validate = validate;
    this.#create = create;
    this.change({
      add: values,
      change: {},
      remove: {},
      changed: true
    }, true);
  }
  #addWatcher(key) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        this.signals.get(key)?.get();
        if (!this.#batching)
          triggerHook(this.#hookCallbacks.change, [key]);
      });
    });
    this.#watchers.set(key, watcher);
    watcher();
  }
  add(key, value) {
    if (!this.#validate(key, value))
      return false;
    this.signals.set(key, this.#create(value));
    if (this.#hookCallbacks.change?.size)
      this.#addWatcher(key);
    if (!this.#batching)
      triggerHook(this.#hookCallbacks.add, [key]);
    return true;
  }
  remove(key) {
    const ok = this.signals.delete(key);
    if (!ok)
      return false;
    const watcher = this.#watchers.get(key);
    if (watcher) {
      watcher.stop();
      this.#watchers.delete(key);
    }
    if (!this.#batching)
      triggerHook(this.#hookCallbacks.remove, [key]);
    return true;
  }
  change(changes, initialRun) {
    this.#batching = true;
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.add(key, changes.add[key]);
      const notify = () => triggerHook(this.#hookCallbacks.add, Object.keys(changes.add));
      if (initialRun)
        setTimeout(notify, 0);
      else
        notify();
    }
    if (Object.keys(changes.change).length) {
      batchSignalWrites(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.#validate(key, value))
            continue;
          const signal = this.signals.get(key);
          if (guardMutableSignal(`list item "${key}"`, value, signal))
            signal.set(value);
        }
      });
      triggerHook(this.#hookCallbacks.change, Object.keys(changes.change));
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.remove(key);
      triggerHook(this.#hookCallbacks.remove, Object.keys(changes.remove));
    }
    this.#batching = false;
    return changes.changed;
  }
  clear() {
    const keys = Array.from(this.signals.keys());
    this.signals.clear();
    this.#watchers.clear();
    triggerHook(this.#hookCallbacks.remove, keys);
    return true;
  }
  on(type, callback) {
    this.#hookCallbacks[type] ||= new Set;
    this.#hookCallbacks[type].add(callback);
    if (type === HOOK_CHANGE && !this.#watchers.size) {
      this.#batching = true;
      for (const key of this.signals.keys())
        this.#addWatcher(key);
      this.#batching = false;
    }
    return () => {
      this.#hookCallbacks[type]?.delete(callback);
      if (type === HOOK_CHANGE && !this.#hookCallbacks.change?.size) {
        if (this.#watchers.size) {
          for (const watcher of this.#watchers.values())
            watcher.stop();
          this.#watchers.clear();
        }
      }
    };
  }
}

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
    if (this.#watchers.size)
      notifyWatchers(this.#watchers);
    if (UNSET === this.#value)
      this.#watchers.clear();
  }
  update(updater) {
    validateCallback("state update", updater);
    this.set(updater(this.#value));
  }
}
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/classes/list.ts
var TYPE_LIST = "List";

class List {
  #composite;
  #watchers = new Set;
  #hookCallbacks = {};
  #order = [];
  #generateKey;
  constructor(initialValue, keyConfig) {
    validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
    let keyCounter = 0;
    this.#generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction(keyConfig) ? (item) => keyConfig(item) : () => String(keyCounter++);
    this.#composite = new Composite(this.#toRecord(initialValue), (key, value) => {
      validateSignalValue(`${TYPE_LIST} for key "${key}"`, value);
      return true;
    }, (value) => new State(value));
  }
  #toRecord(array) {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = this.#order[i];
      if (!key) {
        key = this.#generateKey(value);
        this.#order[i] = key;
      }
      record[key] = value;
    }
    return record;
  }
  get #value() {
    return this.#order.map((key) => this.#composite.signals.get(key)?.get()).filter((v) => v !== undefined);
  }
  get [Symbol.toStringTag]() {
    return TYPE_LIST;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#order) {
      const signal = this.#composite.signals.get(key);
      if (signal)
        yield signal;
    }
  }
  get length() {
    subscribeActiveWatcher(this.#watchers);
    return this.#order.length;
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyWatchers(this.#watchers);
      this.#watchers.clear();
      return;
    }
    const oldValue = this.#value;
    const changes = diff(this.#toRecord(oldValue), this.#toRecord(newValue));
    const removedKeys = Object.keys(changes.remove);
    const changed = this.#composite.change(changes);
    if (changed) {
      for (const key of removedKeys) {
        const index = this.#order.indexOf(key);
        if (index !== -1)
          this.#order.splice(index, 1);
      }
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
    }
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  at(index) {
    return this.#composite.signals.get(this.#order[index]);
  }
  keys() {
    return this.#order.values();
  }
  byKey(key) {
    return this.#composite.signals.get(key);
  }
  keyAt(index) {
    return this.#order[index];
  }
  indexOfKey(key) {
    return this.#order.indexOf(key);
  }
  add(value) {
    const key = this.#generateKey(value);
    if (this.#composite.signals.has(key))
      throw new DuplicateKeyError("store", key, value);
    if (!this.#order.includes(key))
      this.#order.push(key);
    const ok = this.#composite.add(key, value);
    if (ok)
      notifyWatchers(this.#watchers);
    return key;
  }
  remove(keyOrIndex) {
    const key = isNumber(keyOrIndex) ? this.#order[keyOrIndex] : keyOrIndex;
    const ok = this.#composite.remove(key);
    if (ok) {
      const index = isNumber(keyOrIndex) ? keyOrIndex : this.#order.indexOf(key);
      if (index >= 0)
        this.#order.splice(index, 1);
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
    }
  }
  sort(compareFn) {
    const entries = this.#order.map((key) => [key, this.#composite.signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
    const newOrder = entries.map(([key]) => key);
    if (!isEqual(this.#order, newOrder)) {
      this.#order = newOrder;
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.sort, this.#order);
    }
  }
  splice(start, deleteCount, ...items) {
    const length = this.#order.length;
    const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
    const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
    const add = {};
    const remove = {};
    for (let i = 0;i < actualDeleteCount; i++) {
      const index = actualStart + i;
      const key = this.#order[index];
      if (key) {
        const signal = this.#composite.signals.get(key);
        if (signal)
          remove[key] = signal.get();
      }
    }
    const newOrder = this.#order.slice(0, actualStart);
    for (const item of items) {
      const key = this.#generateKey(item);
      newOrder.push(key);
      add[key] = item;
    }
    newOrder.push(...this.#order.slice(actualStart + actualDeleteCount));
    const changed = !!(Object.keys(add).length || Object.keys(remove).length);
    if (changed) {
      this.#composite.change({
        add,
        change: {},
        remove,
        changed
      });
      this.#order = newOrder.filter(() => true);
      notifyWatchers(this.#watchers);
    }
    return Object.values(remove);
  }
  on(type, callback) {
    if (isHandledHook(type, [HOOK_SORT, HOOK_WATCH])) {
      this.#hookCallbacks[type] ||= new Set;
      this.#hookCallbacks[type].add(callback);
      return () => {
        this.#hookCallbacks[type]?.delete(callback);
      };
    } else if (isHandledHook(type, [HOOK_ADD, HOOK_CHANGE, HOOK_REMOVE])) {
      return this.#composite.on(type, callback);
    }
    throw new InvalidHookError(TYPE_LIST, type);
  }
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
}
var isList = (value) => isObjectOfType(value, TYPE_LIST);

// src/classes/store.ts
var TYPE_STORE = "Store";

class BaseStore {
  #composite;
  #watchers = new Set;
  constructor(initialValue) {
    validateSignalValue("store", initialValue, isRecord);
    this.#composite = new Composite(initialValue, (key, value) => {
      validateSignalValue(`store for key "${key}"`, value);
      return true;
    }, (value) => createMutableSignal(value));
  }
  get #value() {
    const record = {};
    for (const [key, signal] of this.#composite.signals.entries())
      record[key] = signal.get();
    return record;
  }
  get [Symbol.toStringTag]() {
    return TYPE_STORE;
  }
  get [Symbol.isConcatSpreadable]() {
    return false;
  }
  *[Symbol.iterator]() {
    for (const [key, signal] of this.#composite.signals.entries())
      yield [key, signal];
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyWatchers(this.#watchers);
      this.#watchers.clear();
      return;
    }
    const oldValue = this.#value;
    const changed = this.#composite.change(diff(oldValue, newValue));
    if (changed)
      notifyWatchers(this.#watchers);
  }
  keys() {
    return this.#composite.signals.keys();
  }
  byKey(key) {
    return this.#composite.signals.get(key);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  add(key, value) {
    if (this.#composite.signals.has(key))
      throw new DuplicateKeyError("store", key, value);
    const ok = this.#composite.add(key, value);
    if (ok)
      notifyWatchers(this.#watchers);
    return key;
  }
  remove(key) {
    const ok = this.#composite.remove(key);
    if (ok)
      notifyWatchers(this.#watchers);
  }
  on(type, callback) {
    return this.#composite.on(type, callback);
  }
}
var createStore = (initialValue) => {
  const instance = new BaseStore(initialValue);
  return new Proxy(instance, {
    get(target, prop) {
      if (prop in target) {
        const value = Reflect.get(target, prop);
        return isFunction(value) ? value.bind(target) : value;
      }
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
      if (prop in target)
        return Reflect.getOwnPropertyDescriptor(target, prop);
      if (isSymbol(prop))
        return;
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
function createSignal(value) {
  if (isMemoCallback(value))
    return new Memo(value);
  if (isTaskCallback(value))
    return new Task(value);
  if (isUniformArray(value))
    return new List(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
}
function createMutableSignal(value) {
  if (isUniformArray(value))
    return new List(value);
  if (isRecord(value))
    return createStore(value);
  return new State(value);
}

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

class InvalidCollectionSourceError extends TypeError {
  constructor(where, value) {
    super(`Invalid ${where} source ${valueString(value)}`);
    this.name = "InvalidCollectionSourceError";
  }
}

class InvalidHookError extends TypeError {
  constructor(where, type) {
    super(`Invalid hook "${type}" in  ${where}`);
    this.name = "InvalidHookError";
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
var createError = (reason) => reason instanceof Error ? reason : Error(String(reason));
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

// src/classes/collection.ts
var TYPE_COLLECTION = "Collection";

class DerivedCollection {
  #watchers = new Set;
  #source;
  #callback;
  #signals = new Map;
  #ownWatchers = new Map;
  #hookCallbacks = {};
  #order = [];
  constructor(source, callback) {
    validateCallback(TYPE_COLLECTION, callback);
    if (isFunction(source))
      source = source();
    if (!isCollectionSource(source))
      throw new InvalidCollectionSourceError(TYPE_COLLECTION, source);
    this.#source = source;
    this.#callback = callback;
    for (let i = 0;i < this.#source.length; i++) {
      const key = this.#source.keyAt(i);
      if (!key)
        continue;
      this.#add(key);
    }
    this.#source.on(HOOK_ADD, (additions) => {
      if (!additions)
        return;
      for (const key of additions) {
        if (!this.#signals.has(key)) {
          this.#add(key);
          const signal = this.#signals.get(key);
          if (signal && isAsyncCollectionCallback(this.#callback))
            signal.get();
        }
      }
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.add, additions);
    });
    this.#source.on(HOOK_REMOVE, (removals) => {
      if (!removals)
        return;
      for (const key of removals) {
        if (!this.#signals.has(key))
          continue;
        this.#signals.delete(key);
        const index = this.#order.indexOf(key);
        if (index >= 0)
          this.#order.splice(index, 1);
        const watcher = this.#ownWatchers.get(key);
        if (watcher) {
          watcher.stop();
          this.#ownWatchers.delete(key);
        }
      }
      this.#order = this.#order.filter(() => true);
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.remove, removals);
    });
    this.#source.on(HOOK_SORT, (newOrder) => {
      if (newOrder)
        this.#order = [...newOrder];
      notifyWatchers(this.#watchers);
      triggerHook(this.#hookCallbacks.sort, newOrder);
    });
  }
  #add(key) {
    const computedCallback = isAsyncCollectionCallback(this.#callback) ? async (_, abort) => {
      const sourceValue = this.#source.byKey(key)?.get();
      if (sourceValue === UNSET)
        return UNSET;
      return this.#callback(sourceValue, abort);
    } : () => {
      const sourceValue = this.#source.byKey(key)?.get();
      if (sourceValue === UNSET)
        return UNSET;
      return this.#callback(sourceValue);
    };
    const signal = createComputed(computedCallback);
    this.#signals.set(key, signal);
    if (!this.#order.includes(key))
      this.#order.push(key);
    if (this.#hookCallbacks.change?.size)
      this.#addWatcher(key);
    return true;
  }
  #addWatcher(key) {
    const watcher = createWatcher(() => {
      trackSignalReads(watcher, () => {
        this.#signals.get(key)?.get();
      });
    });
    this.#ownWatchers.set(key, watcher);
    watcher();
  }
  get [Symbol.toStringTag]() {
    return TYPE_COLLECTION;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#order) {
      const signal = this.#signals.get(key);
      if (signal)
        yield signal;
    }
  }
  keys() {
    return this.#order.values();
  }
  get() {
    subscribeActiveWatcher(this.#watchers);
    return this.#order.map((key) => this.#signals.get(key)?.get()).filter((v) => v != null && v !== UNSET);
  }
  at(index) {
    return this.#signals.get(this.#order[index]);
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  keyAt(index) {
    return this.#order[index];
  }
  indexOfKey(key) {
    return this.#order.indexOf(key);
  }
  on(type, callback) {
    this.#hookCallbacks[type] ||= new Set;
    this.#hookCallbacks[type].add(callback);
    if (type === HOOK_CHANGE && !this.#ownWatchers.size) {
      for (const key of this.#signals.keys())
        this.#addWatcher(key);
    }
    return () => {
      this.#hookCallbacks[type]?.delete(callback);
      if (type === HOOK_CHANGE && !this.#hookCallbacks.change?.size) {
        if (this.#ownWatchers.size) {
          for (const watcher of this.#ownWatchers.values())
            watcher.stop();
          this.#ownWatchers.clear();
        }
      }
    };
  }
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
  get length() {
    subscribeActiveWatcher(this.#watchers);
    return this.#order.length;
  }
}
var isCollection = (value) => isObjectOfType(value, TYPE_COLLECTION);
var isCollectionSource = (value) => isList(value) || isCollection(value);
var isAsyncCollectionCallback = (callback) => isAsyncFunction(callback);
// src/classes/ref.ts
var TYPE_REF = "Ref";

class Ref {
  #watchers = new Set;
  #value;
  #hookCallbacks = {};
  #unwatch;
  constructor(value, guard) {
    validateSignalValue(TYPE_REF, value, guard);
    this.#value = value;
  }
  get [Symbol.toStringTag]() {
    return TYPE_REF;
  }
  get() {
    const startWatching = subscribeActiveWatcher(this.#watchers);
    if (startWatching)
      this.#unwatch = triggerHook(this.#hookCallbacks[HOOK_WATCH]);
    return this.#value;
  }
  notify() {
    if (!notifyWatchers(this.#watchers) && this.#unwatch)
      this.#unwatch();
  }
  on(type, callback) {
    if (type === HOOK_WATCH) {
      this.#hookCallbacks[HOOK_WATCH] ||= new Set;
      this.#hookCallbacks[HOOK_WATCH].add(callback);
      return () => {
        this.#hookCallbacks[HOOK_WATCH]?.delete(callback);
      };
    }
    throw new InvalidHookError(this.constructor.name, type);
  }
}
var isRef = (value) => isObjectOfType(value, TYPE_REF);
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
            watcher.on(HOOK_CLEANUP, cleanup2);
        }).catch((error) => {
          if (!isAbortError(error))
            console.error("Async effect error:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.on(HOOK_CLEANUP, cleanup);
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
// src/match.ts
function match(result, handlers) {
  try {
    if (result.pending)
      handlers.nil?.();
    else if (result.errors)
      handlers.err?.(result.errors);
    else if (result.ok)
      handlers.ok(result.values);
  } catch (e) {
    const error = createError(e);
    if (handlers.err && (!result.errors || !result.errors.includes(error)))
      handlers.err(result.errors ? [...result.errors, error] : [error]);
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
      errors.push(createError(e));
    }
  }
  if (pending)
    return { ok: false, pending: true };
  if (errors.length > 0)
    return { ok: false, errors };
  return { ok: true, values };
}
export {
  valueString,
  validateSignalValue,
  validateCallback,
  triggerHook,
  trackSignalReads,
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
  isRef,
  isRecordOrArray,
  isRecord,
  isObjectOfType,
  isNumber,
  isMutableSignal,
  isMemoCallback,
  isList,
  isHandledHook,
  isFunction,
  isEqual,
  isComputed,
  isCollection,
  isAsyncFunction,
  isAbortError,
  guardMutableSignal,
  flushPendingReactions,
  diff,
  createWatcher,
  createStore,
  createSignal,
  createError,
  createEffect,
  createComputed,
  batchSignalWrites,
  UNSET,
  Task,
  TYPE_STORE,
  TYPE_STATE,
  TYPE_REF,
  TYPE_LIST,
  TYPE_COMPUTED,
  TYPE_COLLECTION,
  State,
  Ref,
  ReadonlySignalError,
  NullishSignalValueError,
  Memo,
  List,
  InvalidSignalValueError,
  InvalidCollectionSourceError,
  InvalidCallbackError,
  HOOK_WATCH,
  HOOK_SORT,
  HOOK_REMOVE,
  HOOK_CLEANUP,
  HOOK_CHANGE,
  HOOK_ADD,
  DuplicateKeyError,
  DerivedCollection,
  CircularDependencyError,
  BaseStore
};
