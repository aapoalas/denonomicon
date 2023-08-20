# Security

Note: Security is a complex subject and the author is not an expert on all
intricacies therein. This writeup is thus at best incomplete or too cautious, at
worst too optimistic. Be very careful with FFI and do not trust the words here
to tell the whole story.

First the good parts: Using FFI is no more dangerous than running `cargo build`
or a binary you downloaded off the Internet. Deno FFI cannot do things that a
native binary couldn't do, so demons will not come flying out of your nose when
you use it.

Then the bad parts: Using FFI is just as dangerous as running `cargo build` or a
binary you downloaded off the Internet: The FFI API gives all the code you run
inside Deno the possibility to do anything and everything that a native binary
could do. In this sense, `--allow-ffi` is very much like `--allow-all`.

Using FFI as an attack tool is still not quite as simple as using Deno's own
APIs would be when `--allow-all` is passed: To make meaningful HTTP requests an
exploit code would need to know which OS you're running, which DLL or dynamic
library and from which directory it should load to gain access to a usable HTTP
request API and would then need to know how to use those low level APIs
effectively.

This is not to say that it terribly hard or impossible: No, we cannot rely on
security by obscurity here. But it is not something that a lone script kiddy who
has learned to do NPM postinstall step exploitation will know how to do.

## Types of exploits

Next we shall try to discuss a few individual attack types in isolation, and try
to figure out what if anything can be done about them.

### Buffer overflow and executable code injection

One traditional attack is to have a buffer overflow lead the processor to slide
over an area of memory that inevitably leads to some executable code prepared by
the attacker. Causing a buffer overflow with Deno FFI is fairly trivial, as most
C APIs will include calls with pointer + length pairs where simply providing a
too-big length will cause an overflow to occur. Buffer underflow may be a more
advantageous attack vector and is likely also possible but maybe harder to
orchestrate.

Creating a "slip'n slide" for the processor to slide down from is trivial as it
can just be a `Uint8Array` with a given byte value at each slot. The hard part
comes from the "executable code" part: It is essentially trivial to write a
piece of malicious assembly code into a `Uint8Array` but this will not make it
executable. Even if we take the pointer from that buffer and pass it as a
function pointer for a C program to call the result will simply be a program
crash as calling the function pointer will attempt to execute non-executable
memory. Effectively, the operating system is protecting us.

It is, however, possible to get executable memory. In POSIX systems this can be
done with `mprotect` and on Windows it can be done with `VirtualAlloc` and
`VirtualProtect`. Both of these are, I believe, loaded and used in a Deno
program internally. An attacker need only know where in the memory space to find
these functions so that they use `Deno.UnsafeFnPointer` to make them callable
from inside Deno. Knowing where to find them is not a trivial issue: Address
layouts are normally randomised per process, and trying to access the wrong
address usually ends in a crash.

So even if an attacker had persistent address to a Deno program they couldn't
just for-loop over the entire memory space, trying to find these functions. If a
consistent way to find these functions exists, though, then any Deno FFI usage
is potentially exploitable by eg. attacker code hidden inside a dependency that
then writes its own custom assembly code into a `Uint8Array` and marks it
executable.

### Loading known dynamic libraries

The overwhelmingly easiest attack on a Deno program with `--allow-ffi` is to
simply try and load any and all dynamic libraries you know you can exploit. The
issue here of course is that it's not really possible for a Deno FFI running
program to currently revoke its FFI permissions as that would make most of the
FFI APIs unusable, and those APIs are oftentimes necessary for proper
interaction with a dynamic library.

The worst thing here is that if a library is not found it will simply throw an
error instead of crashing the program, meaning that a determined attacker can
simply try any number of possible library paths before it hits upon one that it
can use. This is one of the core reason why `--allow-ffi` cannot really coexist
with running unsecure code inside Deno at present.

If the Deno program also has `--allow-write` permissions then an attacker just
write their own dynamic library into a local directory and load that directly.
This gives them a wonderful developer experience to exploitation as they can
choose their own API and language to write it in.

