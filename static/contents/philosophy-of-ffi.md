# Philosophy of FFI

With any foreign function interface, be that between JavaScript and C, Rust and
C++ or any other language pair, there are always unsafe aspects and complex
questions of ownership to consider. Deno FFI is no different and leans very
heavily on the side of user responsibility. Consider the following C API usage
in Rust:

```rs
#[repr(C)]
struct Foo {
    str: [c_char; 50],
    data: c_int,
};

extern fn create_foo() -> *mut Foo;
// extern fn create_foo() -> *mut c_void;
```

Here Rust gives the option to properly define the struct that is used in the FFI
API layer, and additionally makes it possible to explicitly declare that the
`create_foo` function returns not a generic `*mut c_void` pointer but
specifically a mutable pointer to a `Foo` struct instance. Deno FFI does not
have these sorts of options. The only pointer that Deno FFI understands is a
generic pointer: There is no difference between mutable and immutable pointers.
There are also no specific pointers but instead all pointers are generic
pointers, essentially `*mut c_void` pointers from a Rust viewpoint.

This means that the Deno FFI layer will not help you in any way with making sure
that your FFI code is sound. It is possible to access memory beyond the
boundaries associated with a given pointer through that pointer, and Deno FFI
will itself not warn, complain or throw an error in any shape or form. Likewise
it's possible to read memory from a completely made-up pointer. This is of
course undefined behaviour from any reasonable language's point of view. What
actually happens if this is done is one of two possible results: Either memory
will successfully be read, or the operating system detects the process reading
memory outside of its allocated memory and terminates the process immediately.
Needless to say, this is quite fun.

## Ownership

All FFI layers must deal with ownership at the interface in one way or another.
As alluded to above, Deno FFI leaves this completely up to the user. If a native
library creates a struct and passes a pointer to said struct through the FFI
layer to Deno, then the memory allocated for that struct is owned by whoever the
native library expects the ownership to belong to. Often this will be the
receiver of the pointer, that is Deno. Still, nothing dictates that this must be
the case. Whether or not the pointer is understood to carry ownership of the
memory is entirely up to the native library, and is an API contract between the
native library and the Deno FFI user, not between the native library and Deno
FFI itself.

All memory that is allocated by the native library must also be released by the
native library, and vice versa. This means that when you receive a pointer
through Deno FFI that carries ownership with it, you must call some symbol to
return the ownership back to the native library which will then presumably
deallocate the memory behind the pointer. Usually this will be a destructor /
drop function of one sort or another.

On the other hand, if you create an `ArrayBuffer` on Deno side that you pass as
a parameter to some FFI symbol then it is first of all up to you to make sure
that the buffer does not go out of scope and get garbage collected before the
native library no longer uses the pointer. Additionally, if the native library
is understood to take ownership of the memory then one way or another the native
library must let it be known when it is safe to deallocate, that is garbage
collect, the buffer. Note also that if you create a pointer number from a buffer
using the `Deno.UnsafePointer.of()` API, the pointer number will not keep the
buffer from being deallocated and may become a dangling pointer very easily.

## Soundness

Deno FFI does not help you with soundness of calls beyond the call parameter
types directly. It is up to you as the user to make sure that only pointers to
similar types are used in the appropriate symbol calls. The FFI layer will not
warn about any of the following calls:

```ts
lib.symbols.method(new Uint8Array(100));
lib.symbols.method(new Uint8Array(1));
lib.symbols.method(new Uint8Array(0));
lib.symbols.method(0n);
```

Whether or not the `method` API expects a pointer containing 100 bytes, 1 byte
or possibly no bytes at all or even a null pointer is not something that Deno
FFI will know or care about. In this way, it may be more correct to call Deno
FFI an implementation of the C API in Deno.

Likewise there is no guards against data races with buffers. FFI's own
`nonblocking` setting will cause JavaScript buffers to be sent as pointers to a
foreign thread, and there is of course nothing stopping native libraries to do
the same. Effectively this means that the buffer might be concurrently read from
and written to by different threads, leading to data races. It is the FFI user's
responsibility to make sure this does not happen.

It's also possible to create a pointer from a buffer, send that pointer to a
Worker thread and get concurrent access to the buffer by creating a buffer from
the pointer. This breaks a lot of expectations about buffers and concurrency at
the engine level, will lead to data races and is all in all a great route to
undefined behaviour. Do not do it.

Another point of interest is 8 and 16 bit integers. JavaScript does not have
integers in the strict sense, but the V8 engine does implement an internal 32
bit unsigned and signed integer class. Any 8 or 16 bit integers will thus be
internally represented as 32 bit integers by V8. Deno FFI does not implement any
boundary checks for these integer types and will instead just directly truncate
the V8's internal 32 bit integer to the 8 or 16 bit form. Thus, passing an
overflowing integer into an 8 or 16 bit integer parameter will not throw a type
error but will instead be silently converted.

Again, if verification of integer parameters is required and a type error throw
is wanted, then it is up to the user to implement these checks.

## Safety

On the safety-side, it is again up to the user of Deno FFI to make sure memory
is handled safely. There are no checks in Deno FFI APIs for out of bounds memory
access, nor checks against using arbitrary numbers as pointers. There is very
little to be said about all this: Beware of dragons.
