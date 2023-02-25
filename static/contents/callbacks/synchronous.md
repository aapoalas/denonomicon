# Synchronous callbacks

Synchronous callbacks are callbacks that are called synchronously in response to
FFI symbol calls coming from Deno. These can be one of two forms, result
callbacks and stored callbacks.

A result callback is a callback that is called synchronously from the FFI symbol
call that is passed to, and that the native library does not keep a reference
to. A stored callback is a callback that the native library retains a reference
to and is called in response to some other FFI symbol call.

Both of these types of callbacks are supported and can be expected to work well
with Deno FFI. However, these sorts of callbacks are not allowed in Fast API
calls. This is because V8's Fast API calls are not allowed to call back into
JavaScript nor cause any allocations in the isolate.

If an FFI symbol may cause a callback to be called, that symbol must be given
the `"callback": true` option as part of its declaration. This option will
disable Fast API optimisation for the symbol but allows the callback to happen.
If this option is not enabled and a Fast API call tries to call back into
JavaScript, V8 will immediately terminate the program.

## Examples

### Result callback

An FFI method takes two 64-bit number parameters and a callback which is used to
signal success and value, or failure.

```ts
const callback = new Deno.UnsafeCallback(
  {
    parameters: ["u8", "u64"],
    result: "void",
  } as const,
  (status: number, result: number | BigInt) => {
    if (status === 0) {
      // Success, result contains a valid result
      console.log("Result is:", result);
      return;
    }
    // Failure
    console.error("U64 calculation failed with status:", status);
  },
);

// `calculate_u64_sum` must be marked with `"callback": true` in its symbol definition.
lib.symbols.calculate_u64_sum(136346n, 3546n, callback.pointer);
```

### Stored callback

An FFI method is used to save a reference to a callback function which is called
in response to another FFI method call.

```ts
// ID to own callback
const ID_MAP = new Map<number, (value: number) => void>();
const callback = new Deno.UnsafeCallback(
  {
    parameters: ["u32", "u32"],
    result: "void",
  } as const,
  (id: number, value: number) => {
    const callback = ID_MAP.get(id);
    if (!callback) {
      console.error("Unknown ID:", id);
      return;
    }
    // Consider using `queueMicrotask(() => callback(value))` or similar here to
    // decouple the native callback from the potentially slow JS callback handling.
    callback(value);
  },
);

// Some class that contains a `pointer` member and handles the JS side of "item"
const item = new ItemClass();
// `register_item` does not need to be marked with `"callback": true` as it
// never calls the callback function.
const newId = lib.symbols.register_item(item.pointer, callback.pointer);
// Bind the generic callback to our specific ItemClass instance
ID_MAP.set(newId, (value: number) => item.updateValue(value));

// Every second check for value updates
setInterval(() => {
  // This will trigger any `register_item` provided callbacks,
  // meaning that `item.updateValue(value)` calls will happen.
  // `run_item_updates` must thus be marked with `"callback": true` in its symbol definition.
  lib.symbols.run_item_updates();
}, 1000);
```
