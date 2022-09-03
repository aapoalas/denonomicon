# Pointers

FFI supports pointers in various flavours:

1. Buffers
2. Pointer integers
3. Null pointers

Passing a pointer into an FFI call does nothing to the memory that the pointer
points to, at least directly, nor does it keep the memory from being garbage
collected if it is or points to a JavaScript allocated buffer. There is no
passing of ownership directly implied by pointer parameter, and whether or not
ownership (ie. responsibility to trigger deallocation) remains with the
JavaScript side or is transferred to the native library side is entirely
dependent on the native library and its expectations for the API.

FFI offers no checks or validation of whether the pointer is actually valid for
the call or not. eg. It is possible to pass a buffer of size 0 as any pointer
parameter, completely irrespective of the expected size of the memory the
pointer should refer to.

Any FFI symbol returning a pointer will always return a BigInt, though this may
change in the future (PR pending).

### Buffers

Any `ArrayBuffer` or `TypedArray` (`Uint8Array` etc.) created in JavaScript can
be passed as a pointer parameter to an FFI symbol. It is also possible to get
the pointer integer value from a buffer using the `Deno.UnsafePointer.of()`
static method (requires FFI permissions). Passing the buffer directly or passing
the pointer integer value of the buffer is 100% equal in function, though not
necessarily in performance.

Passing in a too-small buffer as a pointer parameter will likely lead to
undefined behaviour and can not be recommended in any circumstances. Note though
that a zero-length buffer may be useful to signify the end pointer of an
iterator.

### Pointer integers

Any `BigInt` or `number` value can be passed as a pointer integer to an FFI
symbol. Usually these values are expected to either be returned from FFI symbol
calls that return pointers themselves, or from the `Deno.UnsafePointer.of()`
call.

However, there is nothing stopping anyone from calling a foreign library with
made-up pointer values. What happens when that is done is totally undefined and
depends entirely on where the pointer happens to point into. The program may
crash with a segfault, or data may become corrupted and anything and everything
may become possible.

### Null pointers

Null pointers can be passed in as parameters either using `null`, `0` or `0n`.
The first will always work and will always cause a depot, as the V8 Fast API
does not support `null`. The latter two are dependent on the system architecture
(numeric value of null pointer is not necessarily zero) but should generally
work for all modern computers that Deno supports.

## Fast API support

Deno FFI offers limited support for 64 bit numbers as parameters and full
support as return values (see [64 bit integers](./64-bit-integers) for details).
However, Deno versions 1.24.2 and 1.24.3 prefer `Uint8Array` buffers for the
Fast API path. In versions after 1.24.3 this will change with the introduction
of a new `"buffer"` FFI type which will split the pointer support to pointer
numbers and pointer buffers.

This change is partially caused by V8's Fast API not supporting type overloads
between 64 bit integers and TypedArrays. Because of this, Deno must choose what
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
`Uint8Array`s. Fast path support for returning 64 bit numbers, including
pointers, was also added.

Passing pointer parameters as `Uint8Array`s is the optimal call strategy.
Returning pointers on the fast path works.

### 1.25.0 onwards

Pointer parameter types split further to `"buffer"` and `"pointer"`.

Passing `"buffer"` type pointer parameters as `Uint8Array`s, and `"pointer"`
type pointer parameters as numbers is the optimal call strategy. Returning
pointers, whether as type `"buffer"` or `"pointer"`, still always return as
numbers or BigInts depending on the numerical value of the pointer.

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
buffer is also a recipe for disaster by way of dangling pointers. Here's an
example:

```ts
// ffi.ts
const STATIC_BUFFER = new Uint32Array(2);
const STATIC_BUFFER_PTR = Deno.UnsafePointer.of(STATIC_BUFFER);

export const callWithStaticBuffer = (pointer: Deno.PointerValue) => {
  lib.symbols.call_pointer_with_u32x2(pointer, STATIC_BUFFER_PTR);
};
```

Looks simple enough: A buffer containing two 32 bit numbers is created and a
pointer number referencing said buffer is then created from that. The
`callWithStaticBuffer` function then uses the pointer number when calling an FFI
API. There seems to be no direct issue with any of this, and that is not true at
all.

This code will lead to undefined behaviour. The reason is simple: V8 will
garbage collect the `STATIC_BUFFER` after the `STATIC_BUFFER_PTR` number has
been created as it can tell that no one will ever access the buffer again. The
memory will get reused and `call_pointer_with_u32x2` will find random data
behind the second pointer it has been given.

A possible fix might be to `export` the `STATIC_BUFFER`. Alternatively, assign
the `STATIC_BUFFER` to an object that is then exported. Even if the
`STATIC_BUFFER` is assigned using a `Symbol` that is not itself exported and
thus the buffer isn't really accessible to code outside the `ffi.ts` it is still
probably enough to keep the buffer from being garbage collected.
