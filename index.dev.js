// src/scheduler.ts
var active;
var pending = new Set;
var batchDepth = 0;
var updateMap = new Map;
var requestId;
var updateDOM = () => {
  requestId = undefined;
  const updates = Array.from(updateMap.values());
  updateMap.clear();
  for (const update of updates) {
    update();
  }
};
var requestTick = () => {
  if (requestId)
    cancelAnimationFrame(requestId);
  requestId = requestAnimationFrame(updateDOM);
};
queueMicrotask(updateDOM);
var watch = (notice) => {
  const cleanups = new Set;
  const w = notice;
  w.off = (on) => {
    cleanups.add(on);
  };
  w.cleanup = () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    cleanups.clear();
  };
  return w;
};
var subscribe = (watchers) => {
  if (active && !watchers.has(active)) {
    const watcher = active;
    watchers.add(watcher);
    active.off(() => {
      watchers.delete(watcher);
    });
  }
};
var notify = (watchers) => {
  for (const watcher of watchers) {
    if (batchDepth)
      pending.add(watcher);
    else
      watcher();
  }
};
var flush = () => {
  while (pending.size) {
    const watchers = Array.from(pending);
    pending.clear();
    for (const watcher of watchers) {
      watcher();
    }
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
  const prev = active;
  active = watcher;
  try {
    run();
  } finally {
    active = prev;
  }
};
var enqueue = (fn, dedupe) => new Promise((resolve, reject) => {
  updateMap.set(dedupe || Symbol(), () => {
    try {
      resolve(fn());
    } catch (error) {
      reject(error);
    }
  });
  requestTick();
});

// src/util.ts
var isFunction = (fn) => typeof fn === "function";
var isAsyncFunction = (fn) => isFunction(fn) && fn.constructor.name === "AsyncFunction";
var isObjectOfType = (value, type) => Object.prototype.toString.call(value) === `[object ${type}]`;
var isAbortError = (error) => error instanceof DOMException && error.name === "AbortError";
var toError = (reason) => reason instanceof Error ? reason : Error(String(reason));

class CircularDependencyError extends Error {
  constructor(where) {
    super(`Circular dependency in ${where} detected`);
    this.name = "CircularDependencyError";
  }
}

// src/state.ts
var TYPE_STATE = "State";
var state = (initialValue) => {
  const watchers = new Set;
  let value = initialValue;
  const s = {
    [Symbol.toStringTag]: TYPE_STATE,
    get: () => {
      subscribe(watchers);
      return value;
    },
    set: (v) => {
      if (Object.is(value, v))
        return;
      value = v;
      notify(watchers);
      if (UNSET === value)
        watchers.clear();
    },
    update: (fn) => {
      s.set(fn(value));
    }
  };
  return s;
};
var isState = (value) => isObjectOfType(value, TYPE_STATE);

// src/signal.ts
var UNSET = Symbol();
var isSignal = (value) => isState(value) || isComputed(value);
var toSignal = (value) => isSignal(value) ? value : isComputedCallback(value) ? computed(value) : state(value);

// src/computed.ts
var TYPE_COMPUTED = "Computed";
var ABORT_REASON_DIRTY = "Aborted because source signal changed";
var ABORT_REASON_CLEANUP = "Aborted because cleanup was called";
var computed = (fn) => {
  const watchers = new Set;
  let value = UNSET;
  let error;
  let controller;
  let dirty = true;
  let changed = false;
  let computing = false;
  const ok = (v) => {
    if (!Object.is(v, value)) {
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
  const settle = (settleFn) => (arg) => {
    computing = false;
    controller = undefined;
    settleFn(arg);
    if (changed)
      notify(watchers);
  };
  const mark = watch(() => {
    dirty = true;
    controller?.abort(ABORT_REASON_DIRTY);
    if (watchers.size)
      notify(watchers);
    else
      mark.cleanup();
  });
  mark.off(() => {
    controller?.abort(ABORT_REASON_CLEANUP);
  });
  const compute = () => observe(() => {
    if (computing)
      throw new CircularDependencyError("computed");
    changed = false;
    if (isAsyncFunction(fn)) {
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
      result = controller ? fn(controller.signal) : fn();
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
  }, mark);
  const c = {
    [Symbol.toStringTag]: TYPE_COMPUTED,
    get: () => {
      subscribe(watchers);
      flush();
      if (dirty)
        compute();
      if (error)
        throw error;
      return value;
    }
  };
  return c;
};
var isComputed = (value) => isObjectOfType(value, TYPE_COMPUTED);
var isComputedCallback = (value) => isFunction(value) && value.length < 2;
// src/effect.ts
function effect(matcher) {
  const {
    signals,
    ok,
    err = console.error,
    nil = () => {}
  } = isAsyncFunction(matcher) ? { signals: [], ok: matcher } : isFunction(matcher) ? { signals: [], ok: matcher } : matcher;
  let running = false;
  let controller;
  const run = watch(() => observe(() => {
    if (running)
      throw new CircularDependencyError("effect");
    running = true;
    controller?.abort(ABORT_REASON_DIRTY);
    controller = undefined;
    const errors = [];
    let pending2 = false;
    const values = signals.map((signal) => {
      try {
        const value = signal.get();
        if (value === UNSET)
          pending2 = true;
        return value;
      } catch (e) {
        errors.push(toError(e));
        return UNSET;
      }
    });
    let cleanup;
    let abort;
    try {
      if ([ok, nil, err].some(isAsyncFunction))
        controller = new AbortController;
      abort = controller?.signal;
      if (pending2) {
        cleanup = isAsyncCallback(nil) ? nil(abort) : isSyncCallback(nil) ? nil() : undefined;
      } else if (errors.length) {
        cleanup = isAsyncCallback(err) ? err(abort, ...errors) : isSyncCallback(err) ? err(...errors) : undefined;
      } else {
        cleanup = isAsyncCallback(ok) ? ok(abort, ...values) : ok(...values);
      }
    } catch (error) {
      cleanup = isAbortError(error) ? undefined : isAsyncCallback(err) ? err(abort, toError(error), ...errors) : isSyncCallback(err) ? err(toError(error), ...errors) : undefined;
    } finally {
      if (cleanup instanceof Promise) {
        cleanup.then((resolvedCleanup) => {
          if (isFunction(resolvedCleanup))
            run.off(resolvedCleanup);
        }).catch((error) => {
          cleanup = isAsyncCallback(err) ? err(abort, toError(error), ...errors) : isSyncCallback(err) ? err(toError(error), ...errors) : undefined;
          if (cleanup instanceof Promise)
            cleanup.catch(console.error);
          else if (isFunction(cleanup))
            run.off(cleanup);
        });
      } else if (isFunction(cleanup)) {
        run.off(cleanup);
      }
    }
    running = false;
  }, run));
  run();
  return () => {
    controller?.abort(ABORT_REASON_CLEANUP);
    run.cleanup();
  };
}
var isAsyncCallback = (fn) => isAsyncFunction(fn);
var isSyncCallback = (fn) => isFunction(fn);
export {
  watch,
  toSignal,
  subscribe,
  state,
  observe,
  notify,
  isState,
  isSignal,
  isFunction,
  isComputedCallback,
  isComputed,
  flush,
  enqueue,
  effect,
  computed,
  batch,
  UNSET,
  TYPE_STATE,
  TYPE_COMPUTED,
  CircularDependencyError
};
