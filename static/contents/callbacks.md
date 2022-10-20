# Callbacks

Deno FFI offers the `Deno.UnsafeCallback` API for creating function pointers
that can call back into JavaScript. The calling of these function pointers is
expected to be controlled by the native library that the pointers are passed to.
There are three main cases for calling callback function pointers:

1. Synchronous callbacks
2. Interrupt handlers
3. Thread safe callbacks

Note that all of these cases use the exact same `Deno.UnsafeCallback` API,
meaning for instance that all callbacks created are always safe to call from
foreign threads.

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

There are two ways to kick off some asynchronous work from a synchronous
function without immediately calling into the work. These are `setTimeout` and
calling `.then()` on a Promise.

There are a few surprising caveats to these, however. First: Deno will
synchronously run all microtasks automatically when the callstack becomes empty.
The callstack will become empty after thread safe callbacks and interrupt
handlers ([don't use them](./callbacks/interrupt-handler)) if triggered when
Deno is idle.

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
    Promise.resolve().then(() => {
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
`.then()` call being run. Depending on the timing the same can happen with
`setInterval(() => {}, N)` if `N` is suitably small, eg. 5 or less.

To properly kick off asynchronous work that won't block a thread safe callback
from returning control back to the calling thread, it's recommended to use
`setInterval(() => {}, 10)` or more. Note that any pointers received by the
callback may become dangling by the time the `setInterval` fires, and thus any
data extraction should generally be done synchronously.

For synchronous callbacks, using `Promise.resolve().then(() => {})` is
sufficient.

## Ref'ing

Callbacks can be ref'ed and unref'ed using the `callback.ref()` and
`callback.unref()` methods. Ref'ing a callback makes Deno stay alive even if
there is no JavaScript code left to run. This can be useful especially with
thread safe callbacks, as there might not be any code left to run until a
callback is fired.

A callback can be ref'ed multiple times and each time the ref count will be
increased by one. Conversely, unref'ing a callback decreases the ref count by
one and when the ref count reaches zero, the callback no longer keeps Deno from
exiting.

Note that until Deno version 1.26.2, ref'ing a callback would cause Deno to spin
the event loop at 100% CPU. If you need to use FFI callbacks on an older Deno
version, it's better to avoid ref'ing callbacks and instead use eg. a
`setInterval` to keep the process alive. Also note that the interval you set
determines how often your callbacks are checked for incoming thread safe calls.
If you set the interval very high, eg. 1000 milliseconds, then your thread safe
calls will also have to wait up to that amount of time before they get called on
the main thread.
