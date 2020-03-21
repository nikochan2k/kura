import { decode, encode } from "base-64";

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
