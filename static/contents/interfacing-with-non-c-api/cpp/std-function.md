# C++ `std::function`

Often times, C++ libraries will use lambdas and other callbacks in their APIs.
For GCC and Clang the memory layout and functionality of lambdas is simple
enough as to be workable from JavaScript. For MSVC (Windows), the proper
solution is not known by the author at this time.

## `std::function` compiled by GCC

The memory layout of a general `std::function` looks like this:

```cpp
struct StdFunctionData {
    // bound function and bound variables
}

struct StdFunction {
    StdFunctionData* callback_data_,
    void* userdata_,
    (void*)(StdFunction* dst, StdFunction* src, uint32_t op) operation_callback_,
    (void*)(StdFunction* self, void* param0, void* param1) call_dispatch_callback_,
}
```

The `callback_data_` will hold the bound function of a lambda, that is the
function that will be called with both the outside and bound parameters of the
lambda.

If a lambda binds a single variable that is at most a pointer in size, it will
be stored in the `userdata_`. Otherwise, the variables get stored in the
`callback_data_` struct.

The two functions in the struct are the operation callback and the call
dispatcher callback. The operation callback is always called with two pointers
pointing to lambdas of this type. The third parameter defines what sort of
operation is being performed. The operation code `2` defines a copy / move /
replace command, where `src` is replacing `dst`. The operation code `3` defines
a deletion, in which case `dst` and `src` are the same. Presumably operation
code `1` would indicate a creation but that cannot be seen with JavaScript
created lambdas since the "creation" happens on the JavaScript side.

The call dispatch callback is the function that is called by the
`std::function`'s call operator method. It is called with all pointer type
parameters. If the call operator itself is called with a pointer parameter, then
that pointer will be passed on as a parameter to the dispatch callback as is. If
the call operator is called with plain values, such as numbers, then the
dispatch callback is called with pointers to those values. The dispatch
function's mission is then to join the passed-in parameters with any lambda
bound parameters, and call the function held in `callback_data_` with all these
parameters together.

For a Deno FFI created C++ lambda, we do not need a separate internal function
and the dispatch function. Instead, the `userdata_` can be used to hold a number
key that then on JavaScript side is used to select a JavaScript callback from a
`Map<number, Function>` that is then called with the parameters extracted from
the pointers passed into the dispatch function.

As a result, a GCC / Clang semi-compliant C++ lambda for Deno FFI would look
something like this:

```ts
const CB_MAP = new Map<number, (p0: Deno.PointerValue, p1: number)>();

const DISPATCH_CALLBACK = new Deno.UnsafeCallback({
    parameters: ["pointer", "pointer", "pointer"], // self and two parameters
    result: "void",
}, (self, p0, p1) => {
    const key = new Deno.UnsafePointerView(self).getUint64(8); // hop over the `callback_data_` to read `userdata_`
    const cb = CB_MAP.get(key)!;
    cb(p0, new Deno.UnsafePointerView(p1).getUint32()); // pointer param is passed as-is, numbers are references
});

const OPERATION_CALLBACK = new Deno.UnsafeCallback({
    parameters: ["pointer", "pointer", "u32"],
    result: "void",
}, (dst, src, op) => {
    if (op === 2) {
        // TODO: copy key from src to dst
    }
});

const LAMBDA = new Uint64Array(4);
LAMBDA[2] = BigInt(OPERATION_CALLBACK.pointer);
LAMBDA[3] = BigInt(DISPATCH_CALLBACK.pointer);
```

A new lambda is created by adding a callback function to the CB_MAP with a new
key, setting that key to `LAMBDA[1]` and using the `LAMBDA` as a `"buffer"`
parameter (use a dedicated `Uint8Array` view for best performance).

## `std::function` compiled by MSVC

The MSVC `std::function` is double the size of that in GCC and Clang, that is
instead of 4 bytes it is 8 bytes. The author does not at this moment know what
the different slots in that exactly do, except that most of the slots are indeed
user data slots.
