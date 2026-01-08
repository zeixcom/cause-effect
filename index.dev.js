// src/system.ts
var activeWatcher;
var watchersMap = new WeakMap;
var watchedCallbackMap = new WeakMap;
var unwatchedCallbackMap = new WeakMap;
var pendingReactions = new Set;
var batchDepth = 0;
var UNSET = Symbol();
var createWatcher = (push, pull) => {
  const cleanups = new Set;
  const watcher = push;
  watcher.run = () => {
    const prev = activeWatcher;
    activeWatcher = watcher;
    try {
      pull();
    } finally {
      activeWatcher = prev;
    }
  };
  watcher.onCleanup = (cleanup) => {
    cleanups.add(cleanup);
  };
  watcher.stop = () => {
    try {
      for (const cleanup of cleanups)
        cleanup();
    } finally {
      cleanups.clear();
    }
  };
  return watcher;
};
var untrack = (callback) => {
  const prev = activeWatcher;
  activeWatcher = undefined;
  try {
    callback();
  } finally {
    activeWatcher = prev;
  }
};
var registerWatchCallbacks = (signal, watched, unwatched) => {
  watchedCallbackMap.set(signal, watched);
  if (unwatched)
    unwatchedCallbackMap.set(signal, unwatched);
};
var subscribeTo = (signal) => {
  if (!activeWatcher || watchersMap.get(signal)?.has(activeWatcher))
    return false;
  const watcher = activeWatcher;
  if (!watchersMap.has(signal))
    watchersMap.set(signal, new Set);
  const watchers = watchersMap.get(signal);
  assert(watchers);
  if (!watchers.size) {
    const watchedCallback = watchedCallbackMap.get(signal);
    if (watchedCallback)
      untrack(watchedCallback);
  }
  watchers.add(watcher);
  watcher.onCleanup(() => {
    watchers.delete(watcher);
    if (!watchers.size) {
      const unwatchedCallback = unwatchedCallbackMap.get(signal);
      if (unwatchedCallback)
        untrack(unwatchedCallback);
    }
  });
  return true;
};
var unsubscribeAllFrom = (signal) => {
  const watchers = watchersMap.get(signal);
  if (!watchers)
    return;
  for (const watcher of watchers)
    watcher.stop();
  watchers.clear();
};
var notifyOf = (signal) => {
  const watchers = watchersMap.get(signal);
  if (!watchers?.size)
    return false;
  for (const react of watchers) {
    if (batchDepth)
      pendingReactions.add(react);
    else
      react();
  }
  return true;
};
var flush = () => {
  while (pendingReactions.size) {
    const watchers = Array.from(pendingReactions);
    pendingReactions.clear();
    for (const react of watchers)
      react();
  }
};
var batch = (callback) => {
  batchDepth++;
  try {
    callback();
  } finally {
    flush();
    batchDepth--;
  }
};
var track = (watcher, run) => {
  const prev = activeWatcher;
  activeWatcher = watcher || undefined;
  try {
    run();
  } finally {
    activeWatcher = prev;
  }
};

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
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #watcher;
  constructor(callback, options) {
    validateCallback(this.constructor.name, callback, isMemoCallback);
    const initialValue = options?.initialValue ?? UNSET;
    validateSignalValue(this.constructor.name, initialValue, options?.guard);
    this.#callback = callback;
    this.#value = initialValue;
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  #getWatcher() {
    this.#watcher ||= createWatcher(() => {
      this.#dirty = true;
      if (!notifyOf(this))
        this.#watcher?.stop();
    }, () => {
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
    this.#watcher.onCleanup(() => {
      this.#watcher = undefined;
    });
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeTo(this);
    flush();
    if (this.#dirty)
      this.#getWatcher().run();
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
}

