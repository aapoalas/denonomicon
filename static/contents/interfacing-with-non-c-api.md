# Interfacing with non-C API libraries

The way that an FFI interface is built and and used shouldn't change too much
with the language used to build the library. Most reasonable libraries offer a C
API, which will then be largely equivalent no matter the language actually used
in the library.

If a library does not offer a proper C API, however, then all bets are off. This
is normally the point where any reasonable developer will give up and write a
custom C API adaptor library to interface through. That is not strictly
necessary, at least not all the time.

The calling convention of any dynamic library is still at its core a C calling
convention [citation needed, the author does not know if this is true but thinks
it is]. So, if one is sufficiently persistent and industrious, it is possible to
write an FFI interface to libraries that do not offer a C API.

## Interfacing with C++ libraries

Perhaps the most common non-C API used by libraries is the C++ API. For example,
the Clang Tools Organization provides the LibTooling C++ library as an
alternative to the C API libclang library. Often a C++ API may be more powerful
or convenient than a pure C API. Thus, it is a tempting idea to interface
directly with a C++ API.

There are quite a few issues to deal with when writing an FFI interface to a C++
library. Some of these may not be solveable, while others may actually work in
your favour. Let's explore some of them:

- [C++ calling convention](./cpp/calling-convention)
- [C++ inheritance](./cpp/inheritance)
- [C++ std::function](./cpp/std-function)
