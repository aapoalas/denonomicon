# C++ inheritance

C++ often uses inheritance. Sometimes a C++ API may also offer just a pure
virtual class that the API user must implement to interface with the library.
When faced with an API like this with FFI, the smart thing to do is to give up
and do something else.

If you do not feel like being smart, I have good news for you: It is possible to
do inheritance through an FFI interface layer, at the very least with GCC
compiled C++. With other compilers your mileage may vary, though the basic idea
is definitely the same.

At the core of C++ inheritance is the virtual table or vtable for short. A class
that inherits from a virtual class will have a vtable pointer at the beginning
of its memory layout. A call to a virtual method will then indirectly find the
instance's implementation of said method through the vtable pointer and call
that instead of doing a direct call to a known function in the library.

C++ has two flavours of inheritance: Single inheritance and multiple
inheritance.

Single inheritance concerns classes that inherit from a single base class,
whereas multiple inheritance of course inherits from multiple classes. If you
want to implement multiple inheritance through an FFI layer, I wish you luck.

## Single inheritance

Before we being creating our own inherited C++ class in Deno, let's take a look
at the memory layout of the vtable. This is the layout from a GCC compiled C++
library, so if you're using some other compiler then your vtable may look
completely different.

We'll be using the [inherited_class.cpp] example as our base. Apologies for the
TypeScript code being a mess.

Let's start with our base class (some parts omitted):

```cpp
class PartiallyVirtualClass {
public:
  PartiallyVirtualClass(int data);
  virtual ~PartiallyVirtualClass();

  virtual void doData(int data);
  virtual void useData(int data);
  virtual void maybeData() = 0;
};
```

We have here fourt virtual methods, one of which are pure virtual and one is the
destructor. As we already learned in the [C++ calling convention], C++ has three
destructors of which 1 is often a duplicate. Thus, our actual number of virtual
functions in this example is 5:

- 2 for the destructors (deleting, and complete / base)
- 1 for each of the virtual methods.

Additionally, our virtual table will need to hold a pointer to the object's
[type info](https://cplusplus.com/reference/typeinfo/type_info/), plus one extra
pointer sized slot at the beginning which the author is not sure what it is for
(it may be a slot for the third destructor, or may have something to do with
multiple inheritance).

The final vtable looks like this:

```cpp
struct PartiallyVirtualClass_VTABLE {
    void* unknown_, // This is usually 0
    void* type_info_, // If library is built with `-fno-rtti` this is also 0
    void* destructor_D1, // complete / base object destructor: For base class this is often 0 as well
    void* destructor_D0, // deleting destructor: for base class this is often 0 as well
    void* doData_method,
    void* useData_method,
    void* maybeData_method,
}
```

If we read the values in our `libinherited_class.so`'s vtable for the
`PartiallyVirtualClass` then we find the following data:

```ts
[
  0,
  examplelib__PartiallyVirtualClass__type_info,
  0,
  0,
  examplelib__PartiallyVirtualClass__doData,
  examplelib__PartiallyVirtualClass__useData,
  __cxa_pure_virtual,
];
```

The destructor pointers are zeroed out, presumably as unnecessary. The method
calls that the class implements are then present in the vtable while finally the
pure virtual function is replaced by a pointer to a C++ injected
`__cxa_pure_virtual` function, which just prints out
`pure virtual method called` and terminates the program.

The order of methods in the vtable depend on how they're declared in the class
header, including the destructors'. If the destructors were moved to be the last
item in the header, then they'd move to the bottom of the vtable though their
internal order does not change (D1 first, D0 second).

Next let's take a look at a derived class:

```cpp
class Derived : PartiallyVirtualClass {
public:
  ~Derived();

  void doData(int data) override;
  void maybeData() override;
};
```

Our derived class overrides the destructor, `doData()` and `maybeData()` methods
but leaves the `useData()` method untouched.

The size of the virtual table for this class is now the same size as the base
class is, but with some data changes:

```ts
[
  0,
  examplelib__Derived__type_info,
  examplelib__Derived__Destructor1,
  examplelib__Derived__Destructor0,
  examplelib__Derived__doData,
  examplelib__PartiallyVirtualClass__useData,
  examplelib__Derived__maybeData,
];
```

As we can see, the destructors are now found in the virtual table. Additionally,
the `maybeData()` method is now there as well. Most interestingly, the
`useData()` method is also found in the table but points to the base class
method, since it was not overridden.

With this we now know how to implement our own derived class. First, we need to
build ourselves a vtable of the same size as our base class:

```ts
const JS_DERIVED_VTABLE = new BigUint64Array(7);
```

The first item in the array we leave alone, as we're not sure what to put in it.
The second item is the type info pointer: If you're sure that the library
doesn't use type info then you can safely leave it as 0. Otherwise, you need to
implement a typeinfo struct as well, which includes at least one C string
pointer and probably some other data. Good luck.

The third and fourth items are more interesting: We need to implement our own
destructors. At their core, these should just call out to the base class' base
object destructor (D2) and JavaScript's garbage collection will take care of the
rest. But, if you've done other allocations using FFI in your "constructors" of
this class instance, then these destructors are the place where you handle
calling those destructors.

Note also that from Deno point of view, there is no difference between the
deleting destructor (D0) and complete object destructor (D1): Deno should never
manually deallocate memory as that is the garbage collection algorithm's job.

Then, the final three items are the methods. Here we can either inherit methods
from the base class, or override them with our own functions. But how do we get
the function pointers for inheriting base class methods? And how do we define
our own functions?

### Inheriting base class methods

Base class methods can be "inherited" by getting the pointer to a base class
method and assigning said pointer to your vtable. You can get the pointer to a
class method by declaring the method as a static in the `Deno.dlopen` call:

```ts
const lib = Deno.dlopen(
  "./libinherited_class.so",
  {
    "ptr__libexample__PartiallyVirtualClass__doData": {
      name: "_ZN11example_lib21PartiallyVirtualClass6doDataEi",
      type: "pointer",
    },
  },
);
```

### Defining own class methods

Defining your own class methods is effectively the same act as defining FFI
callbacks. As an example, we can implement our own `doData()` method like this:

```ts
const DO_DATA = new Deno.UnsafeCallback({
  parameters: ["buffer", "i32"],
  result: "void",
}, (pointer, data) => {
  console.log("doData:", pointer, data);
});
```

Since the C++ API for the `doData()` method takes one `int`, our callback needs
to take two parameters: The first is the `this` argument, and the second is the
`int` parameter passed in by the caller of the function.

## Multiple inheritance

You're on your own. Good luck.

[C++ calling convention]: ./calling-convention
[inherited_class.cpp]: https://github.com/aapoalas/denonomicon/tree/main/examples/cpp/inherited_class.cpp
[inheritedClass.ts]: https://github.com/aapoalas/denonomicon/tree/main/examples/cpp/inheritedClass.ts
