const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.TextDecoder || !globalVar.TextEncoder) {
  const TextEncodingShim = require("text-encoding-shim");
  globalVar.TextDecoder = TextEncodingShim.TextDecoder;
  globalVar.TextEncoder = TextEncodingShim.TextEncoder;
}
if (!globalVar.crypto) {
  const { Crypto } = require("@peculiar/webcrypto");
  globalVar.crypto = new Crypto();
}
