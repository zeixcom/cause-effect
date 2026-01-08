"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEffect = void 0;
var errors_1 = require("./errors");
var system_1 = require("./system");
var util_1 = require("./util");
/* === Functions === */
/**
 * Define what happens when a reactive state changes
 *
 * The callback can be synchronous or asynchronous. Async callbacks receive
 * an AbortSignal parameter, which is automatically aborted when the effect
 * re-runs or is cleaned up, preventing stale async operations.
 *
 * @since 0.1.0
 * @param {EffectCallback} callback - Synchronous or asynchronous effect callback
 * @returns {Cleanup} - Cleanup function for the effect
 */
var createEffect = function (callback) {
    if (!(0, util_1.isFunction)(callback) || callback.length > 1)
        throw new errors_1.InvalidCallbackError('effect', callback);
    var isAsync = (0, util_1.isAsyncFunction)(callback);
    var running = false;
    var controller;
    var watcher = (0, system_1.createWatcher)(function () {
        watcher.run();
    }, function () {
        if (running)
            throw new errors_1.CircularDependencyError('effect');
        running = true;
        // Abort any previous async operations
        controller === null || controller === void 0 ? void 0 : controller.abort();
        controller = undefined;
        var cleanup;
        try {
            if (isAsync) {
                // Create AbortController for async callback
                controller = new AbortController();
                var currentController_1 = controller;
                callback(controller.signal)
                    .then(function (cleanup) {
                    // Only register cleanup if this is still the current controller
                    if ((0, util_1.isFunction)(cleanup) &&
                        controller === currentController_1)
                        watcher.onCleanup(cleanup);
                })
                    .catch(function (error) {
                    if (!(0, util_1.isAbortError)(error))
                        console.error('Error in async effect callback:', error);
                });
            }
            else {
                cleanup = callback();
                if ((0, util_1.isFunction)(cleanup))
                    watcher.onCleanup(cleanup);
            }
        }
        catch (error) {
            if (!(0, util_1.isAbortError)(error))
                console.error('Error in effect callback:', error);
        }
        running = false;
    });
    watcher();
    return function () {
        controller === null || controller === void 0 ? void 0 : controller.abort();
        try {
            watcher.stop();
        }
        catch (error) {
            console.error('Error in effect cleanup:', error);
        }
    };
};
exports.createEffect = createEffect;
