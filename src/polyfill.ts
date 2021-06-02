import { decode, encode } from "base-64";
import * as TextEncodingShim from "text-encoding-shim";

const globalVar =
  typeof window !== "undefined"
    ? window
    : typeof global !== "undefined"
    ? global
    : Function("return this;")();

if (!globalVar.atob) {
  globalVar.atob = decode;
}
if (!globalVar.btoa) {
  globalVar.btoa = encode;
}
if (!globalVar.TextDecoder) {
  globalVar.TextDecoder = TextEncodingShim.TextDecoder;
}
if (!globalVar.TextEncoder) {
  globalVar.TextEncoder = TextEncodingShim.TextEncoder;
}