class Task {
  #callback;
  #value;
  #error;
  #dirty = true;
  #computing = false;
  #changed = false;
  #watcher;
  #controller;
  constructor(callback, options) {
    validateCallback(this.constructor.name, callback, isTaskCallback);
    const initialValue = options?.initialValue ?? UNSET;
    validateSignalValue(this.constructor.name, initialValue, options?.guard);
    this.#callback = callback;
    this.#value = initialValue;
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  #getWatcher() {
    if (!this.#watcher) {
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
        if (this.#changed && !notifyOf(this))
          this.#watcher?.stop();
      };
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        this.#controller?.abort();
        if (!notifyOf(this))
          this.#watcher?.stop();
      }, () => {
        if (this.#computing)
          throw new CircularDependencyError("task");
        this.#changed = false;
        if (this.#controller)
          return this.#value;
        this.#controller = new AbortController;
        this.#controller.signal.addEventListener("abort", () => {
          this.#computing = false;
          this.#controller = undefined;
          this.#getWatcher().run();
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
      this.#watcher.onCleanup(() => {
        this.#controller?.abort();
        this.#controller = undefined;
        this.#watcher = undefined;
      });
    }
    return this.#watcher;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COMPUTED;
  }
  get() {
    subscribeTo(this);
    flush();
    if (this.#dirty)
      this.#getWatcher().run();
    if (this.#error)
      throw this.#error;
    return this.#value;
  }
}
var createComputed = (callback, options) => isAsyncFunction(callback) ? new Task(callback, options) : new Memo(callback, options);
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isMemoCallback = (value) => isSyncFunction(value) && value.length < 2;
var isTaskCallback = (value) => isAsyncFunction(value) && value.length < 3;

// src/classes/state.ts
var TYPE_STATE = "State";

class State {
  #value;
  constructor(initialValue, options) {
    validateSignalValue(TYPE_STATE, initialValue, options?.guard);
    this.#value = initialValue;
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  get [Symbol.toStringTag]() {
    return TYPE_STATE;
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  set(newValue) {
    validateSignalValue(TYPE_STATE, newValue);
    if (isEqual(this.#value, newValue))
      return;
    this.#value = newValue;
    notifyOf(this);
    if (UNSET === this.#value)
      unsubscribeAllFrom(this);
  }
  update(updater) {
    validateCallback(`${TYPE_STATE} update`, updater);
    this.set(updater(this.#value));
  }
}
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/classes/list.ts
var TYPE_LIST = "List";

class List {
  #signals = new Map;
  #keys = [];
  #generateKey;
  #validate;
  constructor(initialValue, options) {
    validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
    let keyCounter = 0;
    const keyConfig = options?.keyConfig;
    this.#generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction(keyConfig) ? (item) => keyConfig(item) : () => String(keyCounter++);
    this.#validate = (key, value) => {
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value, options?.guard);
      return true;
    };
    this.#change({
      add: this.#toRecord(initialValue),
      change: {},
      remove: {},
      changed: true
    });
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  #toRecord(array) {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = this.#keys[i];
      if (!key) {
        key = this.#generateKey(value);
        this.#keys[i] = key;
      }
      record[key] = value;
    }
    return record;
  }
  #add(key, value) {
    if (!this.#validate(key, value))
      return false;
    this.#signals.set(key, new State(value));
    return true;
  }
  #change(changes) {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.#add(key, changes.add[key]);
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.#validate(key, value))
            continue;
          const signal = this.#signals.get(key);
          if (guardMutableSignal(`${TYPE_LIST} item "${key}"`, value, signal))
            signal.set(value);
        }
      });
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove) {
        this.#signals.delete(key);
        const index = this.#keys.indexOf(key);
        if (index !== -1)
          this.#keys.splice(index, 1);
      }
      this.#keys = this.#keys.filter(() => true);
    }
    return changes.changed;
  }
  get #value() {
    return this.#keys.map((key) => this.#signals.get(key)?.get()).filter((v) => v !== undefined);
  }
  get [Symbol.toStringTag]() {
    return TYPE_LIST;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#keys) {
      const signal = this.#signals.get(key);
      if (signal)
        yield signal;
    }
  }
  get length() {
    subscribeTo(this);
    return this.#keys.length;
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#signals.clear();
      notifyOf(this);
      unsubscribeAllFrom(this);
      return;
    }
    const changes = diff(this.#toRecord(this.#value), this.#toRecord(newValue));
    if (this.#change(changes))
      notifyOf(this);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  at(index) {
    return this.#signals.get(this.#keys[index]);
  }
  keys() {
    subscribeTo(this);
    return this.#keys.values();
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  keyAt(index) {
    return this.#keys[index];
  }
  indexOfKey(key) {
    return this.#keys.indexOf(key);
  }
  add(value) {
    const key = this.#generateKey(value);
    if (this.#signals.has(key))
      throw new DuplicateKeyError("store", key, value);
    if (!this.#keys.includes(key))
      this.#keys.push(key);
    const ok = this.#add(key, value);
    if (ok)
      notifyOf(this);
    return key;
  }
  remove(keyOrIndex) {
    const key = isNumber(keyOrIndex) ? this.#keys[keyOrIndex] : keyOrIndex;
    const ok = this.#signals.delete(key);
    if (ok) {
      const index = isNumber(keyOrIndex) ? keyOrIndex : this.#keys.indexOf(key);
      if (index >= 0)
        this.#keys.splice(index, 1);
      this.#keys = this.#keys.filter(() => true);
      notifyOf(this);
    }
  }
  sort(compareFn) {
    const entries = this.#keys.map((key) => [key, this.#signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
    const newOrder = entries.map(([key]) => key);
    if (!isEqual(this.#keys, newOrder)) {
      this.#keys = newOrder;
      notifyOf(this);
    }
  }
  splice(start, deleteCount, ...items) {
    const length = this.#keys.length;
    const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
    const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
    const add = {};
    const remove = {};
    for (let i = 0;i < actualDeleteCount; i++) {
      const index = actualStart + i;
      const key = this.#keys[index];
      if (key) {
        const signal = this.#signals.get(key);
        if (signal)
          remove[key] = signal.get();
      }
    }
    const newOrder = this.#keys.slice(0, actualStart);
    for (const item of items) {
      const key = this.#generateKey(item);
      newOrder.push(key);
      add[key] = item;
    }
    newOrder.push(...this.#keys.slice(actualStart + actualDeleteCount));
    const changed = !!(Object.keys(add).length || Object.keys(remove).length);
    if (changed) {
      this.#change({
        add,
        change: {},
        remove,
        changed
      });
      this.#keys = newOrder.filter(() => true);
      notifyOf(this);
    }
    return Object.values(remove);
  }
  deriveCollection(callback, options) {
    return new DerivedCollection(this, callback, options);
  }
}
var isList = (value) => isObjectOfType(value, TYPE_LIST);

// src/classes/store.ts
var TYPE_STORE = "Store";

class BaseStore {
  #signals = new Map;
  constructor(initialValue, options) {
    validateSignalValue(TYPE_STORE, initialValue, options?.guard ?? isRecord);
    this.#change({
      add: initialValue,
      change: {},
      remove: {},
      changed: true
    });
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  get #value() {
    const record = {};
    for (const [key, signal] of this.#signals.entries())
      record[key] = signal.get();
    return record;
  }
  #validate(key, value) {
    validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
    return true;
  }
  #add(key, value) {
    if (!this.#validate(key, value))
      return false;
    this.#signals.set(key, createMutableSignal(value));
    return true;
  }
  #change(changes) {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.add(key, changes.add[key]);
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          if (!this.#validate(key, value))
            continue;
          const signal = this.#signals.get(key);
          if (guardMutableSignal(`list item "${key}"`, value, signal))
            signal.set(value);
        }
      });
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.remove(key);
    }
    return changes.changed;
  }
  get [Symbol.toStringTag]() {
    return TYPE_STORE;
  }
  get [Symbol.isConcatSpreadable]() {
    return false;
  }
  *[Symbol.iterator]() {
    for (const [key, signal] of this.#signals.entries())
      yield [key, signal];
  }
  keys() {
    subscribeTo(this);
    return this.#signals.keys();
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#signals.clear();
      notifyOf(this);
      unsubscribeAllFrom(this);
      return;
    }
    const changed = this.#change(diff(this.#value, newValue));
    if (changed)
      notifyOf(this);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  add(key, value) {
    if (this.#signals.has(key))
      throw new DuplicateKeyError(TYPE_STORE, key, value);
    const ok = this.#add(key, value);
    if (ok)
      notifyOf(this);
    return key;
  }
  remove(key) {
    const ok = this.#signals.delete(key);
    if (ok)
      notifyOf(this);
  }
}
var createStore = (initialValue, options) => {
  const instance = new BaseStore(initialValue, options);
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

class FailedAssertionError extends Error {
  constructor(message = "unexpected condition") {
    super(`Assertion failed: ${message}`);
    this.name = "FailedAssertionError";
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
function assert(condition, msg) {
  if (!condition)
    throw new FailedAssertionError(msg);
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
  #source;
  #callback;
  #signals = new Map;
  #keys = [];
  #dirty = true;
  #watcher;
  constructor(source, callback, options) {
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
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  #getWatcher() {
    this.#watcher ||= createWatcher(() => {
      this.#dirty = true;
      if (!notifyOf(this))
        this.#watcher?.stop();
    }, () => {
      const newKeys = Array.from(this.#source.keys());
      const allKeys = new Set([...this.#keys, ...newKeys]);
      const addedKeys = [];
      const removedKeys = [];
      for (const key of allKeys) {
        const oldHas = this.#keys.includes(key);
        const newHas = newKeys.includes(key);
        if (!oldHas && newHas)
          addedKeys.push(key);
        else if (oldHas && !newHas)
          removedKeys.push(key);
      }
      for (const key of removedKeys)
        this.#signals.delete(key);
      for (const key of addedKeys)
        this.#add(key);
      this.#keys = newKeys;
      this.#dirty = false;
    });
    this.#watcher.onCleanup(() => {
      this.#watcher = undefined;
    });
    return this.#watcher;
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
    if (!this.#keys.includes(key))
      this.#keys.push(key);
    return true;
  }
  get [Symbol.toStringTag]() {
    return TYPE_COLLECTION;
  }
  get [Symbol.isConcatSpreadable]() {
    return true;
  }
  *[Symbol.iterator]() {
    for (const key of this.#keys) {
      const signal = this.#signals.get(key);
      if (signal)
        yield signal;
    }
  }
  keys() {
    subscribeTo(this);
    if (this.#dirty)
      this.#getWatcher().run();
    return this.#keys.values();
  }
  get() {
    subscribeTo(this);
    if (this.#dirty)
      this.#getWatcher().run();
    return this.#keys.map((key) => this.#signals.get(key)?.get()).filter((v) => v != null && v !== UNSET);
  }
  at(index) {
    return this.#signals.get(this.#keys[index]);
  }
  byKey(key) {
    return this.#signals.get(key);
  }
  keyAt(index) {
    return this.#keys[index];
  }
  indexOfKey(key) {
    return this.#keys.indexOf(key);
  }
  deriveCollection(callback, options) {
    return new DerivedCollection(this, callback, options);
  }
  get length() {
    subscribeTo(this);
    if (this.#dirty)
      this.#getWatcher().run();
    return this.#keys.length;
  }
}
var isCollection = (value) => isObjectOfType(value, TYPE_COLLECTION);
var isCollectionSource = (value) => isList(value) || isCollection(value);
var isAsyncCollectionCallback = (callback) => isAsyncFunction(callback);
// src/classes/ref.ts
var TYPE_REF = "Ref";

class Ref {
  #value;
  constructor(value, options) {
    validateSignalValue(TYPE_REF, value, options?.guard);
    this.#value = value;
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
  }
  get [Symbol.toStringTag]() {
    return TYPE_REF;
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  notify() {
    notifyOf(this);
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
  const watcher = createWatcher(() => {
    watcher.run();
  }, () => {
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
            console.error("Error in async effect callback:", error);
        });
      } else {
        cleanup = callback();
        if (isFunction(cleanup))
          watcher.onCleanup(cleanup);
      }
    } catch (error) {
      if (!isAbortError(error))
        console.error("Error in effect callback:", error);
    }
    running = false;
  });
  watcher();
  return () => {
    controller?.abort();
    try {
      watcher.stop();
    } catch (error) {
      console.error("Error in effect cleanup:", error);
    }
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
  untrack,
  track,
  subscribeTo,
  resolve,
  notifyOf,
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
  isFunction,
  isEqual,
  isComputed,
  isCollection,
  isAsyncFunction,
  isAbortError,
  guardMutableSignal,
  flush,
  diff,
  createWatcher,
  createStore,
  createSignal,
  createError,
  createEffect,
  createComputed,
  batch,
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
  InvalidHookError,
  InvalidCollectionSourceError,
  InvalidCallbackError,
  DuplicateKeyError,
  DerivedCollection,
  CircularDependencyError,
  BaseStore
};
