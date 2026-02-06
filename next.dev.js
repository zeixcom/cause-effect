// src/graph.ts
var TYPE_STATE = "State";
var TYPE_MEMO = "Memo";
var TYPE_TASK = "Task";
var FLAG_CLEAN = 0;
var FLAG_CHECK = 1 << 0;
var FLAG_DIRTY = 1 << 1;
var FLAG_RUNNING = 1 << 2;
var activeSink = null;
var activeOwner = null;
var queuedEffects = [];
var batchDepth = 0;
var flushing = false;
var defaultEquals = (a, b) => a === b;
var isFunction = (fn) => typeof fn === "function";
var isValidEdge = (checkEdge, node) => {
  const sourcesTail = node.sourcesTail;
  if (sourcesTail) {
    let edge = node.sources;
    while (edge) {
      if (edge === checkEdge)
        return true;
      if (edge === sourcesTail)
        break;
      edge = edge.nextSource;
    }
  }
  return false;
};
var link = (source, sink) => {
  const prevSource = sink.sourcesTail;
  if (prevSource?.source === source)
    return;
  let nextSource = null;
  const isRecomputing = sink.flags & FLAG_RUNNING;
  if (isRecomputing) {
    nextSource = prevSource ? prevSource.nextSource : sink.sources;
    if (nextSource?.source === source) {
      sink.sourcesTail = nextSource;
      return;
    }
  }
  const prevSink = source.sinksTail;
  if (prevSink?.sink === sink && (!isRecomputing || isValidEdge(prevSink, sink)))
    return;
  const newEdge = { source, sink, nextSource, prevSink, nextSink: null };
  sink.sourcesTail = source.sinksTail = newEdge;
  if (prevSource)
    prevSource.nextSource = newEdge;
  else
    sink.sources = newEdge;
  if (prevSink)
    prevSink.nextSink = newEdge;
  else
    source.sinks = newEdge;
};
var unlink = (edge) => {
  const { source, nextSource, nextSink, prevSink } = edge;
  if (nextSink)
    nextSink.prevSink = prevSink;
  else
    source.sinksTail = prevSink;
  if (prevSink)
    prevSink.nextSink = nextSink;
  else
    source.sinks = nextSink;
  if (!source.sinks && source.stop) {
    source.stop();
    source.stop = undefined;
  }
  return nextSource;
};
var trimSources = (node) => {
  const tail = node.sourcesTail;
  let source = tail ? tail.nextSource : node.sources;
  while (source)
    source = unlink(source);
  if (tail)
    tail.nextSource = null;
  else
    node.sources = null;
};
var propagate = (node, newFlag = FLAG_DIRTY) => {
  const flags = node.flags;
  if ("sinks" in node) {
    if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag)
      return;
    node.flags = flags | newFlag;
    if ("controller" in node && node.controller) {
      node.controller.abort();
      node.controller = undefined;
    }
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink, FLAG_CHECK);
  } else {
    if (flags & FLAG_DIRTY)
      return;
    node.flags = FLAG_DIRTY;
    queuedEffects.push(node);
  }
};
var setState = (node, next) => {
  if (node.equals(node.value, next))
    return;
  node.value = next;
  for (let e = node.sinks;e; e = e.nextSink)
    propagate(e.sink);
  if (batchDepth === 0)
    flush();
};
var registerCleanup = (owner, fn) => {
  if (!owner.cleanup)
    owner.cleanup = fn;
  else if (Array.isArray(owner.cleanup))
    owner.cleanup.push(fn);
  else
    owner.cleanup = [owner.cleanup, fn];
};
var runCleanup = (owner) => {
  if (!owner.cleanup)
    return;
  if (Array.isArray(owner.cleanup))
    for (let i = 0;i < owner.cleanup.length; i++)
      owner.cleanup[i]();
  else
    owner.cleanup();
  owner.cleanup = null;
};
var recomputeMemo = (node) => {
  const prevWatcher = activeSink;
  activeSink = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  let changed = false;
  try {
    const next = node.fn(node.value);
    if (node.error || !node.equals(next, node.value)) {
      node.value = next;
      node.error = undefined;
      changed = true;
    }
  } catch (err) {
    changed = true;
    node.error = err instanceof Error ? err : new Error(String(err));
  } finally {
    activeSink = prevWatcher;
    trimSources(node);
  }
  if (changed) {
    for (let e = node.sinks;e; e = e.nextSink)
      if (e.sink.flags & FLAG_CHECK)
        e.sink.flags |= FLAG_DIRTY;
  }
  node.flags = FLAG_CLEAN;
};
var recomputeTask = (node) => {
  node.controller?.abort();
  const controller = new AbortController;
  node.controller = controller;
  node.error = undefined;
  const prevWatcher = activeSink;
  activeSink = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  let promise;
  try {
    promise = node.fn(node.value, controller.signal);
  } catch (err) {
    node.controller = undefined;
    node.error = err instanceof Error ? err : new Error(String(err));
    return;
  } finally {
    activeSink = prevWatcher;
    trimSources(node);
  }
  promise.then((next) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    if (node.error || !node.equals(next, node.value)) {
      node.value = next;
      node.error = undefined;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
    }
  }, (err) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    const error = err instanceof Error ? err : new Error(String(err));
    if (!node.error || error.name !== node.error.name || error.message !== node.error.message) {
      node.error = error;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
    }
  });
  node.flags = FLAG_CLEAN;
};
var runEffect = (node) => {
  runCleanup(node);
  const prevContext = activeSink;
  const prevOwner = activeOwner;
  activeSink = activeOwner = node;
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  try {
    const out = node.fn();
    if (typeof out === "function")
      registerCleanup(node, out);
  } finally {
    activeSink = prevContext;
    activeOwner = prevOwner;
    trimSources(node);
  }
  node.flags = FLAG_CLEAN;
};
var refresh = (node) => {
  if (node.flags & FLAG_CHECK) {
    for (let e = node.sources;e; e = e.nextSource) {
      if ("fn" in e.source)
        refresh(e.source);
      if (node.flags & FLAG_DIRTY)
        break;
    }
  }
  if (node.flags & FLAG_RUNNING) {
    throw new CircularDependencyError("controller" in node ? TYPE_TASK : ("value" in node) ? TYPE_MEMO : "Effect");
  }
  if (node.flags & FLAG_DIRTY) {
    if ("controller" in node)
      recomputeTask(node);
    else if ("value" in node)
      recomputeMemo(node);
    else
      runEffect(node);
  } else {
    node.flags = FLAG_CLEAN;
  }
};
var flush = () => {
  if (flushing)
    return;
  flushing = true;
  try {
    for (let i = 0;i < queuedEffects.length; i++) {
      const effect = queuedEffects[i];
      if (effect.flags & FLAG_DIRTY)
        refresh(effect);
    }
    queuedEffects.length = 0;
  } finally {
    flushing = false;
  }
};
var batch = (fn) => {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0)
      flush();
  }
};
var createScope = (fn) => {
  const prevOwner = activeOwner;
  const scope = { cleanup: null };
  activeOwner = scope;
  try {
    const result = fn((cleanupFn) => registerCleanup(scope, cleanupFn));
    const dispose = () => runCleanup(scope);
    if (prevOwner)
      registerCleanup(prevOwner, dispose);
    return [result, dispose];
  } finally {
    activeOwner = prevOwner;
  }
};
var valueString = (value) => typeof value === "string" ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);
var validateSignalValue = (where, value, guard) => {
  if (value == null)
    throw new NullishSignalValueError(where);
  if (guard && !guard(value))
    throw new InvalidSignalValueError(where, value);
};
var validateCallback = (where, value, guard = isFunction) => {
  if (!guard(value))
    throw new InvalidCallbackError(where, value);
};

