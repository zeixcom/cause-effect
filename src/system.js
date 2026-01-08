"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.untrack = exports.track = exports.batch = exports.flush = exports.notifyWatchers = exports.notifyOf = exports.unsubscribeAllFrom = exports.subscribeActiveWatcher = exports.subscribeTo = exports.registerWatchCallbacks = exports.createWatcher = exports.UNSET = void 0;
var errors_1 = require("./errors");
/* === Internal === */
// Currently active watcher
var activeWatcher;
var watchersMap = new WeakMap();
var watchedCallbackMap = new WeakMap();
var unwatchedCallbackMap = new WeakMap();
// Queue of pending watcher reactions for batched change notifications
var pendingReactions = new Set();
var batchDepth = 0;
/* === Constants === */
// biome-ignore lint/suspicious/noExplicitAny: Deliberately using any to be used as a placeholder value in any signal
var UNSET = Symbol();
exports.UNSET = UNSET;
/* === Functions === */
/**
 * Create a watcher to observe changes in signals.
 *
 * A watcher combines push and pull reaction functions with onCleanup and stop methods
 *
 * @since 0.17.3
 * @param {() => void} push - Function to be called when the state changes (push)
 * @param {() => void} pull - Function to be called on demand from consumers (pull)
 * @returns {Watcher} - Watcher object with off and cleanup methods
 */
var createWatcher = function (push, pull) {
    var cleanups = new Set();
    var watcher = push;
    watcher.run = function () {
        var prev = activeWatcher;
        activeWatcher = watcher;
        try {
            pull();
        }
        finally {
            activeWatcher = prev;
        }
    };
    watcher.onCleanup = function (cleanup) {
        cleanups.add(cleanup);
    };
    watcher.stop = function () {
        try {
            for (var _i = 0, cleanups_1 = cleanups; _i < cleanups_1.length; _i++) {
                var cleanup = cleanups_1[_i];
                cleanup();
            }
        }
        finally {
            cleanups.clear();
        }
    };
    return watcher;
};
exports.createWatcher = createWatcher;
/**
 * Run a function with signal reads in a non-tracking context.
 *
 * @param {() => void} callback - Callback
 */
var untrack = function (callback) {
    var prev = activeWatcher;
    activeWatcher = undefined;
    try {
        callback();
    }
    finally {
        activeWatcher = prev;
    }
};
exports.untrack = untrack;
var registerWatchCallbacks = function (signal, watched, unwatched) {
    watchedCallbackMap.set(signal, watched);
    if (unwatched)
        unwatchedCallbackMap.set(signal, unwatched);
};
exports.registerWatchCallbacks = registerWatchCallbacks;
/**
 * Subscribe active watcher to a signal.
 *
 * @param {UnknownSignal} signal - Signal to subscribe to
 * @returns {boolean} - true if the active watcher was subscribed,
 *                      false if the watcher was already subscribed or there was no active watcher
 */
var subscribeTo = function (signal) {
    var _a;
    if (!activeWatcher || ((_a = watchersMap.get(signal)) === null || _a === void 0 ? void 0 : _a.has(activeWatcher)))
        return false;
    var watcher = activeWatcher;
    if (!watchersMap.has(signal))
        watchersMap.set(signal, new Set());
    var watchers = watchersMap.get(signal);
    (0, errors_1.assert)(watchers);
    if (!watchers.size) {
        var watchedCallback = watchedCallbackMap.get(signal);
        if (watchedCallback)
            untrack(watchedCallback);
    }
    watchers.add(watcher);
    watcher.onCleanup(function () {
        watchers.delete(watcher);
        if (!watchers.size) {
            var unwatchedCallback = unwatchedCallbackMap.get(signal);
            if (unwatchedCallback)
                untrack(unwatchedCallback);
        }
    });
    return true;
};
exports.subscribeTo = subscribeTo;
var subscribeActiveWatcher = function (watchers) {
    if (!activeWatcher || watchers.has(activeWatcher))
        return false;
    var watcher = activeWatcher;
    watchers.add(watcher);
    if (!watchers.size) {
        var watchedCallback = watchedCallbackMap.get(watchers);
        if (watchedCallback)
            untrack(watchedCallback);
    }
    watcher.onCleanup(function () {
        watchers.delete(watcher);
        if (!watchers.size) {
            var unwatchedCallback = unwatchedCallbackMap.get(watchers);
            if (unwatchedCallback)
                untrack(unwatchedCallback);
        }
    });
    return true;
};
exports.subscribeActiveWatcher = subscribeActiveWatcher;
/**
 * Unsubscribe all watchers from a signal so it can be garbage collected.
 *
 * @param {UnknownSignal} signal - Signal to unsubscribe from
 * @returns {void}
 */
var unsubscribeAllFrom = function (signal) {
    var watchers = watchersMap.get(signal);
    if (!watchers)
        return;
    for (var _i = 0, watchers_1 = watchers; _i < watchers_1.length; _i++) {
        var watcher = watchers_1[_i];
        watcher.stop();
    }
    watchers.clear();
};
exports.unsubscribeAllFrom = unsubscribeAllFrom;
/**
 * Notify watchers of a signal change.
 *
 * @param {UnknownSignal} signal - Signal to notify watchers of
 * @returns {boolean} - Whether any watchers were notified
 */
var notifyOf = function (signal) {
    var watchers = watchersMap.get(signal);
    if (!(watchers === null || watchers === void 0 ? void 0 : watchers.size))
        return false;
    for (var _i = 0, watchers_2 = watchers; _i < watchers_2.length; _i++) {
        var react = watchers_2[_i];
        if (batchDepth)
            pendingReactions.add(react);
        else
            react();
    }
    return true;
};
exports.notifyOf = notifyOf;
var notifyWatchers = function (watchers) {
    if (!watchers.size)
        return false;
    for (var _i = 0, watchers_3 = watchers; _i < watchers_3.length; _i++) {
        var react = watchers_3[_i];
        if (batchDepth)
            pendingReactions.add(react);
        else
            react();
    }
    return true;
};
exports.notifyWatchers = notifyWatchers;
/**
 * Flush all pending reactions of enqueued watchers.
 */
var flush = function () {
    while (pendingReactions.size) {
        var watchers = Array.from(pendingReactions);
        pendingReactions.clear();
        for (var _i = 0, watchers_4 = watchers; _i < watchers_4.length; _i++) {
            var react = watchers_4[_i];
            react();
        }
    }
};
exports.flush = flush;
/**
 * Batch multiple signal writes.
 *
 * @param {() => void} callback - Function with multiple signal writes to be batched
 */
var batch = function (callback) {
    batchDepth++;
    try {
        callback();
    }
    finally {
        flush();
        batchDepth--;
    }
};
exports.batch = batch;
/**
 * Run a function with signal reads in a tracking context (or temporarily untrack).
 *
 * @param {Watcher | false} watcher - Watcher to be called when the signal changes
 *                                    or false for temporary untracking while inserting auto-hydrating DOM nodes
 *                                    that might read signals (e.g., Web Components)
 * @param {() => void} run - Function to run the computation or effect
 */
var track = function (watcher, run) {
    var prev = activeWatcher;
    activeWatcher = watcher || undefined;
    try {
        run();
    }
    finally {
        activeWatcher = prev;
    }
};
exports.track = track;
