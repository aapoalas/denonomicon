# Synchronous callbacks

Synchronous callbacks are callbacks that are called synchronously in response to
FFI symbol calls coming from Deno. These can be one of two forms, result
callbacks and stored callbacks.

A result callback is a callback that is called synchronously from the FFI symbol
call that is passed to, and that the native library does not keep a reference
to. A stored callback is a callback that the native library retains a reference
to and is called in response to some other FFI symbol call.

Both of these types of callbacks are supported and can be expected to work well
with Deno FFI. However, these sorts of callbacks are not allowed in Fast API
calls. This is because V8's Fast API calls are not allowed to call back into
JavaScript nor cause any allocations in the isolate.

If an FFI symbol may cause a callback to be called, that symbol must be given
the `"callback": true` option as part of its declaration. This option will
disable Fast API optimisation from the symbol but allows the callback to happen.
If this option is not enabled and a Fast API call tries to call back into
JavaScript, V8 will immediately terminate the program.