class CircularDependencyError extends Error {
  constructor(where) {
    super(`[${where}] Circular dependency detected`);
    this.name = "CircularDependencyError";
  }
}

class NullishSignalValueError extends TypeError {
  constructor(where) {
    super(`[${where}] Signal value cannot be null or undefined`);
    this.name = "NullishSignalValueError";
  }
}

class InvalidSignalValueError extends TypeError {
  constructor(where, value) {
    super(`[${where}] Signal value ${valueString(value)} is invalid`);
    this.name = "InvalidSignalValueError";
  }
}

class InvalidCallbackError extends TypeError {
  constructor(where, value) {
    super(`[${where}] Callback ${valueString(value)} is invalid`);
    this.name = "InvalidCallbackError";
  }
}
// src/util.ts
var isString = (value) => typeof value === "string";
var isNumber = (value) => typeof value === "number";
var isSymbol = (value) => typeof value === "symbol";
var isFunction2 = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction2(fn) && fn.constructor.name === "AsyncFunction";
var isSyncFunction = (fn) => isFunction2(fn) && fn.constructor.name !== "AsyncFunction";
var isNonNullObject = (value) => value != null && typeof value === "object";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isRecord = (value) => isObjectOfType(value, "Object");
var isRecordOrArray = (value) => isRecord(value) || Array.isArray(value);

