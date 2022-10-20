# V8 Fast API: What is it?

The V8 Fast API is an extra binding API meant to offer a low-level interface
between V8's optimised JavaScript execution and external C API functions. The
idea is to do away with the need for V8 to prepare all sorts of generic binding
layer structs just so it can call an external C API binding function, which will
start off by unwrapping all of the binding layer structs to get to the raw data
underneath.

As an example, here is a sample, raw V8 binding function for adding two integers
in Rust:

```rs
fn v8_bind(info: *const FunctionCallbackInfo) {
    // Scope not necessary in our case
    // let scope = &mut unsafe { CallbackScope::new(&*info) };
    let args =
    unsafe { FunctionCallbackArguments::from_function_callback_info(info) };
    let rv = unsafe { ReturnValue::from_function_callback_info(info) };
    let p0 = args.get(0i32);
    let p1 = args.get(1i32);
    if !p0.is_uint32() || !p1.is_uint32() {
        // TODO: Throw exception
        return;
    }
    let p0 = v8::Local::<v8::Uint32>::cast(p0);
    let p1 = v8::Local::<v8::Uint32>::cast(p1);
    let p0: u32 = p0.value();
    let p1: u32 = p1.value();

    let result = p0 + p1;

    rv.set_uint32(result);
}
```

As you can see, the vast majority of this binding function actually deals with
extracting the two `u32` values from the generic `FunctionCallbackInfo` binding
parameter the function gets called with.

Now imagine that on the V8 side a fully JIT-optimised JavaScript function being
called with two `uint32_t` parameters is doing the something like this (again
written in Rust, though V8 code is of course actually in C++):

```rs
/// Optimised from `globalThis.add_two`
fn js_add_two_binding_turbofan_jit(context: *const V8ExecutionContext, p0: u32, p1: u32) -> u32 {
    let p0 = v8::Local::<v8::Value>::cast(v8::Integer::new_from_unsigned(context, p0));
    let p1 = v8::Local::<v8::Value>::cast(v8::Integer::new_from_unsigned(context, p1));
    let info = FunctionCallbackInfo::new(context, &[p0, p1]);
    v8_bind(info);
    // Next:
    // 1. check for throws from the bind function,
    // 2. dig out the return value from the bind function and check if it matches our expected u32,
    // If either happens, deopt.
}
```

This is of course insanity, but it's insanity that must be adhered with
JavaScript in the general case, as there is nothing in JavaScript stopping a
user from doing any number of the following calls:

```js
globalThis.add_two("foo", "bar");
globalThis.add_two(null);
globalThis.add_two();
globalThis.add_two({}, globalThis);
```

## Strictly typed bindings

Now imagine if our `v8_bind` function could be registered to V8 with extra
information explaining what sort of data it expects and returns. Once more,
doing this in a completely general way is likely too hard (or just JavaScript)
but if we restrict the API interface, then this may be possible.

Say we could give the following data to V8:

```rs
enum ApiType {
    U32,
    I32,
    F32,
    F64,
}

struct ApiDeclaration {
    parameter_types: Vec<ApiType>,
    return_type: ApiType,
}
```

Now we could explain to V8 that our `v8_bind` function expects two `U32`
parameters and returns one `U32` as well. Then, if V8 detects that its about to
call `v8_bind` with two `u32`s then it can skip creating the generic binding
layer structs, and our binding function can likewise skip extracting the data
out of those structs. Furthermore, V8 will know from our return type declaration
that the function will return another `U32` so it can skip the return value
extraction and continue on its optimised path.

There are some extra steps skipped, like needing to provide a separate fast
binding function instead of just reusing the `v8_bind` function (which of course
could not work) and V8 using the first argument to pass in the "Holder" (close
to `this` in JavaScript). The final fast binding function becomes this:

```rs
fn v8_bind_fast(_recv: v8::Local<v8::Value>, p0: u32, p1: u32) -> u32 {
    p0 + p1
}
```

and the V8 side call becomes just:

```rs
fn js_add_two_binding_turbofan_jit(context: *const V8ExecutionContext, p0: u32, p1: u32) -> u32 {
    let recv = unsafe { (&*context).get_receiver() };
    v8_bind_fast(recv, p0, p1)
}
```

It's clear from just this that the calling of these fast binding functions is
massively faster, taking to the tone of 1/100th part the time it takes to call
the generic binding layer API.

## The catch

There are a few catches with Fast API:

- Not all JavaScript calls are nice and expected.

Sometimes users make a mistake and call your carefully laid binding function
with the wrong type of argument. When this happens the slow call path needs to
be taken, as the fast call C function API cannot accept wrong argument types.

Even if the argument types themselves match it's still possible that the fast
call may need to fall back onto the slow call. This is something that the fast
call can do optionally, for example if it expects a single argument with a `u32`
value of 0, 1 or 2, but receives `42`. In compiled code this might often be
grounds to an exception, but in Fast API the call can do an early return and
signal to V8 that the slow call should be called for the purpose of throwing a
proper JavaScript exception.

- The API surface needs to be limited.

32 bit integers are easy, but for example expecting V8 to optimally convert your
JavaScript object into a C struct automatically is probably too much to ask.

Even relatively simple things like strings are not yet supported by Fast API
even as parameters.

- No allocating into the V8 heap.

For now at least, V8 does not allow fast calls to do allocations on the V8 heap.
This means that returning any object-like types is out of the question. This
rules out returning not only objects and arrays, but also TypedArrays such as
`Uint8Array` and even BigInts.

- It's experimental.

V8 may be a pretty solid JavaScript engine but Fast API is very much
experimental and only really beginning to take a strong shape. Deno-related Fast
API usage has uncovered at least two major bugs so far
([wrong calling convention
on Apple Silicon](https://bugs.chromium.org/p/v8/issues/detail?id=13171),
[invalid function template data type in fast call options
struct](https://chromium-review.googlesource.com/c/v8/v8/+/3844662)).

Still, one can expect Fast API to do great things for both Deno, FFI and V8
engine usage in general. The ability to call into native code at native speeds
from JavaScript is undeniably powerful.

## Supported Fast API types

As of writing this, these are the known supported types of Fast API.

### Parameters

- Booleans
- Arrays (passed as `Local<Array>`, so essentially only primitive values can be
  used)
- 32 bit integers
- 64 bit integers (JavaScript numbers, meaning limited to
  `Number.MAX_SAFE_INTEGER`)
- 32 and 64 bit floating point numbers
- `Uint8Array`, `Uint32Array`, `Int32Array`, `Float32Array`, `Float64Array`,
  `BigUint64Array`, and `BigInt64Array`
- Catch-all `v8::Local<v8::Value>`: This can theoretically be used to pass any
  value to a fast call but most `v8::Value`s cannot be used in a reasonable
  fashion due to V8 heap allocations being forbidden.

### Return types

- Void
- Booleans
- 32 bit integers
- 32 and 64 bit floating point numbers
