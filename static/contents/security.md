# Security

TODO: Discuss various possible vulnerabilities of Deno FFI.

For example:

- Buffer overflow, executable assembly in buffer and why it won't work directly
  unless there's some way to mark the memory executable or copy it to executable
  memory.
- Custom pointer creation to find useful native libraries such as dlopen itself.
- Writing custom library assembly to file and opening with `Deno.dlopen`.
