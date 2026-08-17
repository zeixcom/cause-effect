// src/util.ts
var ASYNC_FUNCTION_PROTO = Object.getPrototypeOf(async () => {});
function isFunction(fn) {
  return typeof fn === "function";
}
function isAsyncFunction(fn) {
  return isFunction(fn) && Object.getPrototypeOf(fn) === ASYNC_FUNCTION_PROTO;
}
function isSyncFunction(fn) {
  return isFunction(fn) && Object.getPrototypeOf(fn) !== ASYNC_FUNCTION_PROTO;
}
function isSignalOfType(value, type) {
  return value != null && value[Symbol.toStringTag] === type;
}
function isRecord(value) {
  return value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype;
}
function valueString(value) {
  if (typeof value === "string")
    return `"${value}"`;
  if (value != null && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// src/errors.ts
class CircularDependencyError extends Error {
  constructor(where) {
    super(`[${where}] Circular dependency detected`);
    this.name = "CircularDependencyError";
  }
}

class EffectConvergenceError extends Error {
  constructor(passes) {
    super(`[Effect] Effects did not settle after ${passes} flush passes — check for effects that write to signals they depend on`);
    this.name = "EffectConvergenceError";
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

class ReadonlySignalError extends Error {
  constructor(where) {
    super(`[${where}] Signal is read-only`);
    this.name = "ReadonlySignalError";
  }
}

class RequiredOwnerError extends Error {
  constructor(where) {
    super(`[${where}] Active owner is required`);
    this.name = "RequiredOwnerError";
  }
}

class PromiseValueError extends TypeError {
  constructor(where) {
    super(`[${where}] Callback returned a Promise — use an async callback to create a Task instead`);
    this.name = "PromiseValueError";
  }
}

class DuplicateKeyError extends Error {
  constructor(where, key, value) {
    super(`[${where}] Could not add key "${key}"${value != null ? ` with value ${JSON.stringify(value)}` : ""} because it already exists`);
    this.name = "DuplicateKeyError";
  }
}

class InvalidStoreMutationError extends TypeError {
  constructor(prop, action) {
    const guidance = action === "delete" ? `use store.remove(${JSON.stringify(prop)})` : `use store.${prop}.set(value), store.set(next), or store.add(key, value)`;
    super(`[Store] Cannot ${action} property "${prop}" directly — ${guidance}`);
    this.name = "InvalidStoreMutationError";
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
var TYPE_CELL = "Cell";
var TYPE_LIST = "List";
var TYPE_STORE = "Store";
var TYPE_SLOT = "Slot";
var FLAG_CLEAN = 0;
var FLAG_CHECK = 1 << 0;
var FLAG_DIRTY = 1 << 1;
var FLAG_RUNNING = 1 << 2;
var FLAG_RELINK = 1 << 3;
var activeSink = null;
var activeOwner = null;
var queuedEffects = [];
var batchDepth = 0;
var flushing = false;
function swapActiveSink(node) {
  const prev = activeSink;
  activeSink = node;
  return prev;
}
var DEFAULT_EQUALITY = (a, b) => a === b;
var SKIP_EQUALITY = (_a, _b) => false;
var deepEqual = (a, b) => deepEqualInner(a, b, undefined);
var deepEqualInner = (a, b, seen) => {
  if (Object.is(a, b))
    return true;
  if (typeof a !== typeof b)
    return false;
  if (a == null || typeof a !== "object" || b == null || typeof b !== "object")
    return false;
  if (seen?.has(a))
    return true;
  seen ??= new WeakSet;
  seen.add(a);
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
        if (!deepEqualInner(aa[i], ba[i], seen))
          return false;
      return true;
    }
    if (a instanceof Date && b instanceof Date)
      return a.getTime() === b.getTime();
    if (a instanceof RegExp && b instanceof RegExp)
      return a.source === b.source && a.flags === b.flags;
    if (isRecord(a) && isRecord(b)) {
      const aKeys = Object.keys(a);
      if (aKeys.length !== Object.keys(b).length)
        return false;
      for (const key of aKeys) {
        if (!(key in b))
          return false;
        if (!deepEqualInner(a[key], b[key], seen))
          return false;
      }
      return true;
    }
    return false;
  } finally {
    seen.delete(a);
  }
};
var DEEP_EQUALITY = (a, b) => deepEqual(a, b);
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
  if (!source.sinks) {
    if (source.stop) {
      source.stop();
      source.stop = undefined;
    }
    if ("sources" in source && source.sources) {
      const sinkNode = source;
      sinkNode.sourcesTail = null;
      trimSources(sinkNode);
      sinkNode.flags |= FLAG_DIRTY;
    }
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
    if ((flags & (FLAG_DIRTY | FLAG_CHECK)) >= newFlag)
      return;
    const wasQueued = flags & (FLAG_DIRTY | FLAG_CHECK);
    node.flags = flags & FLAG_RUNNING | newFlag;
    if (!wasQueued)
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
    if (next instanceof Promise)
      throw new PromiseValueError(TYPE_CELL);
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
    node.flags &= FLAG_DIRTY | FLAG_CHECK;
  }
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
    throw new CircularDependencyError("value" in node ? TYPE_CELL : "Effect");
  }
  if (node.flags & FLAG_DIRTY) {
    if ("recompute" in node)
      node.recompute(node);
    else if ("value" in node)
      recomputeMemo(node);
    else
      runEffect(node);
  } else {
    node.flags = FLAG_CLEAN;
  }
}
var MAX_FLUSH_PASSES = 1000;
function flush() {
  if (flushing)
    return;
  flushing = true;
  let errors;
  let passes = 0;
  try {
    while (queuedEffects.length > 0) {
      if (++passes > MAX_FLUSH_PASSES) {
        queuedEffects.length = 0;
        if (!errors)
          errors = [];
        errors.push(new EffectConvergenceError(MAX_FLUSH_PASSES));
        break;
      }
      const batch = queuedEffects.slice();
      queuedEffects.length = 0;
      for (let i = 0;i < batch.length; i++) {
        const effect = batch[i];
        if (effect.flags & FLAG_RUNNING)
          continue;
        if (effect.flags & (FLAG_DIRTY | FLAG_CHECK)) {
          try {
            refresh(effect);
          } catch (err) {
            if (!errors)
              errors = [];
            errors.push(err);
          }
        }
      }
    }
  } finally {
    flushing = false;
  }
  if (errors) {
    if (errors.length === 1)
      throw errors[0];
    throw new AggregateError(errors, "Multiple effects threw during flush");
  }
}
function scheduleEffect(node) {
  if (node.flags & (FLAG_DIRTY | FLAG_CHECK)) {
    queuedEffects.push(node);
    if (batchDepth === 0)
      flush();
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
function createScope(fn, options) {
  const prevOwner = activeOwner;
  const scope = { cleanup: null };
  activeOwner = scope;
  const dispose = () => runCleanup(scope);
  try {
    const out = fn();
    if (typeof out === "function")
      registerCleanup(scope, out);
    return dispose;
  } finally {
    activeOwner = prevOwner;
    if (!options?.root && prevOwner)
      registerCleanup(prevOwner, dispose);
  }
}
function unown(fn) {
  const prev = activeOwner;
  activeOwner = null;
  try {
    return fn();
  } finally {
    activeOwner = prev;
  }
}
function makeSubscribe(node, onWatch) {
  return onWatch ? () => {
    if (activeSink) {
      if (!node.sinks)
        node.stop = onWatch();
      link(node, activeSink);
    }
  } : () => {
    if (activeSink)
      link(node, activeSink);
  };
}
function refreshComposite(node, buildValue, discoversKeys = false) {
  if (node.sources) {
    if (!node.flags)
      return;
    const result = discoversKeys ? untrack(buildValue) : undefined;
    if (node.flags & FLAG_RELINK) {
      node.flags = FLAG_DIRTY;
      refresh(node);
      if (node.error)
        throw node.error;
    } else {
      node.value = discoversKeys ? result : untrack(buildValue);
      node.flags = FLAG_CLEAN;
    }
  } else if (!discoversKeys || node.sinks) {
    refresh(node);
    if (node.error)
      throw node.error;
  } else {
    node.value = untrack(buildValue);
  }
}
var asyncSources = new WeakMap;
function registerAsyncSource(signal, source) {
  asyncSources.set(signal, source);
}
function getAsyncSource(signal) {
  if (signal == null || typeof signal !== "object")
    return;
  return asyncSources.get(signal);
}
function isPending(signal) {
  return getAsyncSource(signal)?.isPending() ?? false;
}
function abort(signal) {
  getAsyncSource(signal)?.abort();
}
// src/nodes/memo.ts
var WHERE = "deriveComputed";
function deriveComputed(fn, options) {
  validateCallback(WHERE, fn, isSyncFunction);
  if (options?.initial !== undefined)
    validateSignalValue(WHERE, options.initial, options?.guard);
  const node = {
    fn,
    value: options?.initial,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    error: undefined,
    stop: undefined
  };
  const watched = options?.watched;
  const subscribe = makeSubscribe(node, watched ? () => watched(() => {
    propagate(node);
    if (batchDepth === 0)
      flush();
  }) : undefined);
  return {
    [Symbol.toStringTag]: TYPE_CELL,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(WHERE, node.value);
      return node.value;
    }
  };
}

// src/nodes/sensor.ts
var WHERE2 = "createSensor";
function createSensor(options) {
  const watched = options.watched;
  validateCallback(WHERE2, watched, isSyncFunction);
  if (options.initial !== undefined)
    validateSignalValue(WHERE2, options.initial, options.guard);
  const node = {
    value: options.initial,
    sinks: null,
    sinksTail: null,
    equals: options.equals ?? DEFAULT_EQUALITY,
    guard: options.guard,
    stop: undefined
  };
  return {
    [Symbol.toStringTag]: TYPE_CELL,
    get() {
      if (activeSink) {
        if (!node.sinks)
          node.stop = watched((next) => {
            validateSignalValue(WHERE2, next, node.guard);
            setState(node, next);
          });
        link(node, activeSink);
      }
      validateReadValue(WHERE2, node.value);
      return node.value;
    }
  };
}

// src/nodes/state.ts
var WHERE3 = "createState";
function createState(value, options) {
  validateSignalValue(WHERE3, value, options?.guard);
  const node = {
    value,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    guard: options?.guard
  };
  return {
    [Symbol.toStringTag]: TYPE_CELL,
    get() {
      if (activeSink)
        link(node, activeSink);
      return node.value;
    },
    set(next) {
      validateSignalValue(WHERE3, next, node.guard);
      setState(node, next);
    },
    update(fn) {
      validateCallback(WHERE3, fn);
      const next = fn(node.value);
      validateSignalValue(WHERE3, next, node.guard);
      setState(node, next);
    }
  };
}

// src/nodes/task.ts
var WHERE4 = "createTask";
function recomputeTask(node) {
  node.controller?.abort();
  const controller = new AbortController;
  node.controller = controller;
  node.error = undefined;
  const prevWatcher = swapActiveSink(node);
  node.sourcesTail = null;
  node.flags = FLAG_RUNNING;
  let promise;
  try {
    promise = node.fn(node.value, controller.signal);
  } catch (err) {
    node.controller = undefined;
    node.error = err instanceof Error ? err : new Error(String(err));
    node.flags = FLAG_CLEAN;
    setState(node.pendingNode, false);
    return;
  } finally {
    swapActiveSink(prevWatcher);
    trimSources(node);
  }
  setState(node.pendingNode, true);
  promise.then((next) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    batch(() => {
      if (node.error || !node.equals(next, node.value)) {
        node.value = next;
        node.error = undefined;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      }
      setState(node.pendingNode, false);
    });
  }, (err) => {
    if (controller.signal.aborted)
      return;
    node.controller = undefined;
    const error = err instanceof Error ? err : new Error(String(err));
    batch(() => {
      if (!node.error || error.name !== node.error.name || error.message !== node.error.message) {
        node.error = error;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      }
      setState(node.pendingNode, false);
    });
  });
  node.flags = FLAG_CLEAN;
}
function createTask(fn, options) {
  validateCallback(WHERE4, fn, isAsyncFunction);
  if (options?.initial !== undefined)
    validateSignalValue(WHERE4, options.initial, options?.guard);
  const pendingNode = {
    value: false,
    sinks: null,
    sinksTail: null,
    equals: DEFAULT_EQUALITY
  };
  const node = {
    fn,
    value: options?.initial,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    flags: FLAG_DIRTY,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    controller: undefined,
    error: undefined,
    stop: undefined,
    pendingNode,
    recompute: recomputeTask
  };
  const watched = options?.watched;
  const subscribe = makeSubscribe(node, watched ? () => watched(() => {
    propagate(node);
    if (batchDepth === 0)
      flush();
  }) : undefined);
  const pendingSubscribe = makeSubscribe(pendingNode);
  const task = {
    [Symbol.toStringTag]: TYPE_CELL,
    get() {
      subscribe();
      refresh(node);
      if (node.error)
        throw node.error;
      validateReadValue(WHERE4, node.value);
      return node.value;
    }
  };
  registerAsyncSource(task, {
    isPending() {
      pendingSubscribe();
      return node.pendingNode.value;
    },
    abort() {
      node.controller?.abort();
      node.controller = undefined;
      setState(node.pendingNode, false);
    }
  });
  return task;
}

// src/nodes/cell.ts
function createCell(value, options) {
  return createState(value, options);
}
function deriveCell(input, options) {
  if (isFunction(input)) {
    return isAsyncFunction(input) ? createTask(input, options) : deriveComputed(input, options);
  }
  const watched = options?.watched;
  validateCallback("deriveCell", watched, isSyncFunction);
  return createSensor({
    ...options,
    initial: input
  });
}
function isCell(value) {
  return isSignalOfType(value, TYPE_CELL);
}
function isMutableCell(value) {
  return isCell(value) && typeof value.set === "function";
}
function isSignal(value) {
  return typeof value?.get === "function";
}
function isMutableSignal(value) {
  return isSignal(value) && typeof value.set === "function";
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
  scheduleEffect(node);
  return dispose;
}
function match(signalOrSignals, handlers) {
  if (!activeOwner)
    throw new RequiredOwnerError("match");
  const isSingle = !Array.isArray(signalOrSignals);
  const signals = isSingle ? [signalOrSignals] : signalOrSignals;
  const { nil, stale } = handlers;
  const ok = isSingle ? (values2) => handlers.ok(values2[0]) : (values2) => handlers.ok(values2);
  const err = isSingle && handlers.err ? (errors2) => handlers.err(errors2[0]) : handlers.err ?? console.error;
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
    else if (stale && (isSingle ? isPending(signals[0]) : signals.some((s) => isPending(s))))
      out = stale();
    else
      out = ok(values);
  } catch (e) {
    out = err([e instanceof Error ? e : new Error(String(e))]);
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
// src/nodes/list.ts
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
function diffPositional(prev, next, prevKeys, generateKey, itemEquals) {
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const minLen = Math.min(prev.length, next.length);
  for (let i = 0;i < minLen; i++) {
    const key = prevKeys[i];
    nextKeys.push(key);
    if (!itemEquals(prev[i], next[i])) {
      change[key] = next[i];
      changed = true;
    }
  }
  for (let i = minLen;i < next.length; i++) {
    const val = next[i];
    const key = generateKey(val);
    nextKeys.push(key);
    add[key] = val;
    changed = true;
  }
  for (let i = minLen;i < prev.length; i++) {
    remove[prevKeys[i]] = null;
    changed = true;
  }
  return { add, change, remove, newKeys: nextKeys, changed };
}
function diffArrays(prev, next, prevKeys, generateKey, contentBased, itemEquals) {
  if (!contentBased)
    return diffPositional(prev, next, prevKeys, generateKey, itemEquals);
  const add = {};
  const change = {};
  const remove = {};
  const nextKeys = [];
  let changed = false;
  const prevByKey = new Map;
  for (let i = 0;i < prev.length; i++) {
    const key = prevKeys[i];
    const item = prev[i];
    if (key && item !== undefined)
      prevByKey.set(key, item);
  }
  const seenKeys = new Set;
  for (let i = 0;i < next.length; i++) {
    const val = next[i];
    validateSignalValue(`${TYPE_LIST} item at index ${i}`, val);
    const key = generateKey(val);
    if (seenKeys.has(key))
      throw new DuplicateKeyError(TYPE_LIST, key, val);
    nextKeys.push(key);
    seenKeys.add(key);
    if (!prevByKey.has(key)) {
      add[key] = val;
      changed = true;
    } else if (!itemEquals(prevByKey.get(key), val)) {
      change[key] = val;
      changed = true;
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
function keyedAdapter(source, options) {
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const itemEquals = options?.itemEquals ?? DEEP_EQUALITY;
  const signals = new Map;
  const indices = new Map;
  let keys = [];
  let prev = [];
  let syncedFrom;
  const readSource = () => {
    try {
      return source.get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError)
        return [];
      throw e;
    }
  };
  const ensureKeys = (next) => {
    if (next === syncedFrom)
      return;
    syncedFrom = next;
    const diff = diffArrays(prev, next, keys, generateKey, contentBased, itemEquals);
    prev = next;
    if (keysEqual(keys, diff.newKeys))
      return;
    keys = diff.newKeys;
    indices.clear();
    for (let i = 0;i < keys.length; i++)
      indices.set(keys[i], i);
  };
  return {
    keys() {
      ensureKeys(readSource());
      for (const key of Array.from(signals.keys()))
        if (!indices.has(key))
          signals.delete(key);
      return keys.values();
    },
    byKey(key) {
      if (!indices.has(key))
        return;
      let signal = signals.get(key);
      if (!signal) {
        signal = deriveComputed(() => {
          const items = readSource();
          ensureKeys(items);
          const at = indices.get(key);
          return at !== undefined ? items[at] : undefined;
        }, { equals: itemEquals });
        signals.set(key, signal);
      }
      return signal;
    }
  };
}
function listFacade(node, getKeys, signals, prepare, prepareValue) {
  const list = {
    [Symbol.toStringTag]: TYPE_LIST,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      prepare();
      for (const key of getKeys()) {
        const signal = signals.get(key);
        if (signal)
          yield signal;
      }
    },
    get length() {
      prepare();
      return getKeys().length;
    },
    keys() {
      prepare();
      return getKeys().values();
    },
    get() {
      prepareValue();
      return node.value;
    },
    at(index) {
      prepare();
      const key = getKeys()[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    byKey(key) {
      prepare();
      return signals.get(key);
    },
    keyAt(index) {
      prepare();
      return getKeys()[index];
    },
    indexOfKey(key) {
      prepare();
      return getKeys().indexOf(key);
    }
  };
  return list;
}
function derivePerItem(sourceInput, callback, options) {
  if (callback)
    validateCallback("deriveList", callback);
  const source = isList(sourceInput) ? sourceInput : keyedAdapter(sourceInput, options);
  const isAsync = isAsyncFunction(callback);
  const signals = new Map;
  let keys = [];
  const addSignal = (key) => {
    if (!callback) {
      const passthrough = untrack(() => source.byKey(key));
      if (passthrough)
        signals.set(key, passthrough);
      return;
    }
    const signal = isAsync ? createTask(async (prev, abortSignal) => {
      const itemSignal = untrack(() => source.byKey(key));
      if (!itemSignal)
        return prev;
      const sourceValue = itemSignal.get();
      if (sourceValue == null)
        return prev;
      return callback(sourceValue, abortSignal);
    }) : deriveComputed(() => {
      const itemSignal = untrack(() => source.byKey(key));
      if (!itemSignal)
        return;
      const sourceValue = itemSignal.get();
      if (sourceValue == null)
        return;
      return callback(sourceValue);
    });
    signals.set(key, signal);
  };
  function syncKeys(nextKeys) {
    if (!keysEqual(keys, nextKeys)) {
      const nextSet = new Set(nextKeys);
      for (const key of keys)
        if (!nextSet.has(key))
          signals.delete(key);
      for (const key of nextKeys)
        if (!signals.has(key))
          addSignal(key);
      keys = nextKeys;
      node.flags |= FLAG_RELINK;
    }
  }
  function buildValue() {
    syncKeys(Array.from(source.keys()));
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
  const valuesEqual = keysEqual;
  const node = {
    fn: buildValue,
    value: [],
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: valuesEqual,
    error: undefined
  };
  const ensureFresh = () => {
    refreshComposite(node, buildValue, true);
  };
  const initialKeys = Array.from(untrack(() => source.keys()));
  for (const key of initialKeys)
    addSignal(key);
  keys = initialKeys;
  const prepare = () => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
  };
  return listFacade(node, () => keys, signals, prepare, prepare);
}
function isMutableItem(value) {
  return typeof value.set === "function";
}
function createExternalList(options) {
  const watched = options.watched;
  const initial = options.initial ?? [];
  if (initial.length)
    validateSignalValue("deriveList", initial, Array.isArray);
  validateCallback("deriveList", watched, isSyncFunction);
  const signals = new Map;
  const keys = [];
  const itemToKey = new Map;
  const [generateKey, contentBased] = getKeyGenerator(options.keyConfig);
  const resolveKey = (item) => itemToKey.get(item) ?? (contentBased ? generateKey(item) : undefined);
  const itemFactory = options.createItem ?? ((item) => createState(item, {
    equals: options.itemEquals ?? DEEP_EQUALITY
  }));
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
    value: initial,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: SKIP_EQUALITY,
    error: undefined
  };
  for (const item of initial) {
    const key = generateKey(item);
    if (signals.has(key))
      throw new DuplicateKeyError("deriveList", key, item);
    signals.set(key, itemFactory(item));
    itemToKey.set(item, key);
    keys.push(key);
  }
  node.value = initial;
  node.flags = FLAG_DIRTY;
  const onChanges = (changes) => {
    const { add, change, remove } = changes;
    if (!add?.length && !change?.length && !remove?.length)
      return;
    let structural = false;
    batch(() => {
      if (add) {
        const staged = new Map;
        for (const item of add) {
          const key = generateKey(item);
          if (signals.has(key) || staged.has(key))
            throw new DuplicateKeyError("deriveList", key, item);
          staged.set(key, item);
        }
        for (const [key, item] of staged) {
          signals.set(key, itemFactory(item));
          itemToKey.set(item, key);
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
          if (signal && isMutableItem(signal)) {
            itemToKey.delete(untrack(() => signal.get()));
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
      node.flags = FLAG_DIRTY | (structural ? FLAG_RELINK : 0);
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
    });
  };
  const subscribe = makeSubscribe(node, () => watched(onChanges));
  return listFacade(node, () => keys, signals, subscribe, () => {
    subscribe();
    refreshComposite(node, buildValue);
  });
}
function deriveList(input, itemOrOptions, maybeOptions) {
  if (isFunction(itemOrOptions))
    return derivePerItem(input, itemOrOptions, maybeOptions);
  const options = itemOrOptions;
  const passthrough = derivePerItem;
  if (!isFunction(input)) {
    validateSignalValue("deriveList", input, Array.isArray);
    validateCallback("deriveList", options?.watched, isSyncFunction);
    return createExternalList({
      ...options,
      watched: options?.watched,
      initial: input
    });
  }
  if (isAsyncFunction(input)) {
    const task = createTask(input, { initial: options?.initial ?? [] });
    const derived = passthrough(task, undefined, options);
    const asyncSource = getAsyncSource(task);
    if (asyncSource)
      registerAsyncSource(derived, asyncSource);
    return derived;
  }
  return passthrough(deriveComputed(input), undefined, options);
}
function createList(value, options) {
  validateSignalValue(TYPE_LIST, value, Array.isArray);
  const signals = new Map;
  let keys = [];
  const [generateKey, contentBased] = getKeyGenerator(options?.keyConfig);
  const itemEquals = options?.itemEquals ?? DEEP_EQUALITY;
  const itemFactory = options?.createItem ?? ((item) => createState(item, { equals: itemEquals }));
  const buildValue = () => {
    const result = [];
    for (const key of keys) {
      const v = signals.get(key)?.get();
      if (v !== undefined)
        result.push(v);
    }
    return result;
  };
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      const val = changes.add[key];
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
      signals.set(key, itemFactory(val));
      structural = true;
    }
    let hasChange = false;
    for (const _key in changes.change) {
      hasChange = true;
      break;
    }
    if (hasChange) {
      batch(() => {
        for (const key in changes.change) {
          const val = changes.change[key];
          validateSignalValue(`${TYPE_LIST} item for key "${key}"`, val);
          const signal = signals.get(key);
          if (signal)
            signal.set(val);
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      structural = true;
    }
    if (structural)
      node.flags |= FLAG_RELINK;
    return changes.changed;
  };
  const subscribe = makeSubscribe(node, options?.watched);
  for (let i = 0;i < value.length; i++) {
    const val = value[i];
    if (val == null)
      throw new NullishSignalValueError(`${TYPE_LIST} item ${i}`);
    const key = generateKey(val);
    if (signals.has(key))
      throw new DuplicateKeyError(TYPE_LIST, key, val);
    keys[i] = key;
    signals.set(key, itemFactory(val));
  }
  node.value = value;
  const list = {
    [Symbol.toStringTag]: TYPE_LIST,
    [Symbol.isConcatSpreadable]: true,
    *[Symbol.iterator]() {
      subscribe();
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
      refreshComposite(node, buildValue);
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value;
      const changes = diffArrays(prev, next, keys, generateKey, contentBased, itemEquals);
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
      list.set(fn(untrack(() => list.get())));
    },
    at(index) {
      subscribe();
      const key = keys[index];
      return key !== undefined ? signals.get(key) : undefined;
    },
    keys() {
      subscribe();
      return keys.values();
    },
    byKey(key) {
      subscribe();
      return signals.get(key);
    },
    keyAt(index) {
      subscribe();
      return keys[index];
    },
    indexOfKey(key) {
      subscribe();
      return keys.indexOf(key);
    },
    add(value2) {
      const key = generateKey(value2);
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_LIST, key, value2);
      keys.push(key);
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value2);
      signals.set(key, itemFactory(value2));
      node.flags |= FLAG_DIRTY | FLAG_RELINK;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(keyOrIndex) {
      const key = typeof keyOrIndex === "number" ? keys[keyOrIndex] : keyOrIndex;
      if (key === undefined)
        return;
      const ok = signals.delete(key);
      if (ok) {
        const index = typeof keyOrIndex === "number" ? keyOrIndex : keys.indexOf(key);
        if (index >= 0)
          keys.splice(index, 1);
        node.flags |= FLAG_DIRTY | FLAG_RELINK;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    },
    replace(key, value2) {
      const signal = signals.get(key);
      if (!signal)
        return;
      validateSignalValue(`${TYPE_LIST} item for key "${key}"`, value2);
      if (itemEquals(untrack(() => signal.get()), value2))
        return;
      batch(() => {
        signal.set(value2);
        node.flags |= FLAG_DIRTY;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
      });
      if (batchDepth === 0)
        flush();
    },
    sort(compareFn) {
      const entries = [];
      untrack(() => {
        for (const key of keys) {
          const v = signals.get(key)?.get();
          if (v !== undefined)
            entries.push([key, v]);
        }
      });
      entries.sort(isFunction(compareFn) ? (a, b) => compareFn(a[1], b[1]) : (a, b) => String(a[1]).localeCompare(String(b[1])));
      const newOrder = [];
      for (const [key] of entries)
        newOrder.push(key);
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
      let hasRemove = false;
      untrack(() => {
        for (let i = 0;i < actualDeleteCount; i++) {
          const index2 = actualStart + i;
          const key = keys[index2];
          if (key) {
            const signal = signals.get(key);
            if (signal) {
              remove[key] = signal.get();
              hasRemove = true;
            }
          }
        }
      });
      const newOrder = keys.slice(0, actualStart);
      const change = {};
      let hasAdd = false;
      let hasChange = false;
      const staged = new Set;
      let index = 0;
      for (const item of items) {
        validateSignalValue(`${TYPE_LIST} item ${actualStart + index}`, item);
        index++;
        const key = generateKey(item);
        if (key in remove) {
          delete remove[key];
          change[key] = item;
          hasChange = true;
        } else if (signals.has(key) || staged.has(key)) {
          throw new DuplicateKeyError(TYPE_LIST, key, item);
        } else {
          add[key] = item;
          hasAdd = true;
          staged.add(key);
        }
        newOrder.push(key);
      }
      newOrder.push(...keys.slice(actualStart + actualDeleteCount));
      const changed = hasAdd || hasRemove || hasChange;
      if (changed) {
        applyChanges({
          add,
          change,
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
    }
  };
  return list;
}
function isList(value) {
  return isSignalOfType(value, TYPE_LIST);
}
function isMutableList(value) {
  return isList(value) && typeof value.add === "function";
}
// src/nodes/slot.ts
var settingSlots = new WeakSet;
function isSignalOrDescriptor(value) {
  if (isSignal(value))
    return true;
  return value !== null && typeof value === "object" && "get" in value && typeof value.get === "function";
}
function createSlot(initialSignal, options) {
  validateSignalValue(TYPE_SLOT, initialSignal, isSignalOrDescriptor);
  let delegated = initialSignal;
  const guard = options?.guard;
  const node = {
    fn: () => delegated.get(),
    value: undefined,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: options?.equals ?? DEFAULT_EQUALITY,
    error: undefined
  };
  const get = () => {
    if (activeSink)
      link(node, activeSink);
    refresh(node);
    if (node.error)
      throw node.error;
    return node.value;
  };
  const set = (next) => {
    if (settingSlots.has(node))
      throw new Error("[Slot] Circular delegation detected in set()");
    settingSlots.add(node);
    try {
      if (isSlot(delegated))
        return void delegated.set(next);
      if ("set" in delegated && typeof delegated.set === "function") {
        validateSignalValue(TYPE_SLOT, next, guard);
        delegated.set(next);
      } else {
        throw new ReadonlySignalError(TYPE_SLOT);
      }
    } finally {
      settingSlots.delete(node);
    }
  };
  const replace = (next) => {
    validateSignalValue(TYPE_SLOT, next, isSignalOrDescriptor);
    delegated = next;
    node.flags |= FLAG_DIRTY;
    for (let e = node.sinks;e; e = e.nextSink)
      propagate(e.sink);
    if (batchDepth === 0)
      flush();
  };
  return {
    [Symbol.toStringTag]: TYPE_SLOT,
    configurable: true,
    enumerable: true,
    get,
    set,
    replace,
    current: () => delegated
  };
}
function isSlot(value) {
  return isSignalOfType(value, TYPE_SLOT);
}
// src/nodes/store.ts
var storeProxyHandler = {
  get(target, prop) {
    if (prop in target)
      return Reflect.get(target, prop);
    if (typeof prop !== "symbol")
      return target.byKey(prop);
  },
  set(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "assign to");
  },
  deleteProperty(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "delete");
  },
  defineProperty(_target, prop) {
    throw new InvalidStoreMutationError(String(prop), "define");
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
    return signal ? { enumerable: true, configurable: true, writable: true, value: signal } : undefined;
  }
};
function diffRecords(prev, next) {
  const add = {};
  const change = {};
  const remove = {};
  let changed = false;
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  for (const key of nextKeys) {
    if (key in prev) {
      if (!DEEP_EQUALITY(prev[key], next[key])) {
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
function createStore(value, options) {
  validateSignalValue(TYPE_STORE, value, isRecord);
  const signals = new Map;
  const addSignal = (key, val) => {
    validateSignalValue(`${TYPE_STORE} for key "${key}"`, val);
    if (Array.isArray(val))
      signals.set(key, createList(val));
    else if (isRecord(val))
      signals.set(key, createStore(val));
    else
      signals.set(key, createState(val));
  };
  const shapeCategory = (val) => {
    if (Array.isArray(val))
      return "list";
    if (isRecord(val))
      return "store";
    return "state";
  };
  const signalCategory = (signal) => {
    if (isMutableList(signal))
      return "list";
    if (isStore(signal))
      return "store";
    return "state";
  };
  const buildValue = () => {
    const record = {};
    for (const [key, signal] of signals)
      record[key] = signal.get();
    return record;
  };
  const node = {
    fn: buildValue,
    value,
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const applyChanges = (changes) => {
    let structural = false;
    for (const key in changes.add) {
      addSignal(key, changes.add[key]);
      structural = true;
    }
    let hasChange = false;
    for (const _key in changes.change) {
      hasChange = true;
      break;
    }
    if (hasChange) {
      batch(() => {
        for (const key in changes.change) {
          const val = changes.change[key];
          validateSignalValue(`${TYPE_STORE} for key "${key}"`, val);
          const signal = signals.get(key);
          if (signal) {
            if (shapeCategory(val) !== signalCategory(signal)) {
              addSignal(key, val);
              structural = true;
            } else
              signal.set(val);
          }
        }
      });
    }
    for (const key in changes.remove) {
      signals.delete(key);
      structural = true;
    }
    if (structural)
      node.flags |= FLAG_RELINK;
    return changes.changed;
  };
  const subscribe = makeSubscribe(node, options?.watched);
  for (const key of Object.keys(value))
    addSignal(key, value[key]);
  const store = {
    [Symbol.toStringTag]: TYPE_STORE,
    [Symbol.isConcatSpreadable]: false,
    *[Symbol.iterator]() {
      subscribe();
      for (const [key, signal] of signals) {
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
      refreshComposite(node, buildValue);
      return node.value;
    },
    set(next) {
      const prev = node.flags & FLAG_DIRTY ? untrack(buildValue) : node.value;
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
      store.set(fn(untrack(() => store.get())));
    },
    add(key, value2) {
      if (signals.has(key))
        throw new DuplicateKeyError(TYPE_STORE, key, value2);
      addSignal(key, value2);
      node.flags |= FLAG_DIRTY | FLAG_RELINK;
      for (let e = node.sinks;e; e = e.nextSink)
        propagate(e.sink);
      if (batchDepth === 0)
        flush();
      return key;
    },
    remove(key) {
      const ok = signals.delete(key);
      if (ok) {
        node.flags |= FLAG_DIRTY | FLAG_RELINK;
        for (let e = node.sinks;e; e = e.nextSink)
          propagate(e.sink);
        if (batchDepth === 0)
          flush();
      }
    }
  };
  return new Proxy(store, storeProxyHandler);
}
function deriveStore(input, options) {
  if (!isFunction(input)) {
    validateSignalValue(TYPE_STORE, input, isRecord);
    const watched = options?.watched;
    validateCallback(TYPE_STORE, watched, isSyncFunction);
    const inner = createStore(input);
    const anchor = {
      value: undefined,
      sinks: null,
      sinksTail: null,
      stop: undefined
    };
    let stop;
    const stopWatched = () => {
      if (stop) {
        stop();
        stop = undefined;
      }
    };
    const subscribe = () => {
      if (!activeSink)
        return;
      if (!anchor.sinks) {
        stop = watched(emit);
        anchor.stop = stopWatched;
      }
      link(anchor, activeSink);
    };
    const emit = (patch) => {
      inner.update((prev) => ({ ...prev, ...patch }));
    };
    return readonlyFacade(() => {
      subscribe();
      return inner.get();
    }, () => {
      subscribe();
      return inner.keys();
    }, (key) => {
      subscribe();
      return inner.byKey(key);
    });
  }
  const task = isAsyncFunction(input) ? createTask(input, {
    initial: options?.initial ?? {}
  }) : undefined;
  const source = task ?? deriveComputed(input);
  const readSource = () => {
    try {
      return source.get();
    } catch (e) {
      if (e instanceof UnsetSignalValueError)
        return {};
      throw e;
    }
  };
  const signals = new Map;
  let keys = [];
  const addSignal = (key) => {
    signals.set(key, deriveComputed(() => readSource()[key], {
      equals: DEEP_EQUALITY
    }));
  };
  const syncKeys = (next) => {
    const nextKeys = Object.keys(next);
    if (keysEqual(keys, nextKeys))
      return;
    const nextSet = new Set(nextKeys);
    for (const key of keys)
      if (!nextSet.has(key))
        signals.delete(key);
    for (const key of nextKeys)
      if (!signals.has(key))
        addSignal(key);
    keys = nextKeys;
    node.flags |= FLAG_RELINK;
  };
  function buildValue() {
    syncKeys(readSource());
    const record = {};
    for (const key of keys) {
      try {
        const v = signals.get(key)?.get();
        if (v !== undefined)
          record[key] = v;
      } catch (e) {
        if (!(e instanceof UnsetSignalValueError))
          throw e;
      }
    }
    return record;
  }
  const node = {
    fn: buildValue,
    value: options?.initial ?? {},
    flags: FLAG_DIRTY,
    sources: null,
    sourcesTail: null,
    sinks: null,
    sinksTail: null,
    equals: DEEP_EQUALITY,
    error: undefined
  };
  const ensureFresh = () => {
    refreshComposite(node, buildValue, true);
  };
  syncKeys(untrack(readSource));
  node.flags = FLAG_DIRTY;
  const derived = readonlyFacade(() => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
    return node.value;
  }, () => {
    if (activeSink)
      link(node, activeSink);
    ensureFresh();
    return keys.values();
  }, (key) => {
    ensureFresh();
    return signals.get(key);
  });
  const asyncSource = task && getAsyncSource(task);
  if (asyncSource)
    registerAsyncSource(derived, asyncSource);
  return derived;
}
function readonlyFacade(read, readKeys, readByKey) {
  const store = {
    [Symbol.toStringTag]: TYPE_STORE,
    [Symbol.isConcatSpreadable]: false,
    *[Symbol.iterator]() {
      for (const key of readKeys()) {
        const signal = readByKey(key);
        if (signal)
          yield [key, signal];
      }
    },
    keys: readKeys,
    byKey(key) {
      return readByKey(key);
    },
    get: read
  };
  return new Proxy(store, storeProxyHandler);
}
function isStore(value) {
  return isSignalOfType(value, TYPE_STORE);
}
function isMutableStore(value) {
  return isStore(value) && typeof value.add === "function";
}
export {
  valueString,
  untrack,
  unown,
  match,
  isStore,
  isSlot,
  isSignalOfType,
  isSignal,
  isRecord,
  isPending,
  isMutableStore,
  isMutableSignal,
  isMutableList,
  isMutableCell,
  isList,
  isFunction,
  isCell,
  isAsyncFunction,
  deriveStore,
  deriveList,
  deriveComputed,
  deriveCell,
  createStore,
  createState,
  createSlot,
  createScope,
  createList,
  createEffect,
  createCell,
  batch,
  abort,
  UnsetSignalValueError,
  SKIP_EQUALITY,
  RequiredOwnerError,
  ReadonlySignalError,
  PromiseValueError,
  NullishSignalValueError,
  InvalidStoreMutationError,
  InvalidSignalValueError,
  InvalidCallbackError,
  EffectConvergenceError,
  DuplicateKeyError,
  DEFAULT_EQUALITY,
  DEEP_EQUALITY,
  CircularDependencyError
};