Hopefully in the future FFI tokens can be used to allow FFI users to revoke
their permissions to load any more dynamic libraries, thus closing down this
largest hole.

### Pointer creation

Largely related with executable code injection, Deno FFI offers very easy access
to create pointers out of thin air so to say. Using the
`Deno.UnsafePointer.create()` function any number can be turned into a pointer.
This means that if an attacker in any way can find out the address numbers of
eg. functions or sensitive data in the program's memory addressing then they can
easily get access to those resources.

That being said, finding out those pointers likely already requires more access
than creating these pointers enables. Thus, the most likely usage for pointer
creation is actually in denial-of-service like attacks: If an attacker can make
any FFI call pass `null` as a pointer then it is likely that the program will
crash from trying to dereference a null pointer. If the only aim of the attacker
is to get the service down then this will be a very simple way to do that.

### Pointer substitution

Very much related to pointer creation: If a Deno FFI library gives out pointer
objects directly in its API then it essentially puts the onus of pointer type
safety against substitution on the user of the library. What this means is that
essentially any two pointers should always be interchangeable if they're
accessible by a user of the library, or else it is up to the user to not make a
mistake and use a pointer of one type as a pointer of some other type.

If a pointer gets substituted with another pointer of a non-substitutable type
then the likely result is either a segmentation fault or, with well-crafted
substitutions, possibly a hijacking of the program flow for fun, profit and
exploitation. A segfault is the most likely result, however.

## What can we do about this?

Ways to avoid exploitation by way of FFI:

1. Be careful of what dependencies you include in a program that runs with
   `--allow-ffi`. Prefer no or only `deno.land/std` dependencies. This makes it
   very improbable that a supply-chain attack will target your FFI permissions.
2. If you need outside dependencies, audit them yourself, use strictly versioned
   URLs and `deno.lock`, and repeat the audit whenever you update.
3. Do not run untrusted code in your Deno program with `--allow-ffi`
   permissions. If you have to run untrusted code then do it inside a Worker
   that has all permissions turned off.
4. When writing a Deno FFI using library, never expose pointer objects outside
   of the library if possible. This means that pointers should always be held in
   `#private` properties in classes and no methods should give ways to copy the
   pointers out. If sharing a pointer from one class to another is required then
   [static initialisation blocks](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Static_initialization_blocks#access_to_private_properties)
   can be used to create a function that proides access to the private pointer
   property from the outside.

```ts
// foo.ts
import { Bar, injectGetFooPrivate } from "./bar.ts";

let getBarPrivate: null | ((bar: Bar) => number) = null;
export const injectGetBarPrivate = (getter: (bar: Bar) => number) => {
  if (getBarPrivate !== null) {
    throw new Error("Double injection");
  }
  getBarPrivate = getter;
};

export class Foo {
  #private: number;
  constructor(v: number) {
    this.#private = v;
  }

  static {
    queueMicrotask(() => {
      injectGetFooPrivate((foo: Foo) => foo.#private);
    });
  }
}

// bar.ts
import { Foo, injectGetBarPrivate } from "./foo.ts";

let getFooPrivate: null | ((foo: Foo) => number) = null;
export const injectGetFooPrivate = (getter: (foo: Foo) => number) => {
  if (getFooPrivate !== null) {
    throw new Error("Double injection");
  }
  getFooPrivate = getter;
};

export class Bar {
  #private: number;
  constructor(v: number) {
    this.#private = v;
  }

  static {
    queueMicrotask(() => {
      injectGetBarPrivate((bar: Bar) => bar.#private);
    });
  }
}
```

This function should not be exported from any module anywhere but should instead
be injected into the requesting module through a function that can only be
successfully called once. If two classes both depend on each other this way then
one way to cut the dependency chain is to use `queueMicrotask` or other
asynchronization for delaying the injection call.

Another way to break the dependency chain is to simply keep everything in a
single file. This may not be palatable to some people, however.
