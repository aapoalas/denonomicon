# Structs

Structs are not currently supported in Deno FFI, PR is pending:
https://github.com/denoland/deno/pull/15060.

FFI structs are usually represented as `ArrayBuffer`s / `TypedArray`s. As
opposed to pointers, structs are returned as `Uint8Array`s from FFI symbol
calls. The `Uint8Array` owns the struct's memory and controls its lifetime. It
is still possible to get the pointer integer value of a struct using the
`Deno.UnsafePointer.of()` method.

## Fast API support

See [Pointers](./pointers).
