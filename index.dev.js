// src/util.ts
function isFunction(fn) {
  return typeof fn === "function";
}
function isAsyncFunction(fn) {
  return isFunction(fn) && fn.constructor.name === "AsyncFunction";
}
function isSyncFunction(fn) {
  return isFunction(fn) && fn.constructor.name !== "AsyncFunction";
}
function isObjectOfType(value, type) {
  return Object.prototype.toString.call(value) === `[object ${type}]`;
}
function isRecord(value) {
  return isObjectOfType(value, "Object");
}
function isUniformArray(value, guard = (item) => item != null) {
  return Array.isArray(value) && value.every(guard);
}
function valueString(value) {
  return typeof value === "string" ? `"${value}"` : !!value && typeof value === "object" ? JSON.stringify(value) : String(value);
}

// src/errors.ts
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

class UnsetSignalValueError extends Error {
  constructor(where) {
    super(`[${where}] Signal value is unset`);
    this.name = "UnsetSignalValueError";
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

class RequiredOwnerError extends Error {
  constructor(where) {
    super(`[${where}] Active owner is required`);
    this.name = "RequiredOwnerError";
  }
}

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`[${where}] Could not add key "${key}"${value ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}
function validateSignalValue(where, value, guard) {
  if (value == null)
    throw new NullishSignalValueError(where);
  if (guard && !guard(value))
    throw new InvalidSignalValueError(where, value);
}
function validateReadValue(where, value) {
  if (value == null)
    throw new UnsetSignalValueError(where);
}
function validateCallback(where, value, guard = isFunction) {
  if (!guard(value))
    throw new InvalidCallbackError(where, value);
}
// src/graph.ts
var TYPE_STATE = "State";
var TYPE_MEMO = "Memo";
var TYPE_TASK = "Task";
var TYPE_SENSOR = "Sensor";
var TYPE_LIST = "List";
var TYPE_COLLECTION = "Collection";
var TYPE_STORE = "Store";
var FLAG_CLEAN = 0;
var FLAG_CHECK = 1 << 0;
var FLAG_DIRTY = 1 << 1;
var FLAG_RUNNING = 1 << 2;
var activeSink = null;
var activeOwner = null;
var queuedEffects = [];
var batchDepth = 0;
var flushing = false;
var DEFAULT_EQUALITY = (a, b) => a === b;
var SKIP_EQUALITY = (_a, _b) => false;
function isValidEdge(checkEdge, node) {
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
}
function link(source, sink) {
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
}
function unlink(edge) {
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
}
function trimSources(node) {
  const tail = node.sourcesTail;
  let source = tail ? tail.nextSource : node.sources;
  while (source)
    source = unlink(source);
  if (tail)
    tail.nextSource = null;
  else
    node.sources = null;
}
function propagate(node, newFlag = FLAG_DIRTY) {
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
}
function setState(node, next) {
  if (node.equals(node.value, next))
    return;
  node.value = next;
  for (let e = node.sinks;e; e = e.nextSink)
    propagate(e.sink);
  if (batchDepth === 0)
    flush();
}
function registerCleanup(owner, fn) {
  if (!owner.cleanup)
    owner.cleanup = fn;
  else if (Array.isArray(owner.cleanup))
    owner.cleanup.push(fn);
  else
    owner.cleanup = [owner.cleanup, fn];
}
function runCleanup(owner) {
  if (!owner.cleanup)
    return;
  if (Array.isArray(owner.cleanup))
    for (let i = 0;i < owner.cleanup.length; i++)
      owner.cleanup[i]();
  else
    owner.cleanup();
  owner.cleanup = null;
}
function recomputeMemo(node) {
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
}
function recomputeTask(node) {
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
}
function runEffect(node) {
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
}
function refresh(node) {
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
}
function flush() {
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
}
function batch(fn) {
  batchDepth++;
  try {
    fn();
  } finally {
    batchDepth--;
    if (batchDepth === 0)
      flush();
  }
}
function untrack(fn) {
  const prev = activeSink;
  activeSink = null;
  try {
    return fn();
  } finally {
    activeSink = prev;
  }
}
function createScope(fn) {
  const prevOwner = activeOwner;
  const scope = { cleanup: null };
  activeOwner = scope;
  try {
    const out = fn();
    if (typeof out === "function")
      registerCleanup(scope, out);
    const dispose = () => runCleanup(scope);
    if (prevOwner)
      registerCleanup(prevOwner, dispose);
    return dispose;
  } finally {
    activeOwner = prevOwner;
  }
}
// src/nodes/state.ts
function createState(value, options) {
  validateSignalValue(TYPE_STATE, value, options?.guard);
  const node = {
    value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    guard: options?.guard
  };
  return {
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
}
function isState(value) {
  return isObjectOfType(value, TYPE_STATE);
}

// src/nodes/list.ts
function isEqual(a, b, visited) {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a == null || typeof a !== "object" || b == null || typeof b !== "object")
    return false;
  if (!visited)
    visited = new WeakSet;
  if (visited.has(a) || visited.has(b))
    throw new CircularDependencyError("isEqual");
  visited.add(a);
  visited.add(b);
  try {
    const aIsArray = Array.isArray(a);
    if (aIsArray !== Array.isArray(b))
      return false;
    if (aIsArray) {
      const aa = a;
      const ba = b;
      if (aa.length !== ba.length)
        return false;
      for (let i = 0;i < aa.length; i++)
        if (!isEqual(aa[i], ba[i], visited))
          return false;
      return true;
    }
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
}
function keysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0;i < a.length; i++)
    if (a[i] !== b[i])
      return false;
  return true;
}
function getKeyGenerator(keyConfig) {
  let keyCounter = 0;
  const contentBased = typeof keyConfig === "function";
  return [
    typeof keyConfig === "string" ? () => `${keyConfig}${keyCounter++}` : contentBased ? (item) => keyConfig(item) || String(keyCounter++) : () => String(keyCounter++),
    contentBased
  ];
}
function diffArrays(prev, next, prevKeys, generateKey, contentBased) {
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const prevByKey = new Map;
  for (let i = 0;i < prev.length; i++) {
    const key = prevKeys[i];
    if (key && prev[i])
      prevByKey.set(key, prev[i]);
  }
  const seenKeys = new Set;
  for (let i = 0;i < next.length; i++) {
    const newValue = next[i];
    if (newValue === undefined)
      continue;
    const key = contentBased ? generateKey(newValue) : prevKeys[i] ?? generateKey(newValue);
    if (seenKeys.has(key))
      throw new DuplicateKeyError(TYPE_LIST, key, newValue);
    nextKeys.push(key);
    seenKeys.add(key);
    if (!prevByKey.has(key)) {
      add[key] = newValue;
      changed = true;
    } else {
      const oldValue = prevByKey.get(key);
      if (!isEqual(oldValue, newValue, visited)) {
        change[key] = newValue;
        changed = true;
      }
    }
  }
  for (const [key] of prevByKey) {
    if (!seenKeys.has(key)) {
      remove[key] = null;
      changed = true;
    }
  }
  if (!changed && !keysEqual(prevKeys, nextKeys))
    changed = true;
  return { add, change, remove, newKeys: nextKeys, changed };
}
function createList(initialValue, options) {
  validateSignalValue(TYPE_LIST, initialValue, Array.isArray);
  const signals = new Map;
  let keys = [];
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const buildValue = () => keys.map((key) => signals.get(key)?.get()).filter((v) => v !== undefined);
  const node = {
    fn: buildValue,
    value: initialValue,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: isEqual,
    error: undefined
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
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      const value = changes.add[key];
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value);
      signals.set(key, createState(value));
      structural = true;
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
      structural = true;
    }
    if (structural) {
      node.sources = null;
      node.sourcesTail = null;
    }
    return changes.changed;
  };
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
  const initRecord = toRecord(initialValue);
  for (const key in initRecord) {
    const value = initRecord[key];
    validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value);
    signals.set(key, createState(value));
  }
  node.value = initialValue;
  node.flags = 0;
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
      subscribe();
      return keys.length;
    },
    get() {
      subscribe();
      if (node.sources) {
        if (node.flags) {
          node.value = untrack(buildValue);
          node.flags = FLAG_CLEAN;
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value;
      const changes = diffArrays(prev, next, keys, generateKey, contentBased);
      if (changes.changed) {
        keys = changes.newKeys;
        applyChanges(changes);
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    update(fn) {
      list.set(fn(list.get()));
    },
    at(index) {
      return signals.get(keys[index]);
    },
    keys() {
      subscribe();
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
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value);
      signals.set(key, createState(value));
      node.sources = null;
      node.sourcesTail = null;
      node.flags |= FLAG_DIRTY;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(keyOrIndex) {
      const key = typeof keyOrIndex === "number" ? keys[keyOrIndex] : keyOrIndex;
      const ok = signals.delete(key);
      if (ok) {
        const index = typeof keyOrIndex === "number" ? keyOrIndex : keys.indexOf(key);
        if (index >= 0)
          keys.splice(index, 1);
        node.sources = null;
        node.sourcesTail = null;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    sort(compareFn) {
      const entries = keys.map((key) => [key, signals.get(key)?.get()]).sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
      const newOrder = entries.map(([key]) => key);
      if (!keysEqual(keys, newOrder)) {
        keys = newOrder;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
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
        if (signals.has(key) && !(key in remove))
          throw new DuplicateKeyError(TYPE_LIST, key, item);
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
        keys = newOrder;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
      return Object.values(remove);
    },
    deriveCollection(cb) {
      return deriveCollection(list, cb);
    }
  };
  return list;
}
function isList(value) {
  return isObjectOfType(value, TYPE_LIST);
}

// src/nodes/memo.ts
function createMemo(fn, options) {
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
    equals: options?.equals ?? DEFAULT_EQUALITY,
    error: undefined,
    stop: undefined
  };
  const start = options?.watched;
  const subscribe = start ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = start(() => {
          node.flags |= FLAG_DIRTY;
          for (let e = node.sinks;e; e = e.nextSink)
            propagate(e.sink);
          if (batchDepth === 0)
            flush();
        });
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
  return {
    [Symbol.toStringTag]: TYPE_MEMO,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(TYPE_MEMO, node.value);
      return node.value;
    }
  };
}
function isMemo(value) {
  return isObjectOfType(value, TYPE_MEMO);
}

// src/nodes/task.ts
function createTask(fn, options) {
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
    equals: options?.equals ?? DEFAULT_EQUALITY,
    controller: undefined,
    error: undefined,
    stop: undefined
  };
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched(() => {
          node.flags |= FLAG_DIRTY;
          for (let e = node.sinks;e; e = e.nextSink)
            propagate(e.sink);
          if (batchDepth === 0)
            flush();
        });
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
  return {
    [Symbol.toStringTag]: TYPE_TASK,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(TYPE_TASK, node.value);
      return node.value;
    },
    isPending() {
      return !!node.controller;
    },
    abort() {
      node.controller?.abort();
      node.controller = undefined;
    }
  };
}
function isTask(value) {
  return isObjectOfType(value, TYPE_TASK);
}

// src/nodes/collection.ts
function deriveCollection(source, callback) {
  validateCallback(TYPE_COLLECTION, callback);
  if (!isCollectionSource(source))
    throw new TypeError(`[${TYPE_COLLECTION}] Invalid collection source: expected a List or Collection`);
  const isAsync = isAsyncFunction(callback);
  const signals = new Map;
  const addSignal = (key) => {
    const signal = isAsync ? createTask(async (prev, abort) => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return prev;
      return callback(sourceValue, abort);
    }) : createMemo(() => {
      const sourceValue = source.byKey(key)?.get();
      if (sourceValue == null)
        return;
      return callback(sourceValue);
    });
    signals.set(key, signal);
  };
  function syncKeys() {
    const newKeys = Array.from(source.keys());
    const oldKeys = node.value;
    if (!keysEqual(oldKeys, newKeys)) {
      const oldKeySet = new Set(oldKeys);
      const newKeySet = new Set(newKeys);
      for (const key of oldKeys)
        if (!newKeySet.has(key))
          signals.delete(key);
      for (const key of newKeys)
        if (!oldKeySet.has(key))
          addSignal(key);
    }
    return newKeys;
  }
  const node = {
    fn: syncKeys,
    value: [],
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: keysEqual,
    error: undefined
  };
  function ensureSynced() {
    if (node.sources) {
      if (node.flags) {
        node.value = untrack(syncKeys);
        node.flags = FLAG_CLEAN;
      }
    } else {
      refresh(node);
      if (node.error)
        throw node.error;
    }
    return node.value;
  }
  const initialKeys = Array.from(source.keys());
  for (const key of initialKeys)
    addSignal(key);
  node.value = initialKeys;
  const collection = {
    [Symbol.toStringTag]: TYPE_COLLECTION,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      for (const key of node.value) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      if (activeSink)
        link(node, activeSink);
      return ensureSynced().length;
    },
    keys() {
      if (activeSink)
        link(node, activeSink);
      return ensureSynced().values();
    },
    get() {
      if (activeSink)
        link(node, activeSink);
      const currentKeys = ensureSynced();
      const result = [];
      for (const key of currentKeys) {
        try {
          const v = signals.get(key)?.get();
          if (v != null)
            result.push(v);
        } catch (e) {
          if (!(e instanceof UnsetSignalValueError))
            throw e;
        }
      }
      return result;
    },
    at(index) {
      return signals.get(node.value[index]);
    },
    byKey(key) {
      return signals.get(key);
    },
    keyAt(index) {
      return node.value[index];
    },
    indexOfKey(key) {
      return node.value.indexOf(key);
    },
    deriveCollection(cb) {
      return deriveCollection(collection, cb);
    }
  };
  return collection;
}
function createCollection(watched, options) {
  const initialValue = options?.value ?? [];
  if (initialValue.length)
    validateSignalValue(TYPE_COLLECTION, initialValue, Array.isArray);
  validateCallback(TYPE_COLLECTION, watched, isSyncFunction);
  const signals = new Map;
  const keys = [];
  const itemToKey = new Map;
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const resolveKey = (item) => itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined);
  const itemFactory = options?.createItem ?? ((_key, value) => createState(value));
  function buildValue() {
    const result = [];
    for (const key of keys) {
      try {
        const v = signals.get(key)?.get();
        if (v != null)
          result.push(v);
      } catch (e) {
        if (!(e instanceof UnsetSignalValueError))
          throw e;
      }
    }
    return result;
  }
  const node = {
    fn: buildValue,
    value: initialValue,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: SKIP_EQUALITY,
    error: undefined
  };
  function applyChanges(changes) {
    const { add, change, remove } = changes;
    if (!add?.length && !change?.length && !remove?.length)
      return;
    let structural = false;
    batch(() => {
      if (add) {
        for (const item of add) {
          const key = generateKey(item);
          signals.set(key, itemFactory(key, item));
          itemToKey.set(item, key);
          if (!keys.includes(key))
            keys.push(key);
          structural = true;
        }
      }
      if (change) {
        for (const item of change) {
          const key = resolveKey(item);
          if (!key)
            continue;
          const signal = signals.get(key);
          if (signal && isState(signal)) {
            const oldValue = signal.get();
            itemToKey.delete(oldValue);
            signal.set(item);
            itemToKey.set(item, key);
          }
        }
      }
      if (remove) {
        for (const item of remove) {
          const key = resolveKey(item);
          if (!key)
            continue;
          itemToKey.delete(item);
          signals.delete(key);
          const index = keys.indexOf(key);
          if (index !== -1)
            keys.splice(index, 1);
          structural = true;
        }
      }
      if (structural) {
        node.sources = null;
        node.sourcesTail = null;
      }
      node.flags = FLAG_DIRTY;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
    });
  }
  for (const item of initialValue) {
    const key = generateKey(item);
    signals.set(key, itemFactory(key, item));
    itemToKey.set(item, key);
    keys.push(key);
  }
  node.value = initialValue;
  node.flags = FLAG_DIRTY;
  function subscribe() {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched(applyChanges);
      link(node, activeSink);
    }
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
      subscribe();
      return keys.length;
    },
    keys() {
      subscribe();
      return keys.values();
    },
    get() {
      subscribe();
      if (node.sources) {
        if (node.flags) {
          node.value = untrack(buildValue);
          node.flags = FLAG_CLEAN;
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
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
      return deriveCollection(collection, cb);
    }
  };
  return collection;
}
function isCollection(value) {
  return isObjectOfType(value, TYPE_COLLECTION);
}
function isCollectionSource(value) {
  return isList(value) || isCollection(value);
}
// src/nodes/effect.ts
function createEffect(fn) {
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
}
function match(signals, handlers) {
  if (!activeOwner)
    throw new RequiredOwnerError("match");
  const { ok, err = console.error, nil } = handlers;
  let errors;
  let pending = false;
  const values = new Array(signals.length);
  for (let i = 0;i < signals.length; i++) {
    try {
      values[i] = signals[i].get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError) {
        pending = true;
        continue;
      }
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
    const owner = activeOwner;
    const controller = new AbortController;
    registerCleanup(owner, () => controller.abort());
    out.then((cleanup) => {
      if (!controller.signal.aborted && typeof cleanup === "function")
        registerCleanup(owner, cleanup);
    }).catch((e) => {
      err([e instanceof Error ? e : new Error(String(e))]);
    });
  }
}
// src/nodes/sensor.ts
function createSensor(watched, options) {
  validateCallback(TYPE_SENSOR, watched, isSyncFunction);
  if (options?.value !== undefined)
    validateSignalValue(TYPE_SENSOR, options.value, options?.guard);
  const node = {
    value: options?.value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    guard: options?.guard,
    stop: undefined
  };
  return {
    [Symbol.toStringTag]: TYPE_SENSOR,
    get() {
      if (activeSink) {
        if (!node.sinks)
          node.stop = watched((next) => {
            validateSignalValue(TYPE_SENSOR, next, node.guard);
            setState(node, next);
          });
        link(node, activeSink);
      }
      validateReadValue(TYPE_SENSOR, node.value);
      return node.value;
    }
  };
}
function isSensor(value) {
  return isObjectOfType(value, TYPE_SENSOR);
}
// src/nodes/store.ts
function diffRecords(prev, next) {
  const prevValid = isRecord(prev) || Array.isArray(prev);
  const nextValid = isRecord(next) || Array.isArray(next);
  if (!prevValid || !nextValid) {
    const changed2 = !Object.is(prev, next);
    return {
      changed: changed2,
      add: changed2 && nextValid ? next : {},
      change: {},
      remove: changed2 && prevValid ? prev : {}
    };
  }
  const visited = new WeakSet;
  const add = {};
  const change = {};
  const remove = {};
  let changed = false;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  for (const key of nextKeys) {
    if (key in prev) {
      if (!isEqual(prev[key], next[key], visited)) {
        change[key] = next[key];
        changed = true;
      }
    } else {
      add[key] = next[key];
      changed = true;
    }
  }
  for (const key of prevKeys) {
    if (!(key in next)) {
      remove[key] = undefined;
      changed = true;
    }
  }
  return { add, change, remove, changed };
}
function createStore(initialValue, options) {
  validateSignalValue(TYPE_STORE, initialValue, isRecord);
  const signals = new Map;
  const addSignal = (key, value) => {
    validateSignalValue(`${TYPE_STORE} for key "${key}"`, value);
    if (Array.isArray(value))
      signals.set(key, createList(value));
    else if (isRecord(value))
      signals.set(key, createStore(value));
    else
      signals.set(key, createState(value));
  };
  const buildValue = () => {
    const record = {};
    signals.forEach((signal, key) => {
      record[key] = signal.get();
    });
    return record;
  };
  const node = {
    fn: buildValue,
    value: initialValue,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: isEqual,
    error: undefined
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      addSignal(key, changes.add[key]);
      structural = true;
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
              structural = true;
            } else
              signal.set(value);
          }
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      structural = true;
    }
    if (structural) {
      node.sources = null;
      node.sourcesTail = null;
    }
    return changes.changed;
  };
  const watched = options?.watched;
  const subscribe = watched ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = watched();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
  for (const key of Object.keys(initialValue))
    addSignal(key, initialValue[key]);
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
      subscribe();
      return signals.keys();
    },
    byKey(key) {
      return signals.get(key);
    },
    get() {
      subscribe();
      if (node.sources) {
        if (node.flags) {
          node.value = untrack(buildValue);
          node.flags = FLAG_CLEAN;
        }
      } else {
        refresh(node);
        if (node.error)
          throw node.error;
      }
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? buildValue() : node.value;
      const changes = diffRecords(prev, next);
      if (applyChanges(changes)) {
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    update(fn) {
      store.set(fn(store.get()));
    },
    add(key, value) {
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_STORE, key, value);
      addSignal(key, value);
      node.sources = null;
      node.sourcesTail = null;
      node.flags |= FLAG_DIRTY;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(key) {
      const ok = signals.delete(key);
      if (ok) {
        node.sources = null;
        node.sourcesTail = null;
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    }
  };
  return new Proxy(store, {
    get(target, prop) {
      if (prop in target)
        return Reflect.get(target, prop);
      if (typeof prop !== "symbol")
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
      if (typeof prop === "symbol")
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
}
function isStore(value) {
  return isObjectOfType(value, TYPE_STORE);
}
// src/signal.ts
function createComputed(callback, options) {
  return isAsyncFunction(callback) ? createTask(callback, options) : createMemo(callback, options);
}
function createSignal(value) {
  if (isSignal(value))
    return value;
  if (value == null)
    throw new InvalidSignalValueError("createSignal", value);
  if (isAsyncFunction(value))
    return createTask(value);
  if (isFunction(value))
    return createMemo(value);
  if (isUniformArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}
function createMutableSignal(value) {
  if (isMutableSignal(value))
    return value;
  if (value == null || isFunction(value) || isSignal(value))
    throw new InvalidSignalValueError("createMutableSignal", value);
  if (isUniformArray(value))
    return createList(value);
  if (isRecord(value))
    return createStore(value);
  return createState(value);
}
function isComputed(value) {
  return isMemo(value) || isTask(value);
}
function isSignal(value) {
  const signalsTypes = [
    TYPE_STATE,
    TYPE_MEMO,
    TYPE_TASK,
    TYPE_SENSOR,
    TYPE_LIST,
    TYPE_COLLECTION,
    TYPE_STORE
  ];
  const typeStyle = Object.prototype.toString.call(value).slice(8, -1);
  return signalsTypes.includes(typeStyle);
}
function isMutableSignal(value) {
  return isState(value) || isStore(value) || isList(value);
}
export {
  valueString,
  untrack,
  match,
  isTask,
  isStore,
  isState,
  isSignal,
  isSensor,
  isRecord,
  isObjectOfType,
  isMutableSignal,
  isMemo,
  isList,
  isFunction,
  isEqual,
  isComputed,
  isCollection,
  isAsyncFunction,
  createTask,
  createStore,
  createState,
  createSignal,
  createSensor,
  createScope,
  createMutableSignal,
  createMemo,
  createList,
  createEffect,
  createComputed,
  createCollection,
  batch,
  UnsetSignalValueError,
  SKIP_EQUALITY,
  RequiredOwnerError,
  NullishSignalValueError,
  InvalidSignalValueError,
  InvalidCallbackError,
  CircularDependencyError
};
