# Performance

On a generic PC, the performance of Deno FFI calls can be roughly said to be
between 100's of nanoseconds and less than 10 nanoseconds depending on the call
path taken. FFI calls can either go through the Deno ops layer or the V8 Fast
API call path. In the ops layer the inherent overhead and genericity of the ops
puts the performance on the order of 100's of nanoseconds. In the V8 Fast API
call path no ops are called and the calls are tailored for each FFI symbol
individually, meaning that call performance improves to order of less than 10
nanoseconds for most calls.

The V8 Fast API call path is not available unconditionally, and depends on both
the declared parameter types of the symbol in question and the parameters passed
to call said symbol.

## Slow call (ops layer) performance

Since the ops layer is generic, it needs to iterate over the parameters of the
FFI call. This means that for each additional parameter, the slow call
performance takes a little bit longer.

An example would be that a slow call that takes one 64 bit integer parameter
takes around 150 nanoseconds per call when called using a BigInt parameter,
which forces the slow call path to be utilised. A slow call that takes 26
parameters takes around 650 nanoseconds. This means that a single parameter
iteration takes perhaps around 20 nanoseconds.

## Fast API call performance

The V8 Fast API call path offers the absolute best that V8 can offer. When the
JavaScript code is optimised, the Fast API calls can be taken into use in place
of the generic ops layer bindings if the optimised code matches the call types
of the declared Fast API call. In this case the JIT-compiled, optimised JS code
will in call directly into the C API layer, though with a very thin Fast API
trampoline function included to drop the Fast API receiver object and perform
possible type conversions. The performance of these calls is often below 10
nanoseconds per call and does not have a direct linear increase in call time
with increased number of parameters.
