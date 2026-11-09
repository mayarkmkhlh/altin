import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCents, centsToUsdString, sarLabel, toUsdCents } from "./money";

test("amounts said in USD or SAR become USD cents, rounded to the nearest cent", () => {
  assert.equal(toUsdCents(300, "USD"), 30000);
  assert.equal(toUsdCents(80.5, "USD"), 8050);
  assert.equal(toUsdCents(1000, "SAR"), 26667);
  assert.equal(toUsdCents(375, "SAR"), 10000);
});

test("cents become PayPal's USD string without floating point", () => {
  assert.equal(centsToUsdString(5), "0.05");
  assert.equal(centsToUsdString(1050), "10.50");
  assert.equal(centsToUsdString(100000), "1000.00");
});

test("SAR is a display label at the 3.75 peg", () => {
  assert.equal(sarLabel(1000), "≈ 37.50 SAR");
  assert.equal(sarLabel(1), "≈ 0.04 SAR");
});

test("amounts must be positive whole cents", () => {
  assert.throws(() => assertCents(0));
  assert.throws(() => assertCents(-100));
  assert.throws(() => assertCents(10.5));
  assert.doesNotThrow(() => assertCents(1));
});
