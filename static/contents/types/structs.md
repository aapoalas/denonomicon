# Structs

Since 1.29.3 Deno FFI supports passing structs by value. A struct being passed
by value means that either

1. the struct is small enough for its data to be copied into CPU registers, or
1. the struct is too big and it is passed on the stack or otherwise copied.

Either way, passing by value always means that a copy is being made.

FFI structs are usually represented as `ArrayBuffer`s / `TypedArray`s. As
opposed to pointers, structs are returned as `Uint8Array`s from FFI symbol
calls. The `Uint8Array` owns the struct's memory and controls its lifetime. It
is still possible to get the pointer integer value of a struct using the
`Deno.UnsafePointer.of()` method.

## Fast API support

Structs are not currently supported in Deno FFI's Fast API usage. The reason is
that correct copying of structs is quite complicated and easy to get wrong.
Still, it can be expected that full Fast API support for structs will be created
in due time.

When the support arrives, it will be implemented with `Uint8Array`s just like
the `"buffer"` type. Essentially, from the Deno FFI API point of view it does
not matter if a struct is being passed as a pointer (`"buffer"`) or by value
(`{ "struct": [...]}`), the calling is done in exactly the same way. The only
exception is the above-mentioned return value type, where a `"pointer"` or
`"buffer"` returns a pointer number but returning a struct returns a
`Uint8Array`.

## Struct layout and packing

C structs are by default aligned in such a way that each field in the struct
sits on its natural alignment. This means that for example 64-bit integer fields
always sit on a 64-bit (8 byte) aligned memory slot, 32-bit integers on 32-bit
(4 byte) aligned slots etc.

Deno FFI's structs expect the same to be true for field descriptions. As an
example, the struct

```json
{ "struct": ["u8", "u32"] }
```

will have a size of 64-bits (8 bytes) and an alignment of 4 bytes: The first
`u8` field will sit on the first byte of the struct, and the second `u32` field
will sit on the 4th byte of the struct, thus aligning itself to its natural 4
byte alignment.

It is also possible to have a "packed" C struct. In a packed struct, the
alignment of individual fields is not considered and they're simply copied
byte-for-byte one after the other. Deno FFI does not have a packed
representation option for structs. If you need a packed struct, you'll need to
declare it with individual bytes. The above struct would then become:

```json
{ "struct": ["u8", "u8", "u8", "u8", "u8"] }
```

Now the again the first `u8` field sits on the first byte of the struct but the
four bytes of the `u32` field have been broken up into individual bytes in the
struct, allowing them to be placed directly after the first byte and thus
"packing" the struct into only 5 bytes instead of the original 8. (Note though
depending on the case, the 5 bytes may still be extended into 8 bytes. The
author has no idea if in this case memory would actually be saved or not in, for
example, an array of structs case.)

## Reading and writing data into structs

A struct is commonly represented as a `Uint8Array` in Deno FFI. Reading from and
writing into a struct can of course then be done by simply reading and writing
individual bytes in the `Uint8Array`:

```ts
const firstByte = uint8Array[0];
uint8Array[1] = 14; // write second byte
```

This becomes very unwieldy very quickly when eg. 32-bit or 64-bit numbers are
needed. In these cases using a `DataView` can make the work much simpler. Refer
to the
[DataView documentation on MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView)
for how to use them.

`DataView` can also be used to work with packed structs.
