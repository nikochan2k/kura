import { decode, encode } from "base-64";
import {
  TextDecoder as TextDecoderPolyfill,
  TextEncoder as TextEncoderPolyfill
} from "text-encoding-utf-8";

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
if (!globalVar.TextEncoder) {
  globalVar.TextEncoder = TextEncoderPolyfill;
}
if (!globalVar.TextDecoder) {
  globalVar.TextDecoder = TextDecoderPolyfill;
}
if (!globalVar.setTimeout || globalVar.clearTimeout) {
  const timers = require("timers");
  globalVar.clearTimeout = timers.clearTimeout;
  globalVar.setTimeout = timers.setTimeout;
}
