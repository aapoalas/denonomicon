# C++ calling convention

When interfacing with a C++ library the thin you'll need to learn is the
differences in calling convention. We'll take as an example a trivial C++ class
and explore writing an FFI interface for it.

The full example can be found on GitHub in the [example.cpp] and [example.ts]
files.

```cpp
namespace lib {
    class Example {
        public:
        Example(int data);
        ~Example();
        void method() const;
        static Example create(int data);

        private:
        int data_;
    };
}
```

The first issue we'll run into is name mangling.

## Name mangling

The `method()` of our `Example` class is not found in the resulting library with
the name `method` or even `lib__Example__method`. The exact name depends on the
compiler and/or target architecture, but on Linux the resulting name is probably
going to be `_ZNK3lib7Example6methodEv`. The Internet holds many sources for C++
name mangling, but a basic "demangling" of this mangled name is:

1. `_Z`: All manged names start with this prefix.
2. `N`: This is a nested name.
3. `3lib`, `7Example`, `6method`: The parts of the nested name, prefixed by
   their lengths.
4. `E`: This ends the nested name.
5. `v`: This is a function that takes no arguments (a `void` function).

For Deno FFI specifically, name mangling means that when defining the symbol to
load you'll generally want to use the `name` property to define the mangled
name:

```ts
const lib = Deno.dlopen(
  "./libexample.so",
    {
        lib__Example__method(): {
            name: "_ZNK3lib7Example6methodEv",
            parameters: ["buffer"],
            result: "void",
        },
    },
);
lib.symbols.lib__Example__method(new Uint8Array());
```

Now you can call your method with a "plain text" accessor name while giving Deno
the mangled name by which to find the symbol in the dynamic library.

Note that this `method()` is a method of our class, so even though it takes no
parameters from a C++ point of view, it does have a single parameter in our FFI
bindings which corresponds to the `this` argument for the call.

### Finding mangled names

There are probably many good ways to find the manged names of your C++ methods.
The `libclang` library provides an API to get the different mangled names (there
can be many in some cases) of a C++ method, so that could be used to automate
finding the mangled names and mapping them to "plain text" accessor names.

A more manual way (on Linux) is to use the output of the `nm` command. Searching
through the output is tedious but it's a definitely possible to write even
complex C++ FFI interfaces using this method. Just hope that the API doesn't
change too often.

## Constructors

Creating C++ objects requires first reserving memory for them, and then calling
their appropriate constructor on said memory. Here is how we would construct an
instance of our `Example` class:

```ts
const lib = Deno.dlopen(
  "./libexample.so",
    {
        lib__Example__Constructor(): {
            name: "_ZN3lib7ExampleC1Ei",
            parameters: ["buffer"],
            result: "void",
        },
    },
);
const example = new Uint8Array(4);
lib.symbols.lib__Example__Constructor(example, 313);
```

For this class we only need 4 bytes worth of memory, since the class only has
the single `int` data inside it. This information is not directly available
anywhere and often needs to be either calculated or figured out through trial
and error. For this particular example, the author expected the required size to
be 8 but found that the upper 4 bytes of the `Uint8Array` were not being touched
by the constructor and thus were not necessary. Often times a class will still
have its size be a multiple of 8 on a 64-bit computer.

Note also the `C1` in our constructors' mangled name: C++ has three types of
constructors (and destructors):

1. The complete object constructor. (C1)

   This constructor creates the object itself, all data members, and all base
   classes.

2. The base object constructor. (C2)

   This constructor creates the object itself, all data members and all
   non-virtual base classes.

3. The allocating constructor. (C0?)

   This constructor does everything the complete object constructor does and
   allocates the memory for the object. It is not usually seen / used.

If a class has no virtual base classes, then the first two constructors are the
same and will often end up being deduplicated from the library / binary, but the
names remain, at least in GCC compiled libraries. As such, the `nm` output of
the `Example` class will be something like this:

> 0000000000001110 T _ZN3lib7ExampleC1Ei\
> 0000000000001110 T _ZN3lib7ExampleC2Ei\
> 0000000000001120 T _ZN3lib7ExampleD1Ev\
> 0000000000001120 T _ZN3lib7ExampleD2Ev

