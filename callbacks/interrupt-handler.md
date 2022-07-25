# Interrupt handler callbacks

Interrupt handler callbacks refer to callbacks that are being used, directly or
indirectly, as native interrupt handlers in native library code. When an
interrupt fires, this callback is then called immediately and can interrupt Deno
runtime's currently running code. The V8 isolate is not built to expect these
sorts of calls to exist. Testing has shown that these sorts of callbacks may
work, but occasionally the expectations of the runtime or the V8 engine are
broken by these callbacks and an immediate termination of the process follows.

As interrupt handlers in general, the recommendation is thus to always create
minimal interrupt handlers that eg. only set a bitflag on the native library
side. The FFI code should then be used to poll for the value of that bitflag.

Note that interrupt handlers that fire on threads other than the isolate (main)
thread are [thread safe callbacks](./thread-safe). These have their own working
logic, and the above mentioned breaking of Deno runtime or V8 engine's
expectations does not occur.
