import { describe, expect, it } from "vitest";
import { keyToBytes } from "./pushNotifications";

describe("keyToBytes", () => {
  it("reads the server key in base64url, without padding", () => {
    // "-" and "_" are the base64url forms of "+" and "/".
    expect(Array.from(keyToBytes("-_8"))).toEqual([0xfb, 0xff]);
    expect(keyToBytes("BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U")).toHaveLength(65);
  });
});
