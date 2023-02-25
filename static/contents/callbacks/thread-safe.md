# Thread safe callbacks

Thread safe callbacks are callbacks that get called from threads other than the
isolate thread that created the callback.This is not necessarily the main
isolate thread but can also refer to a worker thread. Every
`Deno.UnsafeCallback` is always safe to call from foreign threads but only
thread safe callbacks will actually wake up the Deno event loop when called.

Creating a thread safe callback can be done equivalently with either:

```ts
const tscb1 = Deno.UnsafeCallback.threadSafe(definition, callback);
// or
const tscb2 = new Deno.UnsafeCallback(definition, callback);
tscb2.ref();
```

These two ways to create a thread safe callback are 100% equivalent. In essence,
a thread safe is just a synchronous callback that has been ref'ed. Unref'ing a
thread safe callback does not make it "non thread safe".

It is not possible to send pointer objects to other threads as the pointer
objects are not transferrable but it is possible to get the pointer integer
value of a pointer object using `Deno.UnsafePointer.value()` and send that to
another thread. Then the pointer object can be recreated using
`Deno.UnsafePointer.create()`.

Since it is at least theoretically possible to this way send pointers to other
threads, it is thus possible to eg. use a callback created on the main thread on
a worker thread. All `Deno.UnsafeCallback`s remember which isolate they were
created by, and will thus always call back to that isolate's thread.

Calling back into the callback's isolate's thread is done using message passing.
When callbacks are fired, Deno's internal code detects if the callback is being
called on its own isolate's thread. If the callback is happening on the same
thread, then the callback is handled synchronously. If the callback is happening
on a foreign thread (other isolate thread or thread spawned by the native
library), then Deno's internal code will instead send a message to the
callback's isolate thread. When the isolate's event loop spins, an event loop
middleware (Deno internal system) checks the message queue and upon finding a
pending message will run the actual callback function with its given parameters.
Since this call logic is totally controlled by Deno and, by extension, V8 it's
100% safe as far as internal expectations go.

This means that for example it's safe to use Deno FFI callbacks as native
interrupt handlers if the interrupt is fired on another thread. This could
presumably be forced by creating the callback on the main isolate thread,
sending it to a Worker and using the worker thread to open the FFI symbols and
registering the interrupt handler there.

## Thread safety, ref'ing and unref'ing, and the event loop

As said many times over, all FFI callbacks are always safe to call from foreign
threads in the sense that such a call will not cause the process to crash.

The functional difference between a thread safe callback and a "non thread safe"
one is that a thread safe callback will wake up Deno's event loop when it is
called from a foreign thread. The practical difference between the two is that a
thread safe callback is a `Deno.UnsafeCallback` that has been ref'ed at least
once.

As long as a callback is ref'ed it will keep the Deno process from exiting.
Unref'ing a callback until its ref count becomes 0 will make the callback no
longer keep the process from exiting but _does not_ make the callback "non
thread safe". Effectively, an unref'ed thread safe callback will still wake up
the event loop when called but it will not keep Deno from exiting if there is
not work left to do.

Example:

```ts
// `tscb` is thread safe, its ref count is 1. It will wake up the event loop
// when called and will keep the Deno process from exiting.
const tscb = Deno.UnsafeCallback.threadSafe(definition, callback);

// `cb` is "non thread safe", its ref count is 0. It will not wake up the event
// loop when called from foreign threads and will not keep the Deno process
// from exiting.
const cb = Deno.UnsafeCallback(definition, callback);

// `cb` becomes thread safe, its ref count is 1.
cb.ref();

// `cb`'s ref count goes back down to 0. It will still wake up the event loop
// when called from foreign threads but will no longer keep the Deno process
// from exiting.
cb.unref();
```

An unref'ed thread safe callback can be useful when eg. a native library will
periodically send diagnostic data using a callback to the main thread. The main
thread will want to be woken up to receive these feedback messages but if the
process has otherwise finished its work it should be free to exit.

## Deadlock

With thread safe callbacks, there is a possibility of creating deadlocks in
JavaScript. If a synchronous FFI call causes a callback to be called from a
foreign thread, and the call blocks until the foreign thread to return then a
deadlock will occur. The thread safe callback will send a message to the
originating isolate thread and blocks until the message is handled, while the
originating isolate thread is blocking until the foreign thread returns from
calling the callback. The originating isolate thread cannot check for pending
thread safe messages until the event loop gets to turn, but it cannot turn until
the FFI symbol call returns, which cannot return until the thread safe callback
returns, which cannot return until the pending thread safe messages are checked,
etc.

Normally JavaScript does not need to worry about deadlocks, as asynchronous
programming takes care of that particular class of possible errors. Thread safe
FFI callbacks bring this error class back in. Keep this in mind and have fun.
