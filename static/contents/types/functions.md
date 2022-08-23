# Functions

FFI function pointers come in two flavours: Foreign functions and callbacks.
Function pointers are always represented as pointer integers (number or BigInt).
It is not possible to use a `TypedArray` as a function pointer, meaning that its
not possible to write your own assembly into a buffer and use it as an
executable function.

A foreign function pointer can be called as a function using
`Deno.UnsafeFnPointer`.

Callback function pointers can be created using `Deno.UnsafeCallback`. The
resulting `UnsafeCallback` instance contains a `pointer` member that can be
passed to FFI symbol calls as a pointer value.

## Fast API support

Function pointers are always expected as numbers on the Fast API path. If a
pointer does not fit into a plain JavaScript number and must be represented as a
BigInt, it will lead to the symbol call falling back onto the slow path.

Other than that, `"function"` type pointers are equivalent to pointers on the
Fast API front. See [Pointers](./pointers) for details.
