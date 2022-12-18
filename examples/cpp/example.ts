const buildCommand = new Deno.Command("g++", {
  args: ["-c", "examples/cpp/example.cpp"],
});
buildCommand.outputSync();
const buildLibraryCommand = new Deno.Command("g++", {
  args: ["--shared", "-o", "libexample.so", "example.o"],
});
buildLibraryCommand.outputSync();

const lib = Deno.dlopen(
  "./libexample.so",
  {
    lib__Example__Constructor: {
      name: "_ZN3lib7ExampleC1Ei",
      parameters: ["buffer", "i32"],
      result: "void",
    },
    lib__Example__Destructor: {
      name: "_ZN3lib7ExampleD1Ev",
      parameters: ["buffer"],
      result: "void",
    },
    lib__Example__method: {
      name: "_ZNK3lib7Example6methodEv",
      parameters: ["buffer"],
      result: "void",
    },
    lib__Example__create: {
      name: "_ZN3lib7Example6createEi",
      parameters: ["buffer", "i32"],
      result: "pointer",
    },
  } as const,
);

const example = new Uint8Array(4);
lib.symbols.lib__Example__Constructor(example, 313);
lib.symbols.lib__Example__method(example);
lib.symbols.lib__Example__Destructor(example);

console.log(example);
const result = lib.symbols.lib__Example__create(example, 16);
console.log(example);
console.log(result, Deno.UnsafePointer.of(example));
lib.symbols.lib__Example__method(example);
