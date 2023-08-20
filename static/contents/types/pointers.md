# Pointers

FFI supports pointers in three flavours:

1. Buffers
2. Pointer objects
3. Null pointers

The reason for the two-way split between buffers and pointer objects is based on
[V8's Fast API's](../fast-api) limitations. Null pointers are mentioned here
separately since system level languages often consider null pointers to be a
special case that is assignable to pointer-like types but isn't itself a valid
pointer.

Passing a pointer into an FFI call does nothing to the memory that the pointer
points to, at least directly, nor does it keep the memory from being garbage
collected if it is or points to a JavaScript allocated buffer. There is no
passing of ownership directly implied by a pointer parameter, and whether or not
ownership (ie. responsibility to trigger deallocation) remains with the
JavaScript side or is transferred to the native library side is entirely
dependent on the native library and its expectations for the API.

FFI offers no checks nor validation of whether the pointer is actually valid for
the call or not. eg. It is possible to pass a buffer of size 0 as any pointer
parameter, completely irrespective of the expected size of the memory the
pointer should refer to.

When used as return values of FFI symbols (or parameters for
`Deno.UnsafeCallback`) the three pointer types `"pointer"`, `"buffer"`, and
`"function"` are entirely equivalent: They can only be thought of being
different in terms of documentation at best. Any FFI symbol returning one of
these will return either `null` or a pointer object, depending on if the pointer
is a null pointer or not. Likewise, a `Deno.UnsafeCallback` with pointer type
parameters will always call the JavaScript callback with either `null` or a
pointer object.

### Buffers

A `"buffer"` type parameter can be thought of as being "JavaScript (V8 engine)
owned memory". If your dynamic library's API requires the caller to allocate
memory and pass a pointer to said memory into the dynamic library then you
likely want to use `"buffer"` as the parameter type for that pointer. One common
use case for `"buffer"` is to pass strings from Deno to dynamic libraries.

Any `ArrayBuffer` or `TypedArray` (`Uint8Array` etc.) created in JavaScript can
be passed as a `"buffer"` type parameter to an FFI symbol. It is preferable to
use `Uint8Array` as your API type of choice. Due to limitations of V8's Fast API
Deno FFI needs to choose one buffer type to optimise over all others and
`Uint8Array` is the one we've chosen.

It is also possible to get a pointer object from a buffer using the
`Deno.UnsafePointer.of()` static method (requires FFI permissions) for passing
it as a `"pointer"` type parameter. Similarly, it is possible to do the reverse
using `Deno.UnsafePointerView.getArrayBuffer(pointer, length)` (Warning: Set
length to a non-zero value, zero length buffers are interpreted as null-pointers
in certain V8 APIs including the Fast API thanks to a V8 bug).

Passing the buffer directly or passing the pointer object of the buffer is 100%
equal in function from the native library point of view, the only difference is
in what parameter type the Deno FFI symbol can be called with.

Note that it is much quicker to get the pointer object of a buffer using
`Deno.UnsafePointer.of()` than creating an ArrayBuffer from a pointer using
`Deno.UnsafePointerView.getArrayBuffer()`. As such, if you have a symbol that
will be called with both external pointers and owned buffers, it may be better
to define it as taking a `"pointer"` parameter.

Passing in a too-small buffer as a pointer parameter will likely lead to
undefined behaviour and can not be recommended in any circumstances. Note though
that a zero-length buffer subarray may be useful to signify the end pointer of
an iterator.

### Pointer objects

Starting with Deno 1.31.0, all non-null pointers are represented using an opaque
objects, here called "pointer object" but in V8 engine terms these are
`External` objects. These objects look like plain JavaScript objects with a few
exceptions:

1. They have a null prototype, ie. they have no prototype methods such as
   `hasOwnProperty`.
2. They are not extensibe, ie. their prototype cannot be changed and they cannot
   be assigned to.

Generally pointer objects are received from FFI symbol calls that return
pointers, or created from buffers using the `Deno.UnsafePointer.of()` call.

