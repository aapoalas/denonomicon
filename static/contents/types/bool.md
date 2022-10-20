# Boolean values

FFI supports boolean values, represented as JavaScript booleans (`true` or
`false`). The native code representation of a boolean value isn't actually
strictly defined, but it is probably safe to assume that if your native library
is written in a language with booleans in it (eg. C, C++, Rust) then the FFI
boolean value will match the library.

## Fast API support

V8's Fast API calls support booleans as both parameters and return values.
