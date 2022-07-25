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

**Note that currently, ref'ing a callback will cause Deno to spin the event loop
at 100% CPU! Before the bug is fixed, it's better to avoid ref'ing callbacks and
instead use eg. a `setInterval`!**
