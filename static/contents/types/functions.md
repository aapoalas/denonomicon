# Functions

FFI function pointers come in two flavours: Foreign functions and callbacks.
Function pointers are always represented as pointer objects (or null for null
pointer, ie. "no function"). It is not possible to use a `TypedArray` as a
function pointer, meaning that its not possible to write your own assembly into
a buffer and use it as an executable function.

A foreign function pointer can be called as a function using
`Deno.UnsafeFnPointer`.

Callback function pointers can be created using `Deno.UnsafeCallback`. The
resulting `UnsafeCallback` instance contains a `pointer` member that can be
passed to FFI symbol calls as a pointer value (`"function"` type parameter, or
`"pointer"`).

## Fast API support

Function pointers are equivalent to pointers on the Fast API front. Starting
with Deno 1.31.0 they're always Fast API compliant. See [Pointers](./pointers)
for details.
