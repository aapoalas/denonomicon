# Future of Deno FFI

**Disclaimer:**

In this document the author of Denonomicon will discuss some of his ideas for
the future of Deno FFI. The author is at the time of writing this contracted by
Deno Land Inc to help with development of the Deno CLI application, especially
with handling open source contributions to the code base. The author is also a
regular contributor to Deno FFI in particular.

Through these two positions, the author has considerable pull on where the
future direction of Deno FFI. In that sense this document can be viewed as a
roadmap for FFI. However, the author does not make decisions on Deno FFI and
thus this is still just a personal wishlist rather than an official roadmap.

With that out of the way, here are some future items that the author would like
to implement for Deno FFI.

## Fast BigInts for 64-bit integers

Currently, FFI uses numbers for 64-bit integers and only returns BigInts if the
numeric value of the integer cannot be represented as a safe integer using
JavaScript's number type (this limit comes from the IEEE 754). This is chosen
for performance reasons, as V8's Fast API supports safe integers as 64-bit
integer parameters whereas BigInts are not supported at all in the Fast API.

The author has an
[open pull request](https://chromium-review.googlesource.com/c/v8/v8/+/4103340)
to change this. If merged as-is, it would allow for Deno FFI to choose on a
function-by-function basis if its 64-bit integer parameters and return values
should be represented as JavaScript numbers or BigInts. This would mean that
returning 64-bit integers as numbers from FFI calls would become natively
supported by Fast API but these would be unsafe: If a non-safe integer was
returned then information would be lost.

If loss of information isn't an option then BigInts could be chosen but this
would mean that not only the return value but also any 64-bit integer parameters
of said call would need to be BigInts to enter the Fast API path.

It might be best to at least by-default always choose BigInts in FFI, and allow
users to unsafely opt-in to number representation.

## FFI tokens

Currently FFI permissions are essentially either on or off, there is no in
between. The `--allow-ffi` flag does allow paths to be given, but most FFI APIs
beyond `Deno.dlopen()` do not actually work if only a path is provided.

Furthermore, many FFI APIs are either required or at least very useful for FFI
libraries during their runtime. APIs such as `Deno.UnsafeCallback` and
`Deno.UnsafePointer.of()` are not necessarily all that powerful on their own and
are absolutely required for libraries. Due to these runtime FFI API needs, an
application that uses an FFI library cannot simply load the library and then
revoke FFI permissions so as to make sure no other third party code can load
other libraries. (This same goes for N-API at the moment.)

The author is hoping to change this at least partially with something currently
named FFI tokens. Example:

```ts
// mylib/ffi.ts

// Open a library. Requires FFI permissions.
const mylib = Deno.dlopen(path, symbolDefinitions);

// Create an FFI token. Requires FFI permissions.
const token = Deno.ffiToken("mylib/ffi.ts");

// Revoke FFI permissions.
Deno.permissions.revokeSync("ffi");

// Call a symbol: This does not require permissions even now.
mylib.symbols.func();

// Create a callback with the FFI permissions "snapshotted" by the token.
const cb = new token.UnsafeCallback(definition, callback);
```

An FFI token would act as a "snapshot" of the FFI permissions. Internally it
would carry some "token secret" that would be verified on each call, and the
token secret would never be leaked out of the token.

FFI library creators would be encouraged to never export a token from any
module, but instead create a token per module. This way the library could at
runtime use the permissions that were given to it at load time, while allowing
the user of the library to stop any further FFI permission usage. Finally, with
tokens not being exported it would mean that excepting a remote code execution
attack that managed to target the FFI library itself or an attack that caused V8
heap to corrupt and become editable to an attacker, it would be impossible for
an attacker to gain access to FFI APIs through a token.

Due to the high level of risk associated with `--allow-ffi`, it might even be
preferable to move all of Deno FFI APIs behind a token with the exception of
token creation and library loading of course. This would serve to "namespace"
FFI APIs at the same time.

## Random ideas

### SafeFFI API

To a degree at least, it might be possible for Deno to offer guarded APIs for
interacting with FFI. As an example, with a SafeFFI API reading memory through a
`"pointer"` type result would not be allowed, similarly to how a `*mut c_void`
is not allowed to be written into in safe Rust.

Instead, parameter and result types would need to be registered beforehand using
a separate API. Example:

```ts
const MyClass = Deno.ffi.registerClass({ struct: ["pointer", "u32", "u64"] });

const lib = Deno.dlopen(path, {
  call: {
    parameters: [],
    result: MyClass,
  },
});

const myClassInstance = lib.symbols.call();
assertInstanceOf(myClassInstance, MyClass);
```

These registered types would allow for reading and writing of their declared
fields, depending on the set mutability of those fields. Similarly these
registered types would allow creating new instances of those types with given
field values.

This sort of API would necessarily be both easier and harder to use, and would
definitely lose in performance what it gains in safety compared to raw FFI. It
could still be at least a good alternative offered.
