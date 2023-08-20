# Types

Deno FFI supports the following types:

| Type declaration      | JavaScript                                                 | Description                                        |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| `"bool"`              | `boolean`                                                  | Boolean value                                      |
| `"u8"`                | `number`                                                   | 8-bit (one byte) unsigned integer                  |
| `"i8"`                | `number`                                                   | 8-bit (one byte) signed integer                    |
| `"u16"`               | `number`                                                   | 16-bit (two byte) unsigned integer                 |
| `"i16"`               | `number`                                                   | 16-bit (two byte) signed integer                   |
| `"u32"`               | `number`                                                   | 32-bit (four byte) unsigned integer                |
| `"i32"`               | `number`                                                   | 32-bit (four byte) signed integer                  |
| `"u64"`               | `number \| bigint`                                         | 64-bit (eight byte) unsigned integer               |
| `"i64"`               | `number \| bigint`                                         | 64-bit (eight byte) signed integer                 |
| `"f32"`               | `number \| bigint`                                         | 32-bit (four byte) IEEE 754 floating point number  |
| `"f64"`               | `number \| bigint`                                         | 64-bit (eight byte) IEEE 754 floating point number |
| `"usize"`             | `number \| bigint`                                         | Pointer size unsigned integer                      |
| `"isize"`             | `number \| bigint`                                         | Pointer size signed integer                        |
| `"buffer"`            | `Uint8Array` (or `ArrayBuffer`, or any other `TypedArray`) | Generic JavaScript buffer                          |
| `"pointer"`           | `null \| {}` (pointer object)                              | Generic pointer                                    |
| `"function"`          | `null \| {}`                                               | Generic function pointer                           |
| `{ "struct": [...] }` | `Uint8Array` (or `ArrayBuffer`, or any other `TypedArray`) | Struct-by-value with given fields                  |

The actual size of "pointer size" depends on the bitness of the environments.
32-bit computers will have 32-bit pointers and 64-bit computers will have 64-bit
pointers. Currently Deno only supports 64-bit environments but this may change
in the future.
