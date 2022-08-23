# 64 bit and pointer integers

For the purposes of current FFI, 64 bit integers include all of the following:

- `"u64"`
- `"i64"`
- `"usize"`
- `"isize"`

64 bit integers can be represented by either plain JS numbers or BigInts. FFI
symbols will currently returns 64 bit integers as plain numbers or BigInts if
the value doesn't fit in a normal JavaScript number.

## Fast API support

Fast API offers limited support for 64 bit integers as parameters. This support
is conditional on the parameters being called using plain numbers, that is
BigInts are not allowed. This means that the maximum number that can be used as
a 64 bit integer parameter in Fast API FFI calls is equal to
`Number.MAX_SAFE_INTEGER`. If numbers beyond that need to be used, then using
BigInts is the only option and the function call will fall back onto the slow
path.

For return values, Fast API does not currently support 64 bit integers at all.
However, a workaround is in use in Deno that makes it possible to return 64 bit
integers from C calls using the Fast API. This workaround is to create and pass
in an extra `Uint32Array` of length two to the Fast API call and use that as an
out pointer for the return value.

As such, in Deno FFI 64 bit integers have limited support as parameters and full
support as return values.
