const buildCommand = new Deno.Command("g++", {
  args: ["-fPIC", "-c", "examples/cpp/inherited_class.cpp"],
});
buildCommand.outputSync();
const buildLibraryCommand = new Deno.Command("g++", {
  args: ["--shared", "-o", "libinherited_class.so", "inherited_class.o"],
});
buildLibraryCommand.outputSync();

const lib = Deno.dlopen(
  "./libinherited_class.so",
  {
    example_lib__PartiallyVirtualClass__Constructor: {
      name: "_ZN11example_lib21PartiallyVirtualClassC1Ei",
      parameters: ["buffer", "i32"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__Destructor: {
      name: "_ZN11example_lib21PartiallyVirtualClassD1Ev",
      parameters: ["buffer"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__Destructor0: {
      name: "_ZN11example_lib21PartiallyVirtualClassD0Ev",
      parameters: ["pointer"],
      result: "void",
    },
    example_lib__Derived__Destructor0: {
      name: "_ZN11example_lib7DerivedD0Ev",
      parameters: ["buffer"],
      result: "void",
    },
    example_lib__Derived__Destructor1: {
      name: "_ZN11example_lib7DerivedD1Ev",
      parameters: ["buffer"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__useData: {
      name: "_ZN11example_lib21PartiallyVirtualClass7useDataEi",
      parameters: ["buffer", "i32"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__callDoDataMethod: {
      name: "_ZN11example_lib21PartiallyVirtualClass16callDoDataMethodEPS0_",
      parameters: ["buffer"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__callDelete: {
      name: "_ZN11example_lib21PartiallyVirtualClass10callDeleteEPS0_",
      parameters: ["buffer"],
      result: "void",
    },
    example_lib__PartiallyVirtualClass__createLambda: {
      name:
        "_ZN11example_lib21PartiallyVirtualClass12createLambdaEPFvPvS1_ES1_S1_",
      parameters: ["buffer", "function", "pointer", "pointer"],
      result: "pointer",
    },
    example_lib__PartiallyVirtualClass__callLambda: {
      name:
        "_ZN11example_lib21PartiallyVirtualClass10callLambdaERKSt8functionIFvvEE",
      parameters: ["pointer"],
      result: "void",
    },
    ptr_PartiallyVirtualClass__VTABLE: {
      name: "_ZTVN11example_lib21PartiallyVirtualClassE",
      type: "pointer",
    },
    ptr_useData: {
      name: "_ZN11example_lib21PartiallyVirtualClass7useDataEi",
      type: "pointer",
    },
    ptr_doData: {
      name: "_ZN11example_lib21PartiallyVirtualClass6doDataEi",
      type: "pointer",
    },
    ptr_callDoDataMethod: {
      name: "_ZN11example_lib21PartiallyVirtualClass16callDoDataMethodEPS0_",
      type: "pointer",
    },
    ptr_callDelete: {
      name: "_ZN11example_lib21PartiallyVirtualClass10callDeleteEPS0_",
      type: "pointer",
    },
    ptr_createLambda: {
      name:
        "_ZN11example_lib21PartiallyVirtualClass12createLambdaEPFvPvS1_ES1_S1_",
      type: "pointer",
    },
    ptr_callLambda: {
      name:
        "_ZN11example_lib21PartiallyVirtualClass10callLambdaERKSt8functionIFvvEE",
      type: "pointer",
    },
    ptr_Constructor: {
      name: "_ZN11example_lib21PartiallyVirtualClassC1Ei",
      type: "pointer",
    },
    ptr_Destructor: {
      name: "_ZN11example_lib21PartiallyVirtualClassD1Ev",
      type: "pointer",
    },
    ptr_Destructor0: {
      name: "_ZN11example_lib21PartiallyVirtualClassD0Ev",
      type: "pointer",
    },
    // ptr_Derived_useData: {
    //   name: "_ZN11example_lib7Derived7useDataEi",
    //   type: "pointer",
    // },
    ptr_Derived_doData: {
      name: "_ZN11example_lib7Derived6doDataEi",
      type: "pointer",
    },
    ptr_Derived_Destructor0: {
      name: "_ZN11example_lib7DerivedD0Ev",
      type: "pointer",
    },
    ptr_Derived_Destructor1: {
      name: "_ZN11example_lib7DerivedD1Ev",
      type: "pointer",
    },
    ptr_Derived_maybeData: {
      name: "_ZN11example_lib7Derived9maybeDataEv",
      type: "pointer",
    },
    ptr_Derived_typeinfo: {
      name: "_ZTIN11example_lib7DerivedE",
      type: "pointer",
    },
    ptr_Derived_typeinfo_name: {
      name: "_ZTSN11example_lib7DerivedE",
      type: "pointer",
    },
    ptr_typeinfo: {
      name: "_ZTIN11example_lib21PartiallyVirtualClassE",
      type: "pointer",
    },
    ptr_typeinfo_name: {
      name: "_ZTSN11example_lib21PartiallyVirtualClassE",
      type: "pointer",
    },
    ptr_Derived_VTABLE: {
      name: "_ZTVN11example_lib7DerivedE",
      type: "pointer",
    },
    ptr_ZN11example_lib21PartiallyVirtualClass10callLambdaERKSt8functionIFvvEE:
      {
        name:
          "_ZN11example_lib21PartiallyVirtualClass10callLambdaERKSt8functionIFvvEE",
        type: "pointer",
      },
    ptr_pure_virtual: {
      name: "__cxa_pure_virtual",
      type: "pointer",
    },
    cxa_pure_virtual: {
      name: "__cxa_pure_virtual",
      parameters: [],
      result: "void",
    },
  } as const,
);

const POINTER_NAME_TABLE = new Map(
  Object.entries(lib.symbols).filter((x) =>
    x[0].startsWith("ptr_" || x[0].endsWith("VTABLE"))
  ).map((x) => [Number(x[1]), x[0]]),
);
const getPointerName = (x: number, convert = true) =>
  POINTER_NAME_TABLE.get(x) || (convert ? x.toString(16) : x);

const VTABLE = new Uint8Array(8);
const example_lib__InheritedClass__useData = new Deno.UnsafeCallback({
  parameters: ["pointer", "i32"],
  result: "void",
}, (self, data) => console.log("Got call from", self, "with data:", data));
new BigUint64Array(VTABLE.buffer, 0, 1)[0] = BigInt(
  example_lib__InheritedClass__useData.pointer,
);

const items = 7;
const ptr_PartiallyVirtualClass__VTABLE = Array.from(
  new BigUint64Array(
    Deno.UnsafePointerView.getArrayBuffer(
      lib.symbols.ptr_PartiallyVirtualClass__VTABLE,
      items * 8,
    ),
    0,
    items,
  ),
  (x) => Number(x),
);
const Dervied__VTABLE = Array.from(
  new BigUint64Array(
    Deno.UnsafePointerView.getArrayBuffer(
      lib.symbols.ptr_Derived_VTABLE,
      items * 8,
    ),
    0,
    items,
  ),
  (x) => Number(x),
);

console.log("PartiallyVirtualClass VTABLE:");
console.log(ptr_PartiallyVirtualClass__VTABLE.map((x) => getPointerName(x)));
console.log("");
console.log("Derived VTABLE:");
console.log(Dervied__VTABLE.map((x) => getPointerName(x)));
console.log("");

const first = new Uint8Array(6 * 8);
lib.symbols.example_lib__PartiallyVirtualClass__Constructor(first, 13);
const pointerview = new BigUint64Array(first.buffer, 0, 1);
lib.symbols.example_lib__PartiallyVirtualClass__callDoDataMethod(first);
pointerview[0] = BigInt(BigInt(lib.symbols.ptr_Derived_VTABLE) + 16n);
lib.symbols.example_lib__PartiallyVirtualClass__callDoDataMethod(first);

const CUSTOM_VTABLE_BIG_INT = new BigUint64Array(6);
const CUSTOM_VTABLE = new Uint8Array(CUSTOM_VTABLE_BIG_INT.buffer);

const CUSTOM_DESTRUCTOR_1 = new Deno.UnsafeCallback({
  parameters: ["buffer"],
  result: "void",
}, (pointer) => {
  console.log("Destructor1:", pointer);
  lib.symbols.example_lib__PartiallyVirtualClass__Destructor(
    new Uint8Array(Deno.UnsafePointerView.getArrayBuffer(pointer, 16)),
  );
});
const CUSTOM_DESTRUCTOR_0 = new Deno.UnsafeCallback({
  parameters: ["buffer"],
  result: "void",
}, (pointer) => {
  console.log("Destructor0:", pointer);
  lib.symbols.example_lib__PartiallyVirtualClass__Destructor0(pointer);
});
const DO_DATA = new Deno.UnsafeCallback({
  parameters: ["buffer", "i32"],
  result: "void",
}, (pointer, data) => {
  console.log("doData:", pointer, data);
});
const USE_DATA = new Deno.UnsafeCallback({
  parameters: ["buffer", "i32"],
  result: "void",
}, (pointer, data) => {
  console.log("doData:", pointer, data);
});

CUSTOM_VTABLE_BIG_INT[2] = BigInt(CUSTOM_DESTRUCTOR_1.pointer);
CUSTOM_VTABLE_BIG_INT[3] = BigInt(CUSTOM_DESTRUCTOR_0.pointer);
CUSTOM_VTABLE_BIG_INT[4] = BigInt(DO_DATA.pointer);
CUSTOM_VTABLE_BIG_INT[5] = BigInt(USE_DATA.pointer);

pointerview[0] = BigInt(Deno.UnsafePointer.of(CUSTOM_VTABLE)) + 16n;
lib.symbols.example_lib__PartiallyVirtualClass__callDoDataMethod(first);

const LAMBDA_CALLBACK = new Deno.UnsafeCallback({
  parameters: ["pointer", "pointer"],
  result: "void",
}, (pointer, pointer2) => {
  console.log("Lambda callback", pointer, pointer2);
});
const lambda = lib.symbols.example_lib__PartiallyVirtualClass__createLambda(
  first,
  LAMBDA_CALLBACK.pointer,
  12345,
  34654754,
);
const lambdaBufferBigInt = new BigUint64Array(first.buffer).subarray(2);
// console.log(lambdaBufferBigInt);
// console.log(
//   "Lambda C function:",
//   LAMBDA_CALLBACK.pointer,
// );

const lambdaBufferPointers = Array.of(
  lambdaBufferBigInt[0],
  lambdaBufferBigInt[2],
  lambdaBufferBigInt[3],
).map(
  (x) => Number(x),
);
const next = lambdaBufferPointers.map((ptr) =>
  new BigUint64Array(Deno.UnsafePointerView.getArrayBuffer(ptr - 16, 56))
);
//console.log(next);
const customLambda = new BigUint64Array(4);
customLambda[0] = BigInt(LAMBDA_CALLBACK.pointer);
customLambda[1] = 26345745678n;
//console.log(getFoo(lambda))
//lib.symbols.example_lib__PartiallyVirtualClass__callLambda(Deno.UnsafePointer.of(customLambda));
lib.symbols.example_lib__PartiallyVirtualClass__callLambda(lambda);