// src/nodes/state.ts
var createState = (value, options) => {
  validateSignalValue(TYPE_STATE, value, options?.guard);
  const node = {
    value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? defaultEquals,
    guard: options?.guard
  };
  const state = {
    [Symbol.toStringTag]: TYPE_STATE,
    get() {
      if (activeSink)
        link(node, activeSink);
      return node.value;
    },
    set(next) {
      validateSignalValue(TYPE_STATE, next, node.guard);
      setState(node, next);
    },
    update(fn) {
      validateCallback(TYPE_STATE, fn);
      const next = fn(node.value);
      validateSignalValue(TYPE_STATE, next, node.guard);
      setState(node, next);
    }
  };
  return state;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/nodes/list.ts
var TYPE_LIST = "List";

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`Could not add ${where} key "${key}"${value ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}
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
      remove[key] = null;
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
var createList = (initialValue, options) => {
  validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
  const signals = new Map;
  let keys = [];
  let keyCounter = 0;
  const keyConfig = options?.keyConfig;
  const generateKey = isString(keyConfig) ? () => `${keyConfig}${keyCounter++}` : isFunction2(keyConfig) ? (item) => keyConfig(item) : () => String(keyCounter++);
  const node = {
    value: initialValue,
    sinks: null,
    sinksTail: null,
    stop: undefined
  };
  const notify = () => {
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  const linkList = () => {
    if (activeSink) {
      if (!node.sinks && options?.watched)
        node.stop = options.watched();
      link(node, activeSink);
    }
  };
  const addSignal = (key, value) => {
    validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value);
    signals.set(key, createState(value));
  };
  const toRecord = (array) => {
    const record = {};
    for (let i = 0;i < array.length; i++) {
      const value = array[i];
      if (value === undefined)
        continue;
      let key = keys[i];
      if (!key) {
        key = generateKey(value);
        keys[i] = key;
      }
      record[key] = value;
    }
    return record;
  };
  const assembleValue = () => {
    return keys.map((key) => signals.get(key)?.get()).filter((v) => v !== undefined);
  };
  const applyChanges = (changes) => {
    for (const key in changes.add) {
      addSignal(key, changes.add[key]);
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value);
          const signal = signals.get(key);
          if (signal)
            signal.set(value);
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      const index = keys.indexOf(key);
      if (index !== -1)
        keys.splice(index, 1);
    }
    if (Object.keys(changes.remove).length) {
      keys = keys.filter(() => true);
    }
    return changes.changed;
  };
  const initRecord = toRecord(initialValue);
  for (const key in initRecord) {
    addSignal(key, initRecord[key]);
  }
  const list = {
    [Symbol.toStringTag]: TYPE_LIST,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      for (const key of keys) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      linkList();
      return keys.length;
    },
    get() {
      linkList();
      return assembleValue();
    },
    set(newValue) {
      const currentValue = assembleValue();
      const changes = diff(toRecord(currentValue), toRecord(newValue));
      if (applyChanges(changes))
        notify();
    },
    update(fn) {
      list.set(fn(list.get()));
    },
    at(index) {
      return signals.get(keys[index]);
    },
    keys() {
      linkList();
      return keys.values();
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return keys[index];
    },
    indexOfKey(key) {
      return keys.indexOf(key);
    },
    add(value) {
      const key = generateKey(value);
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_LIST, key, value);
      if (!keys.includes(key))
        keys.push(key);
      addSignal(key, value);
      notify();
      return key;
    },
    remove(keyOrIndex) {
      const key = isNumber(keyOrIndex) ? keys[keyOrIndex] : keyOrIndex;
      const ok = signals.delete(key);
      if (ok) {
        const index = isNumber(keyOrIndex) ? keyOrIndex : keys.indexOf(key);
        if (index >= 0)
          keys.splice(index, 1);
        keys = keys.filter(() => true);
        notify();
      }
    },
    sort(compareFn) {
      const entries = keys.map((key) => [key, signals.get(key)?.get()]).sort(isFunction2(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
      const newOrder = entries.map(([key]) => key);
      if (!isEqual(keys, newOrder)) {
        keys = newOrder;
        notify();
      }
    },
    splice(start, deleteCount, ...items) {
      const length = keys.length;
      const actualStart = start < 0 ? Math.max(0, length + start) : Math.min(start, length);
      const actualDeleteCount = Math.max(0, Math.min(deleteCount ?? Math.max(0, length - Math.max(0, actualStart)), length - actualStart));
      const add = {};
      const remove = {};
      for (let i = 0;i < actualDeleteCount; i++) {
        const index = actualStart + i;
        const key = keys[index];
        if (key) {
          const signal = signals.get(key);
          if (signal)
            remove[key] = signal.get();
        }
      }
      const newOrder = keys.slice(0, actualStart);
      for (const item of items) {
        const key = generateKey(item);
        newOrder.push(key);
        add[key] = item;
      }
      newOrder.push(...keys.slice(actualStart + actualDeleteCount));
      const changed = !!(Object.keys(add).length || Object.keys(remove).length);
      if (changed) {
        applyChanges({
          add,
          change: {},
          remove,
          changed
        });
        keys = newOrder.filter(() => true);
        notify();
      }
      return Object.values(remove);
    },
    deriveCollection(cb) {
      return createCollection(list, cb);
    }
  };
  return list;
};
var isList = (value) => isObjectOfType(value, TYPE_LIST);

// src/nodes/memo.ts
var createMemo = (fn, options) => {
  validateCallback(TYPE_MEMO, fn, isSyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_MEMO, options.value, options?.guard);
  const node = {
    fn,
    value: options?.value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? defaultEquals,
    error: undefined
  };
  return {
    [Symbol.toStringTag]: TYPE_MEMO,
    get() {
      if (activeSink)
        link(node, activeSink);
      refresh(node);
      if (node.error)
        throw node.error;
      return node.value;
    }
  };
};
var isMemo = (value) => isObjectOfType(value, TYPE_MEMO);

// src/nodes/task.ts
var createTask = (fn, options) => {
  validateCallback(TYPE_TASK, fn, isAsyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_TASK, options.value, options?.guard);
  const node = {
    fn,
    value: options?.value,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    flags: FLAG_DIRTY,
    equals: options?.equals ?? defaultEquals,
    controller: undefined,
    error: undefined
  };
  return {
    [Symbol.toStringTag]: TYPE_TASK,
    get() {
      if (activeSink)
        link(node, activeSink);
      refresh(node);
      if (node.error)
        throw node.error;
      return node.value;
    },
    isPending() {
      return !node.controller;
    },
    abort() {
      node.controller?.abort();
      node.controller = undefined;
    }
  };
};
var isTask = (value) => isObjectOfType(value, TYPE_TASK);

// src/nodes/collection.ts
var TYPE_COLLECTION = "Collection";
function createCollection(source, callback) {
  validateCallback(TYPE_COLLECTION, callback);
  if (!isCollectionSource(source))
    throw new TypeError(`[${TYPE_COLLECTION}] Invalid collection source: expected a List or Collection`);
  const isAsync = isAsyncFunction(callback);
  const signals = new Map;
  let keys = [];
  const node = {
    value: [],
    sinks: null,
    sinksTail: null,
    stop: undefined
  };
  const notifyCollection = () => {
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  const linkCollection = () => {
    if (activeSink)
      link(node, activeSink);
  };
  const addSignal = (key) => {
    const signal = isAsync ? createTask(async (_prev, abort) => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return _prev;
      return callback(sourceValue, abort);
    }) : createMemo(() => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return;
      return callback(sourceValue);
    });
    signals.set(key, signal);
  };
  const sourceKeysMemo = createMemo(() => {
    return Array.from(source.keys());
  });
  const sync = () => {
    const newKeys = sourceKeysMemo.get();
    const oldKeySet = new Set(keys);
    const newKeySet = new Set(newKeys);
    let changed = false;
    for (const key of keys) {
      if (!newKeySet.has(key)) {
        signals.delete(key);
        changed = true;
      }
    }
    for (const key of newKeys) {
      if (!oldKeySet.has(key)) {
        addSignal(key);
        changed = true;
      }
    }
    if (!changed && keys.length === newKeys.length) {
      for (let i = 0;i < keys.length; i++) {
        if (keys[i] !== newKeys[i]) {
          changed = true;
          break;
        }
      }
    }
    keys = newKeys;
    if (changed)
      notifyCollection();
  };
  for (const key of Array.from(source.keys())) {
    addSignal(key);
    keys.push(key);
  }
  const collection = {
    [Symbol.toStringTag]: TYPE_COLLECTION,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      for (const key of keys) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      linkCollection();
      sync();
      return keys.length;
    },
    keys() {
      linkCollection();
      sync();
      return keys.values();
    },
    get() {
      linkCollection();
      sync();
      return keys.map((key) => {
        try {
          return signals.get(key)?.get();
        } catch {
          return;
        }
      }).filter((v) => v != null);
    },
    at(index) {
      return signals.get(keys[index]);
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return keys[index];
    },
    indexOfKey(key) {
      return keys.indexOf(key);
    },
    deriveCollection(cb) {
      return createCollection(collection, cb);
    }
  };
  return collection;
}
var isCollection = (value) => isObjectOfType(value, TYPE_COLLECTION);
var isCollectionSource = (value) => isList(value) || isCollection(value);
// src/nodes/effect.ts
var createEffect = (fn) => {
  validateCallback("Effect", fn);
  const node = {
    fn,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    cleanup: null
  };
  const dispose = () => {
    runCleanup(node);
    node.fn = undefined;
    node.flags = FLAG_CLEAN;
    node.sourcesTail = null;
    trimSources(node);
  };
  if (activeOwner)
    registerCleanup(activeOwner, dispose);
  runEffect(node);
  return dispose;
};
var match = (signals, handlers) => {
  if (!activeOwner)
    throw new Error("match() must be called inside an effect");
  const owner = activeOwner;
  const { ok, err = console.error, nil } = handlers;
  let errors;
  let pending = false;
  const values = new Array(signals.length);
  for (let i = 0;i < signals.length; i++) {
    try {
      const value = signals[i].get();
      if (value == null)
        pending = true;
      else
        values[i] = value;
    } catch (e) {
      if (!errors)
        errors = [];
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  let out;
  try {
    if (pending)
      out = nil?.();
    else if (errors)
      out = err(errors);
    else
      out = ok(values);
  } catch (e) {
    err([e instanceof Error ? e : new Error(String(e))]);
  }
  if (typeof out === "function")
    return out;
  if (out instanceof Promise) {
    const controller = new AbortController;
    registerCleanup(owner, () => controller.abort());
    out.then((cleanup) => {
      if (!controller.signal.aborted && typeof cleanup === "function")
        registerCleanup(owner, cleanup);
    }).catch((e) => {
      err([e instanceof Error ? e : new Error(String(e))]);
    });
  }
};
// src/nodes/ref.ts
var createRef = (value, start) => {
  const node = {
    value,
    sinks: null,
    sinksTail: null,
    stop: undefined
  };
  const notify = () => {
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  const ref = {
    [Symbol.toStringTag]: TYPE_MEMO,
    get() {
      if (activeSink) {
        if (!node.sinks)
          node.stop = start(notify);
        link(node, activeSink);
      }
      return node.value;
    }
  };
  return ref;
};
// src/nodes/sensor.ts
var createSensor = (start, options) => {
  const node = {
    value: undefined,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? defaultEquals,
    guard: options?.guard,
    stop: undefined
  };
  const set = (next) => {
    validateSignalValue("Sensor", next, node.guard);
    setState(node, next);
  };
  const sensor = {
    [Symbol.toStringTag]: TYPE_MEMO,
    get() {
      if (activeSink) {
        if (!node.sinks)
          node.stop = start(set);
        link(node, activeSink);
      }
      return node.value;
    }
  };
  return sensor;
};
// src/nodes/store.ts
var TYPE_STORE = "Store";

class DuplicateKeyError2 extends Error {
  constructor(where, key, value) {
    super(`Could not add ${where} key "${key}"${value ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}
var isEqual2 = (a, b, visited) => {
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
        if (!isEqual2(a[i], b[i], visited))
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
        if (!isEqual2(a[key], b[key], visited))
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
var diff2 = (oldObj, newObj) => {
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
      remove[key] = null;
      continue;
    }
    const oldValue = oldObj[key];
    const newValue = newObj[key];
    if (!isEqual2(oldValue, newValue, visited))
      change[key] = newValue;
  }
  return {
    add,
    change,
    remove,
    changed: !!(Object.keys(add).length || Object.keys(change).length || Object.keys(remove).length)
  };
};
var createStore = (initialValue, options) => {
  validateSignalValue(TYPE_STORE, initialValue, isRecord);
  const signals = new Map;
  const node = {
    value: initialValue,
    sinks: null,
    sinksTail: null,
    stop: undefined
  };
  const notify = () => {
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  const linkStore = () => {
    if (activeSink) {
      if (!node.sinks && options?.watched)
        node.stop = options.watched();
      link(node, activeSink);
    }
  };
  const addSignal = (key, value) => {
    validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
    if (Array.isArray(value))
      signals.set(key, createList(value));
    else if (isRecord(value))
      signals.set(key, createStore(value));
    else
      signals.set(key, createState(value));
  };
  const assembleValue = () => {
    const record = {};
    signals.forEach((signal, key) => {
      record[key] = signal.get();
    });
    return record;
  };
  const applyChanges = (changes) => {
    for (const key in changes.add) {
      addSignal(key, changes.add[key]);
    }
    if (Object.keys(changes.change).length) {
      batch(() => {
        for (const key in changes.change) {
          const value = changes.change[key];
          validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
          const signal = signals.get(key);
          if (signal) {
            if (isRecord(value) !== isStore(signal)) {
              addSignal(key, value);
            } else {
              signal.set(value);
            }
          }
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
    }
    return changes.changed;
  };
  for (const key of Object.keys(initialValue)) {
    addSignal(key, initialValue[key]);
  }
  const store = {
    [Symbol.toStringTag]: TYPE_STORE,
    [Symbol.isConcatSpreadable]: false,
    *[Symbol.iterator]() {
      for (const key of Array.from(signals.keys())) {
        const signal = signals.get(key);
        if (signal)
          yield [key, signal];
      }
    },
    keys() {
      linkStore();
      return signals.keys();
    },
    byKey(key) {
      return signals.get(key);
    },
    get() {
      linkStore();
      return assembleValue();
    },
    set(newValue) {
      const currentValue = assembleValue();
      const changed = applyChanges(diff2(currentValue, newValue));
      if (changed)
        notify();
    },
    update(fn) {
      store.set(fn(store.get()));
    },
    add(key, value) {
      if (signals.has(key))
        throw new DuplicateKeyError2(TYPE_STORE, key, value);
      addSignal(key, value);
      notify();
      return key;
    },
    remove(key) {
      const ok = signals.delete(key);
      if (ok)
        notify();
    }
  };
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target) {
        const value = Reflect.get(target, prop);
        return isFunction2(value) ? value.bind(target) : value;
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
export {
  match,
  isTask,
  isStore,
  isState,
  isMemo,
  isList,
  isEqual,
  isCollection,
  diff,
  createTask,
  createStore,
  createState,
  createSensor,
  createScope,
  createRef,
  createMemo,
  createList,
  createEffect,
  createCollection,
  batch
};
