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

Any `BigInt` value can be passed as a pointer integer to an FFI symbol. Usually
these values are expected to either be returned from FFI symbol calls that
return pointers themselves, or from the `Deno.UnsafePointer.of()` call. However,
this is not guaranteed in any shape or form and thus it is entirely possible to
call a foreign library with made-up pointer values. What happens when that is
done is totally undefined and depends entirely on where the pointer happens to
point into. The program may crash with a segfault, or data may become corrupted
and anything and everything may become possible.

### Null pointers

Null pointers can be passed in as parameters either using `null` or `0n`. The
first will always work and will always cause a depot, as the V8 Fast API does
not support `null`. The latter is dependent on the system architecture (numeric
value of null pointer is not necessarily zero) but should generally work for all
modern computers that Deno supports. It may also gain V8 Fast API support at
some point.

## Fast API support

V8's Fast API does not currently support BigInts and its support for 64 bit
integers is limited to number type parameters, meaning values equal or less than
`Number.MAX_SAFE_INTEGER`. It is thus not possible to return a 64 bit pointer
integer value using V8 Fast API calls. Additionally, V8's Fast API does not
support parameter type overloads (except for TypedArray / Array of primitives
overloads) and as such it is not possible for Deno to directly support
overloaded pointer parameters that would accept both numbers (BigInts if Fast
API support arrives one day) and `ArrayBuffer`s and `TypedArray`s.

Thus, Fast API calls only work for such pointers that fit within the
`Number.MAX_SAFE_INTEGER` limit and are used as parameters. Pointer type return
values always deopt the symbol call.

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
