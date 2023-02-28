# Performance

On a generic PC, the baseline performance of Deno FFI calls can be roughly said
to be between 100's of nanoseconds and less than 10 nanoseconds depending on the
call path taken. FFI calls can either go through the generic V8 binding layer or
the V8 Fast API call path. In the generic layer the inherent overhead and
generic nature of the binding puts the baseline performance to around 100 or 150
nanoseconds. In the V8 Fast API call path the calls are tailored for each FFI
symbol individually, meaning that call performance improves to a baseline of
less than 10 nanoseconds per call.

The V8 Fast API call path has restrictions, is not available unconditionally,
and depends on both the declared parameter types of the symbol in question and
the parameters passed to call said symbol. That being said, all of Deno FFI's
currently supported call parameters and return types with the exception of
structs (`{ struct: [...] }`) are either directly supported by the V8 Fast API,
or Deno internally adapts the calls so that Fast API support can be achieved.

Thus, most FFI symbol calls that are not marked nonblocking or with the
`callback` flag can use the V8 Fast API but whether or not that is done depends
on two things:

1. Parameters passed to call the symbol.
2. V8's internal logic on when it decides to optimise the calling code.

## Slow call (generic binding) performance

Since the generic binding function is by necessity generic, it needs to iterate
over the parameters of the FFI call. This means that for each additional
parameter, the slow call performance takes a little bit longer.

An example would be that a slow call that takes one 64-bit integer parameter
takes around 150 nanoseconds per call when called using a BigInt parameter,
which forces the slow call path to be utilised. A slow call that takes 26
parameters takes around 650 nanoseconds. This means that a single parameter
iteration takes perhaps around 20 nanoseconds.

## Fast call performance

The V8 Fast API call path offers the absolute best that V8 can offer. When the
JavaScript code is optimised, the Fast API calls can be taken into use in place
of the generic bindings if the optimised code matches the call types of the
declared Fast API call. In this case the JIT-compiled, optimised JS code will in
call directly into the C API layer, though with a very thin Fast API trampoline
function included to drop the Fast API receiver object and perform possible type
conversions.

The performance of these calls is often below 10 nanoseconds per call and does
not have a direct linear increase in call time with increased number of
parameters. An increase will still be seen as number of parameters increases,
but the relationship will be somewhat non-linear.

## Nonblocking call performance

Nonblocking calls cannot currently be made using Fast API. As a result, they use
the generic binding function path. Additionally, the spawning of a new thread
takes some time and as a result all nonblocking calls can be expected to take at
least 150 nanoseconds. As a result, one should be careful of not needlessly
using nonblocking calls to "improve performance" with multithreading: If the
work your calls do is less than 150 nanoseconds you will only make the direct
call performance worse by using nonblocking calls.

## Example performance results:

The following table gives example performance results of calling native library
symbols that either only take a single parameter of a type, or return a static
value of the type. The performance results should give a basic idea of what sort
of baseline performance one can expect of a native library symbol call with
these kind of simple signatures.

| Operation                           | Slow call performance | Fast call performance |
| ----------------------------------- | --------------------- | --------------------- |
| No-op                               | 46 ns                 | 6 ns                  |
| Param: number / bool                | 83-105 ns [2]         | 6 ns                  |
| Param: bigint                       | 95 ns                 | N/A (deoptimises)     |
| Param: Uint8Array                   | 120 ns                | 7 ns                  |
| Param: ArrayBuffer / XArray [1]     | 120 ns                | N/A (deoptimises)     |
| Return: bool, float, <32bit integer | 43-88 ns [3]          | 6 ns                  |
| Return: 64-bit unsigned integer     | 66-75 ns [4]          | 8-13 ns [4]           |
| Return: 64-bit signed integer       | 88-109 ns [4]         | 22-43 ns [4]          |
| Return: pointer                     | 65 ns                 | 6 ns                  |

[1] `XArray` is for any TypedArray other than `Uint8Array`.\
[2] The range in slow call parameter performance for numbers and booleans is due
to the varying performance of the V8 APIs that are used to extract the data from
the JavaScript value.\
[3] The range in slow call return performance for numbers and booleans,
excepting 64-bit integers, is caused by the varying performance of the V8 APIs
that are used to create the JavaScript return values.\
[4] The range in 64-bit integer return performance is caused by Deno's varying
return type: If the integer can be safely represented as a JavaScript number, it
will be returned as a number at a higher performance. Unsafe integers will be
returned as BigInts at a measurable cost in performance. Additionally, an
internal optimisation is used for unsigned integer returning that improves their
performance compared to signed integers.
