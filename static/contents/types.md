# Types

Deno FFI supports the following types:

| Type declaration      | Description                                        |
| --------------------- | -------------------------------------------------- |
| `"bool"`              | Boolean value                                      |
| `"u8"`                | 8-bit (one byte) unsigned integer                  |
| `"i8"`                | 8-bit (one byte) signed integer                    |
| `"u16"`               | 16-bit (two byte) unsigned integer                 |
| `"i16"`               | 16-bit (two byte) signed integer                   |
| `"u32"`               | 32-bit (four byte) unsigned integer                |
| `"i32"`               | 32-bit (four byte) signed integer                  |
| `"u64"`               | 64-bit (eight byte) unsigned integer               |
| `"i64"`               | 64-bit (eight byte) signed integer                 |
| `"f32"`               | 32-bit (four byte) IEEE 754 floating point number  |
| `"f64"`               | 64-bit (eight byte) IEEE 754 floating point number |
| `"usize"`             | Pointer size unsigned integer                      |
| `"isize"`             | Pointer size signed integer                        |
| `"buffer"`            | Generic JavaScript buffer                          |
| `"pointer"`           | Generic pointer                                    |
| `"function"`          | Generic function pointer                           |
| `{ "struct": [...] }` | Struct-by-value with given fields                  |

The actual size of "pointer size" depends on the bitness of the environments.
32-bit computers will have 32-bit pointers and 64-bit computers will have 64-bit
pointers. Currently Deno only supports 64-bit environments but this may change
in the future.
