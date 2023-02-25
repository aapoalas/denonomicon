# Floating point numbers

FFI supports the IEEE 754 standard's floating point numbers in both the 32-bit
and 64-bit varieties. JavaScript's numbers are always (by spec) IEEE 754
floating point numbers, meaning that any number representable as a JavaScript
number is also valid as a (64-bit) FFI floating point number. Naturally,
floating point numbers are always then represented as plain numbers.

## Fast API support

V8's Fast API calls support both 32-bit and 64-bit floating point numbers.
