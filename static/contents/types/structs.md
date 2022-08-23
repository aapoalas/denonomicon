# Structs

Structs are not currently supported in Deno FFI, PR is pending:
https://github.com/denoland/deno/pull/15060.

FFI structs are usually represented as `ArrayBuffer`s / `TypedArray`s. As
opposed to pointers, structs are returned as `Uint8Array`s from FFI symbol
calls. The `Uint8Array` owns the struct's memory and controls its lifetime. It
is still possible to get the pointer integer value of a struct using the
`Deno.UnsafePointer.of()` method.

## Fast API support

It can be expected that full Fast API support for structs will be created in due
time.

For parameters the preferred type will quite definitely be `Uint8Array`, and
return values will likely return JS-side pre-allocated `Uint8Array`s that get
passed as extra parameters to the calls.
