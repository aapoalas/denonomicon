# Callbacks

Deno FFI offers the `Deno.UnsafeCallback` API for creating function pointers
that can call back into JavaScript. The calling of these function pointers is
expected to be controlled by the native library that the pointers are passed to.
There are three main cases for calling callback function pointers:

1. Synchronous callbacks
2. Interrupt handlers
3. Thread safe callbacks

Note that all of these cases use the exact same `Deno.UnsafeCallback` class,
meaning that all callbacks created are always safe to call from foreign threads
though the exact results of such a call may differ.

While all callbacks are always safe to call from other threads, the difference
between a synchronous callback and a thread safe callback is that a thread safe
callback will wake up the Deno event loop when called. A synchronous callback
will not wake up the event loop as the expectation is that synchronous callbacks
will never be called from foreign theads and thus there is no need to prepare
for the possibility.

A thread safe callback can be created using the static constructor function
`Deno.UnsafeCallback.threadSafe()`. Alternatively, a synchronous callback can be
made thread safe by calling its `ref()` method. The `threadSafe()` constructor
function is internally equivalent to creating a synchronous callback and then
calling its `ref()` method once.

A thread safe callback will keep Deno's from exiting even if there is not more
work to be done, as the thread safe callback can be expected to call in from
another thread and create more work for the event loop. Calling `unref()` on a
thread safe callback will stop it from keeping Deno from exiting but will not
stop it from waking up the event loop when called.

## Asynchronous work in callbacks

FFI callbacks cannot be asynchronous functions. For synchronous callbacks it
would be impractical to make the native callback wait until some JS asynchronous
work is done. For thread safe callbacks it would be possible to wait until the
Promise resolved but again doing so would be somewhat impractical and most
importantly, FFI callbacks should aim to be fast and quickly return control back
to the calling native library.

This does not mean it shouldn't be possible to kick off asynchronous actions
from callbacks. The most obvious way to kick off asynchronous actions would be
to call an `async` function. In this case the `async` function gets called
synchronously and only once some `await` point is reached will the actual
callback get to return. Essentially, this is no different from inlining the work
into the actual FFI callback, so this is not necessarily appropriate.

There are two multiple ways to kick off some asynchronous work from a
synchronous function without immediately calling into the work. These most
common ones are `setTimeout()` and `queueMicrotask()`.

There are a few surprising caveats to these, however. First: Deno will
synchronously run all microtasks automatically when the callstack becomes empty.
The callstack becomes empty after thread safe callbacks and interrupt handlers
([don't use them](./callbacks/interrupt-handler)) if triggered when Deno is
idle.

This means that for thread safe callbacks, this callback will run everything
inside it before returning control back to the native library:

```ts
const callback = new Deno.UnsafeCallback(
  {
    parameters: [],
    result: "void",
  } as const,
  () => {
    console.log("First");
    queueMicrotask(function microtask() {
      console.log("Third");
      let i = 0;
      let sum = 0;
      while (i < 1_000_000) {
        sum += i;
        i++;
      }
      console.log("Result:", sum);
    });
    console.log("Second");
  },
);
```

The order of logging will be as expected by the log messages themselves:

```log
First
Second
Third
Result: 499999500000
```

Here, the native library will finally regain control after the "Result" line.
Note that the JS callback function itself does return after the "Second" line,
but V8's microtask execution is then triggered after that which leads to the
`function microtask()` being called. Depending on the timing the same can happen
with `setTimeout(() => {}, N)` if `N` is suitably small, eg. 5 or less.

To properly kick off asynchronous work that won't block a thread safe callback
from returning control back to the calling thread, it's recommended to use
`setTimeout(() => {}, 10)` or more. Note that any pointers received by the
callback may become dangling by the time the `setTimeout` fires, and thus any
data extraction should generally be done synchronously.

For synchronous callbacks, using `queueMicrotask(() => {})` is sufficient for
triggering asynchronous work. The reason for this is that, as mentioned above,
the microtask execution is only triggered when the callstack becomes empty and
for synchronous callbacks the callstack does not empty when the callback
returns. Thus, the microtask does not get called immediately after.

## Ref'ing

Callbacks can be ref'ed and unref'ed using the `callback.ref()` and
`callback.unref()` methods. Ref'ing a callback makes Deno stay alive even if
there is no JavaScript code left to run. Additionally, ref'ing a callback for
the first time allows that callback to wake up the Deno event loop when called.
This is useful for thread safe callbacks, as these might be called while Deno
itself is idle.

A callback can be ref'ed multiple times and each time its ref count will be
increased by one. Conversely, unref'ing a callback decreases the ref count by
one and when the ref count reaches zero, the callback no longer keeps Deno from
exiting. This does not stop the callback from waking up the Deno event loop when
called, however.

### Known bugs with ref'ing

Before Deno version 1.26.2, ref'ing a callback would cause Deno to spin the
event loop at 100% CPU. If you need to use FFI callbacks on an older Deno
version, it's better to avoid ref'ing callbacks and instead use eg. a
`setInterval()` to keep the process alive. Also note that the interval you set
determines how often your callbacks are checked for incoming thread safe calls.
If you set the interval very high, eg. 1000 milliseconds, then your thread safe
calls will also have to wait up to that amount of time before they get called on
the main thread.

Before Deno version 1.31.0, unref'ing a callback would cause the callback to
lose its ability to wake up the Deno event loop even if it was ref'ed again
afterwards. Example:

```ts
const cb = new Deno.UnsafeCallback(definition, callback);
cb.ref();
/**
 * cb will now keep Deno from exiting, and will wake up the event loop
 * when called from foreign threads.
 */
cb.unref();
/**
 * cb will no longer keep Deno from exiting and will not wake up the
 * event loop when called from foreign threads.
 */
cb.ref();
/**
 * cb will again keep Deno from exiting, but will not wake up the event
 * loop when called from foreign threads.
 *
 * This could result in the process hanging with 0% CPU usage.
 */
```
