const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.TextDecoder || !globalVar.TextEncoder) {
  require("fast-text-encoding");
}
