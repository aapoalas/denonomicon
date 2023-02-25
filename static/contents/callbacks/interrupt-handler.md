# Interrupt handler callbacks

Interrupt handler callbacks refer to callbacks that are being used, directly or
indirectly, as native interrupt handlers in native library code. When an
interrupt fires, this callback is then called immediately and can interrupt Deno
runtime's currently running code. The V8 isolate is not built to expect these
sorts of calls to exist. Testing has shown that while these sorts of callbacks
may work, they cannot be relied upon. Interrupt callbacks cause undefined
behaviour on at least Deno runtime and V8 engine level, if not all the way down
to the C++ level.

Possible results of using these sorts of callbacks have been shown to be at
least:

- Immediate termination of process.
- Callback being called, but it having no noticeable effect in running V8 code
  due to engine expectations of immutability.

As such, using FFI callbacks as interrupt handlers or calling them from
interrupt handlers is undefined behaviour and should not be done. As with
interrupt handlers in general it is recommended to rather create a minimal
native code interrupt handler that eg. only sets a bitflag inside the native
library. Then, on Deno FFI side setup a `setInterval()` that calls some native
library API that returns the value of the bitflag. When the interrupt fires, it
sets the bitflag value and does nothing else. The interval on Deno side will see
the changed value on the next call.

Note that interrupt handlers that fire on threads other than the isolate (main)
thread are [thread safe callbacks](./thread-safe). These have their own working
logic and are not subject to the above undefined behaviour.