However, sometimes there is a need for FFI libraries to create a pointer from a
pointer value that they receive eg. inside a buffer or through a pointer. For
reading a pointer from through another pointer the
`Deno.UnsafePointerView#getPointer` method can be used.

```ts
const pointer = lib.symbols.get_pointer();
const otherPointer = new Deno.UnsafePointerView(pointer).getPointer(offset);
```

When a pointer must be extracted from a buffer it means that a 64-bit integer
must be read from the buffer and then a pointer created from that number. This
can be done using the `Deno.UnsafePointer.create()` API.

```ts
const buffer = new Uint8Array(8);
lib.symbols.write_pointer_into_buffer(buffer);
const otherPointer = Deno.UnsafePointer.create(
  new BigUint64Array(buffer.buffer)[0],
);
```

However, note that this is **really** dangerous! There is nothing stopping
anyone from creating pointers with made-up numbers and calling a foreign library
with those made-up pointers (see [Security](../security) for more information on
pointer creation).

### Null pointers

Starting with Deno 1.31.0, all null pointers (not null buffers) are represented
using JavaScripts native `null`. The V8 Fast API also supports `null` to stand
for null pointers for the `"pointer"` parameter type but not for `"buffer"`.

For V8 Fast API support with `"buffer"` parameters it is possible to create a
null pointer buffer using `new Uint8Array()` as V8 always creates a null pointer
backed buffer when the buffer's length is 0. However, it is best to create this
buffer once and reuse it as V8 currently has a bug where creating an empty
buffer "inline" and calling a Fast API optimised function with it will result in
the Fast API call seeing a non-null pointer value in the buffer.

Example:

```ts
// Good way to create a null buffer ahead of time:
const NULL = new Uint8Array();

// Bad way to create a null buffer inline, this doesn't work properly:
lib.symbols.call_with_buffer(new Uint8Array());
```

