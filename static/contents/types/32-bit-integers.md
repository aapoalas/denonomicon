# 32 bit and smaller integers

All 32 bit and smaller integers are represented on Deno side as plain JS
numbers. Passing in floating point numbers as integers does not cause a
TypeScript type warning but will cause a runtime error. It will also cause the
symbol function to deopt.

8 and 16 bit numbers are internally converted from the V8 32 bit integer class
using Rust's `as u8` / `as u16` conversion, eg.

```rs
let u8_value = v8::Local::<v8::Uint32>::try_from(arg) // `v8::Uint32` is the V8's internal 32 bit unsigned integer class
  .map_err(|_| type_error("Invalid FFI u8 type, expected unsigned integer"))?
  .value() as u8; // the `.value()` method (`Value()` in C++ API) returns a `u32`
```

and in V8 Fast API calls using implicit C casts as follows:

```C
#include <stdint.h>

// External C API symbol taking two 8 bit integers as parameters
extern int8_t func(int8_t p0, uint8_t p1);

// Internal V8 Fast API call trampoline taking a receiver object and two 32 bit integers as parameters
int8_t func_trampoline(void* recv, int32_t p0, uint32_t p1) {
  // Implicit C cast occurs in the assembly output
  return func(p0, p1);
}
```

## Fast API support

All 32 bit and smaller integers are Fast API compliant as both parameters and
return values.
