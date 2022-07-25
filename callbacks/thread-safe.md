# Thread safe callbacks

Thread safe callbacks are callbacks that get called from threads other than the
isolate thread that created the callback. This is not necessarily the main
isolate thread but can also refer to a worker thread. Since it is possible to
send pointer integers to other threads, it is thus possible to eg. use a
callback created on the main thread on a worker thread. All
`Deno.UnsafeCallback`s remember which isolate they were created by, and will
thus always call back to that isolate's thread.

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
