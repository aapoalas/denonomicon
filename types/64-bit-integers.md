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

V8's Fast API does not currently support 64 bit integers as return values.
However, limited support for 64 bit integers as parameters is offered. This
support is conditional on plain numbers being used as the parameter values, that
is no BigInts are allowed. This means that the maximum number that can be used
as a 64 bit integer parameter in FFI calls is equal to
`Number.MAX_SAFE_INTEGER`. If numbers beyond that need to be used, then using
BigInts is the only option and those will deoptimise the function call back onto
the slow path.
