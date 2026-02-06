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
  for (let i = 0;i < queuedEffects.length; i++) {
    const effect = queuedEffects[i];
    if (effect.flags & FLAG_DIRTY)
      refresh(effect);
  }
  queuedEffects.length = 0;
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
      (errors ??= []).push(e instanceof Error ? e : new Error(String(e)));
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
    err(e instanceof Error ? e : new Error(String(e)));
  }
  if (typeof out === "function")
    return out;
  if (out instanceof Promise) {
    const controller = new AbortController;
    registerCleanup(activeOwner, () => controller.abort());
    out.then((cleanup) => {
      if (!controller.signal.aborted && activeOwner && typeof cleanup === "function")
        registerCleanup(activeOwner, cleanup);
    }).catch((e) => {
      err(e instanceof Error ? e : new Error(String(e)));
    });
  }
};
// src/util.ts
var isFunction2 = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction2(fn) && fn.constructor.name === "AsyncFunction";
var isSyncFunction = (fn) => isFunction2(fn) && fn.constructor.name !== "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;

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
export {
  match,
  isTask,
  isState,
  isMemo,
  createTask,
  createState,
  createSensor,
  createScope,
  createRef,
  createMemo,
  createEffect,
  batch
};
