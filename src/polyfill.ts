import * as TextEncodingShim from "text-encoding-shim";

const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.TextDecoder) {
  globalVar.TextDecoder = TextEncodingShim.TextDecoder;
}
if (!globalVar.TextEncoder) {
  globalVar.TextEncoder = TextEncodingShim.TextEncoder;
}
