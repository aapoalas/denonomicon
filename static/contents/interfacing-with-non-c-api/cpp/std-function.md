# C++ `std::function`

Often times, C++ libraries will use lambdas and other callbacks in their APIs.
Unfortunately, the author has not found a way to make these work in an FFI
interface. The best efforts are documented here.

## `std::function` compiled by GCC

The memory layout of a general `std::function` looks something like this:

```cpp
struct {
    void* callback_data_,
    void* userdata_,
    void* unknown_1_,
    void* unknown_2_,
}
```

If a lambda binds over a single variable that is at most a pointer in size, it
will be stored in the `userdata_`. In this case the `callback_data_` pointer may
also directly correspond with the C function call that implements the actual
function call.

The contents of the `unknown_`s I have not managed to ascertain. They seem to be
pointers to structs of pointers, but what those pointers are and what they
represent is not clear.
