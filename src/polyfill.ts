const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.Buffer) {
  globalVar.Buffer = require("buffer/").Buffer;
}
if (!globalVar.TextDecoder || !globalVar.TextEncoder) {
  const TextEncodingShim = require("text-encoding-shim");
  globalVar.TextDecoder = TextEncodingShim.TextDecoder;
  globalVar.TextEncoder = TextEncodingShim.TextEncoder;
}
