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

// src/system.ts
var activeWatcher;
var watchersMap = new WeakMap;
var watchedCallbackMap = new WeakMap;
var unwatchedCallbackMap = new WeakMap;
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
var untrack = (run) => {
  const prev = activeWatcher;
  activeWatcher = undefined;
  try {
    run();
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
      untrack(() => watchedCallback(signal));
  }
  watchers.add(watcher);
  watcher.onCleanup(() => {
    watchers.delete(watcher);
    if (!watchers.size) {
      const unwatchedCallback = unwatchedCallbackMap.get(signal);
      if (unwatchedCallback)
        untrack(() => unwatchedCallback(signal));
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
var flushPendingReactions = () => {
  while (pendingReactions.size) {
    const watchers = Array.from(pendingReactions);
    pendingReactions.clear();
    for (const react of watchers)
      react();
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
  const errors = [];
  const throwError = (inCleanup) => {
    if (errors.length) {
      if (errors.length === 1)
        throw errors[0];
      throw new AggregateError(errors, `Errors in hook ${inCleanup ? "cleanup" : "callback"}:`);
    }
  };
  for (const callback of callbacks) {
    try {
      const cleanup = callback(payload);
      if (isFunction(cleanup))
        cleanups.push(cleanup);
    } catch (error) {
      errors.push(createError(error));
    }
  }
  throwError();
  if (!cleanups.length)
    return;
  if (cleanups.length === 1)
    return cleanups[0];
  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (error) {
        errors.push(createError(error));
      }
    }
    throwError(true);
  };
};
var isHandledHook = (type, handled) => handled.includes(type);

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
    if (!this.#watcher) {
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        if (!notifyOf(this))
          this.#watcher?.stop();
      });
      this.#watcher.onCleanup(() => {
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
      this.#watcher = createWatcher(() => {
        this.#dirty = true;
        this.#controller?.abort();
        if (!notifyOf(this))
          this.#watcher?.stop();
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
      if (this.#changed && !notifyOf(this))
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
}
var createComputed = (callback, options) => isAsyncFunction(callback) ? new Task(callback, options) : new Memo(callback, options);
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isMemoCallback = (value) => isSyncFunction(value) && value.length < 2;
var isTaskCallback = (value) => isAsyncFunction(value) && value.length < 3;

// src/classes/composite.ts
class Composite {
  signals = new Map;
  #validate;
  #create;
  constructor(values, validate, create) {
    this.#validate = validate;
    this.#create = create;
    this.change({
      add: values,
      change: {},
      remove: {},
      changed: true
    });
  }
  add(key, value) {
    if (!this.#validate(key, value))
      return false;
    this.signals.set(key, this.#create(value));
    return true;
  }
  remove(key) {
    return this.signals.delete(key);
  }
  change(changes) {
    if (Object.keys(changes.add).length) {
      for (const key in changes.add)
        this.add(key, changes.add[key]);
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
    }
    if (Object.keys(changes.remove).length) {
      for (const key in changes.remove)
        this.remove(key);
    }
    return changes.changed;
  }
  clear() {
    this.signals.clear();
    return true;
  }
}

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
  #composite;
  #order = [];
  #generateKey;
  constructor(initialValue, options) {
    validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
    let keyCounter = 0;
    const keyConfig = options?.keyConfig;
    this.#generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction(keyConfig) ? (item) => keyConfig(item) : () => String(keyCounter++);
    this.#composite = new Composite(this.#toRecord(initialValue), (key, value) => {
      validateSignalValue(`${TYPE_LIST} for key "${key}"`, value);
      return true;
    }, (value) => new State(value));
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
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
    subscribeTo(this);
    return this.#order.length;
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyOf(this);
      unsubscribeAllFrom(this);
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
      notifyOf(this);
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
      notifyOf(this);
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
      notifyOf(this);
    }
  }
  sort(compareFn) {
    const entries = this.#order.map((key) => [key, this.#composite.signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
    const newOrder = entries.map(([key]) => key);
    if (!isEqual(this.#order, newOrder)) {
      this.#order = newOrder;
      notifyOf(this);
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
      notifyOf(this);
    }
    return Object.values(remove);
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
  constructor(initialValue, options) {
    validateSignalValue(TYPE_STORE, initialValue, options?.guard ?? isRecord);
    this.#composite = new Composite(initialValue, (key, value) => {
      validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
      return true;
    }, (value) => createMutableSignal(value));
    if (options?.watched)
      registerWatchCallbacks(this, options.watched, options.unwatched);
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
  keys() {
    return this.#composite.signals.keys();
  }
  byKey(key) {
    return this.#composite.signals.get(key);
  }
  get() {
    subscribeTo(this);
    return this.#value;
  }
  set(newValue) {
    if (UNSET === newValue) {
      this.#composite.clear();
      notifyOf(this);
      unsubscribeAllFrom(this);
      return;
    }
    const oldValue = this.#value;
    const changed = this.#composite.change(diff(oldValue, newValue));
    if (changed)
      notifyOf(this);
  }
  update(fn) {
    this.set(fn(this.get()));
  }
  add(key, value) {
    if (this.#composite.signals.has(key))
      throw new DuplicateKeyError(TYPE_STORE, key, value);
    const ok = this.#composite.add(key, value);
    if (ok)
      notifyOf(this);
    return key;
  }
  remove(key) {
    const ok = this.#composite.remove(key);
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
  #order = [];
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
    return true;
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
    subscribeTo(this);
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
  deriveCollection(callback) {
    return new DerivedCollection(this, callback);
  }
  get length() {
    subscribeTo(this);
    return this.#order.length;
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
  }));
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
  triggerHook,
  trackSignalReads,
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
  InvalidHookError,
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
