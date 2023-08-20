# Basics

Deno FFI is an API in the `Deno` namespace that allows the Deno JavaScript /
TypeScript runtime to access data and call functions from native dynamic
libraries. On Linux a native library would be something like `libfoo.so`, while
on Windows it would be `foo.dll`. Note that these are not executables. If
running executables is required, then the `Deno.spawn` API can be used.

Deno FFI works with native libraries that use the C API. As an example, Deno FFI
cannot call Rust libraries that do not expose C APIs using the `external "C"`
declaration, at least not reliably or without considerable pain.

Using Deno FFI is made up of two steps:

1. Opening (loading) a native library with some symbol declarations.
2. Using the symbols returned by the open API to call into native code.

```ts
// Open a native library
const lib = Deno.dlopen(
  "./libfoo.so",
  {
    // Declare symbols
    method: {
      parameters: ["u8"],
      result: "pointer",
    },
  },
);

// Use symbols
const resultPointer = lib.symbols.method(35);
```

The `Deno.dlopen` API requires both the `--unstable` flag (meaning that this API
is still in flux and there may be API breaks with even Deno patch releases) and
the `--allow-ffi` or `--allow-all / -A` flags. If one or both flags are not
given, the opening of the library will throw an error. The opening will also
throw an error if a declared symbol name is not found in the library. Symbol
types cannot be and are not checked by the open function, so the type
declarations and their validity are left entirely up to the user.

Calling the symbols returned by `Deno.dlopen` does not require the `--allow-ffi`
flag. As such, it is possible to revoke FFI permissions after opening a library
and still keep using the symbols.