The `call_with_buffer()` call here is susceptible to the
[V8 bug](https://bugs.chromium.org/p/v8/issues/detail?id=13489).

## Fast API support

Starting with Deno 1.31.0, Deno offers full support for pointers as both
parameters and return values using `null` for null pointer and pointer objects
for non-null pointers.

Previously Deno FFI offered limited support for 64-bit pointer numbers as
parameters and full support as return values (see
[64-bit integers](./64-bit-integers) for details). Even earlier, Deno versions
1.24.2 and 1.24.3 preferred `Uint8Array` buffers for the Fast API path. In
versions after 1.24.3 this changed with the introduction of the `"buffer"` FFI
type which split the pointer support to pointer numbers and pointer buffers.

That change was partially caused by V8's Fast API not supporting type overloads
between 64-bit integers and TypedArrays. Because of this, Deno must choose what
type it prefers on the fast path and what it knocks down onto the slow path. The
choice is then obvious to have different parameter types for the two cases.

Let's recap.

### Before 1.24.2

Pointers were always represented by BigInt values. No fast path support for
pointer values existed.

### 1.24.2, 1.24.3

In 1.24.2 pointers became represented by numbers or BigInts depending on the
numerical value of the pointer. This made it possible to support plain number
pointer integers on the fast path, but the choice was made to prefer
`Uint8Array`s. Fast path support for returning 64-bit numbers, including
pointers, was also added.

Passing pointer parameters as `Uint8Array`s is the optimal call strategy.
Returning pointers on the fast path works.

### 1.25.0

Pointer parameter types split further to `"buffer"` and `"pointer"`.

Passing `"buffer"` type pointer parameters as `Uint8Array`s, and `"pointer"`
type pointer parameters as numbers is the optimal call strategy. Returning
pointers, whether as type `"buffer"` or `"pointer"`, still always return as
numbers or BigInts depending on the numerical value of the pointer.

### 1.31.0

Representation of pointers changed from pointer numbers into pointer objects and
null. The `"pointer"` type parameters can now only be pointer objects or null,
both of which are supported by the V8 Fast API and are thus optimal in call
strategy.

Returning a `"pointer"`, `"buffer"`, or `"function"` always returns either a
pointer object or null.

## Concurrent access and data races

Whenever an `ArrayBuffer` or `TypedArray` is sent to a native library through an
FFI call, whether that call be `nonblocking` or synchronous, the buffer's memory
becomes accessible to the native library for as long as it holds the pointer.

For synchronous calls where the native library does not save the pointer, there
is no issue. For `nonblocking` calls the FFI user should make sure to not read
or write into the buffer before the call's Promise resolves. For cases where the
native library saves the pointer for some indeterminate time, the FFI user needs
to manually ensure that the buffer isn't being used concurrently. Otherwise data
races are guaranteed to occur.

Also note that passing the buffer as a parameter to asynchronous `Deno`
namespace APIs like `Deno.read` also counts as concurrently using the buffer.
This means that while the API call is happening, you should not attempt to read
from or write into the buffer. This is true even when FFI is not used. Even
moreso, if you've passed a buffer to FFI then you shouldn't use it as a
parameter for any `Deno` namespace APIs or for any built-in Web APIs either.

> Doing _anything_ with the buffer from JS while it's being held by the FFI side
> is sus at best.
>
> &mdash; <cite>Andreu Botella</cite>

There is also a way to cause data races with the FFI APIs without calling into
native code. The `Deno.UnsafePointer.of()` API gives a way to get a pointer from
a JavaScript created buffer. Then, the `Deno.UnsafePointerView.getArrayBuffer()`
API (static or instance method) allows for an `ArrayBuffer` to be created from a
pointer value, where the buffer is backed by the pointer's memory and not merely
a copy of it. Combined, these two APIs make it possible to send pointers to
normal buffers to a Worker thread and get concurrent access to the buffer's
memory. This can probably allow for all sorts of wacky things, all of which are
better done using `SharedArrayBuffer`. Doing this also breaks buffer related
assumptions on the V8 engine level, and as such is sure to lead to undefined
behaviour. Do not do this. And when you do, send play-by-play documents of what
sort of wacky weirdness you find so I can enjoy it as well.

## Dangling pointers

Concurrent access to buffers is "sus at best" but not doing anything with a
buffer is also a recipe for disaster by way of dangling pointers.

Before Deno 1.31 it was possible to create dangling pointers when a pointer
object created from a buffer was used as a parameter without ensuring that the
buffer did not get garbage collected.
[Since Deno 1.31](https://github.com/denoland/deno/commit/8db0d393c3451ca720f68a0237474f52adb99b39)
this is no longer an issue as the pointer object is used as a key in a `WeakMap`
that keeps the buffer alive for as long as the pointer object is alive.

It is still possible to cause dangling pointers if you pass a buffer to a
dynamic library and that library holds the pointer while you do not make sure
that the buffer stays alive. Here's an example:

```ts
// ffi.ts
const STATIC_BUFFER = new Uint32Array(2);

lib.symbols.register_buffer(STATIC_BUFFER);

export const callWithStaticBuffer = (pointer: Deno.PointerValue) => {
  lib.symbols.call_pointer_with_implied_u32x2(pointer);
};
```

Looks simple enough: A buffer containing two 32-bit numbers is created and
registered into a dynamic library using the `register_buffer` call. Then some
other API `call_pointer_with_implied_u32x2` is called that would presumably
internally use the `STATIC_BUFFER`'s memory somehow.

The issue is that the `STATIC_BUFFER` is only used once from a JavaScript point
of view, and once the call to `register_buffer` ends it is no longer used.

This will lead to undefined behaviour. The reason is simple: V8 will garbage
collect the `STATIC_BUFFER` after the `register_buffer` call has been completed
as it can tell that no one will ever access the buffer again. The memory will
get reused and `call_pointer_with_u32x2` will find random data behind the second
pointer it has been given.

A possible fix might be to `export` the `STATIC_BUFFER`. Alternatively, assign
the `STATIC_BUFFER` to an object that is then exported. Even if the
`STATIC_BUFFER` is assigned using into a `Symbol` or `#private` so that the
buffer isn't really accessible to code outside the `ffi.ts` it is still probably
enough to keep the buffer from being garbage collected.