Note the four names, but only two distinct addresses. For Deno FFI specifically,
if you're only creating objects using the library's C++ API then you should
always be calling the complete object constructor (`C1`) [citation needed]. The
base object constructor is only called from derived classes' constructors.

### Creator functions: Passing C++ objects by-value

Sometimes classes might also have static creator methods, like in our case the
`create()` method. Here C++ starts to show it's weird side. C++ is a curious
language that has a special mention in at least the [System V ABI].

> If a C++ object has either a non-trivial copy constructor or a non-trivial
> destructor, it is passed by invisible reference (the object is replaced in the
> parameter list by a pointer that has class INTEGER).

What this means is that any C++ class instance with a copy constructor and/or
destructor in its interface [citation needed, this may not apply if the
implementations are empty] is never passed-in or returned by-value in a register
even if it could fit in one.

Instead for parameters the instance is passed in by reference (ie. as a
`"pointer"` or `"buffer"` in Deno FFI terms). For return values an extra zero'th
parameter (preceding even a possible `this` argument for non-static class
methods) is added to the function which must be a pointer to a memory buffer to
write the return value object into, and the function changes to return the
pointer number to said memory buffer.

For the `create()` static method this means that our FFI interface needs to look
as follows:

```ts
const lib = Deno.dlopen(
  "./libexample.so",
  {
    lib__Example__create: {
      name: "_ZN3lib7Example6createEi",
      parameters: ["buffer", "i32"],
      result: "pointer",
    },
  } as const,
);

const exampleBuffer = new Uint8Array(4);
const pointer = lib.symbols.lib__Example__create(exampleBuffer, 16);
// The returned pointer is the address of our passed-in buffer.
assertEquals(pointer, Deno.UnsafePointer.of(exampleBuffer));
```

Note: If you do not care for the returned pointer address, it is safe to set the
result as `"void"` to improve performance marginally.

## Destructors

As we saw above with constructors, C++ also has multiple destructors per class.

1. Complete object destructor. (D1)

   This destructor destroys the object itself, as well as data members and all
   base classes.

2. Base object destructor. (D2)

   This destructor destroys the object itself, as well as data members and
   non-virtual base classes.

3. Deleting object destructor. (D0)

   This destructor does everything the complete object destructor does and
   deallocates the object.

As with constructors, for a C++ class with no virtual base classes the two are
equivalent. D1 and D2 destructors do not call `free()` on the memory of the
object, meaning that calling a C++ destructor from Deno on a `Uint8Array` is
safe: C++ will not try to deallocate the underlying `ArrayBuffer`'s memory. As
with constructors, you should always be calling the complete object destructor
(`D1`) from Deno FFI.

If a class has a virtual destructor, however, then things can get interesting.
The reason for a virtual destructor to exist is the following: Imagine you have
a C++ base class `Base` and inherited variant `Derived`. Now, imagine you get a
pointer to an instance of the base class and want to deallocate said instance:

```cpp
void removeInstance(Base* instance) {
    delete instance;
}
```

If the `Base` class does not have a virtual destructor, then this delete call
will only release memory associated with the actual base class. If the
`instance` here happens to be an instance of `Derived`, then any memory
associated with the inherited variant class will be left allocated, causing a
memory leak.

So, a virtual destructor is needed. With a virtual destructor, the call to the
destructor is done through the `instance`'s vtable, and the vtable will contain
pointers to both of the classes' destructors. The deleting object destructor is
called on `delete instance` whereas the complete object destructor is called on
`instance->~Base()`. The base object destructor is only called from derived
classes' destructor.

```cpp
void objectDestructor(Base* instance) {
    instance->~Base();
}

void deletingObjectDestructor(Base* instance) {
    delete instance;
}
```

As the name implies, the deleting object destructor will actually call `free()`
on the memory associated with `instance`. Thus, building an FFI interface to
`baseObjectDestructor` here and calling it with a `Uint8Array` is not safe and
will almost certainly lead to the program crashing.

[System V ABI]: https://wiki.osdev.org/System_V_ABI
[example.cpp]: https://github.com/aapoalas/denonomicon/tree/main/examples/cpp/example.cpp
[example.ts]: https://github.com/aapoalas/denonomicon/tree/main/examples/cpp/example.ts
