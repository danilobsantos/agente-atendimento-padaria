import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj, normalizePhone, getPhoneLookupVariants, isAllowedLogoExt } from "../src/lib/utils/company";

test("isValidCnpj accepts valid CNPJs", () => {
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("00.000.000/0001-91"), true);
});

test("isValidCnpj rejects invalid ones", () => {
  assert.equal(isValidCnpj("11.222.333/0001-00"), false);
  assert.equal(isValidCnpj("11222333000182"), false);
  assert.equal(isValidCnpj(""), false);
  assert.equal(isValidCnpj("123"), false);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});

test("isValidCnpj rejects repeated digits", () => {
  assert.equal(isValidCnpj("00.000.000/0000-00"), false);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});

test("normalizePhone standardizes Brazilian numbers with DDI 55", () => {
  assert.equal(normalizePhone("(31) 99999-0000"), "5531999990000");
  assert.equal(normalizePhone("31 9 9999-0000"), "5531999990000");
  assert.equal(normalizePhone("5531999990000"), "5531999990000");
  assert.equal(normalizePhone("123"), "");
  assert.equal(normalizePhone(""), "");
});

test("getPhoneLookupVariants generates DDI and 9-digit permutations", () => {
  const variants = getPhoneLookupVariants("5535988160553");
  assert.ok(variants.includes("5535988160553"));
  assert.ok(variants.includes("35988160553"));
  assert.ok(variants.includes("553588160553"));
  assert.ok(variants.includes("3588160553"));

  const fromLocal = getPhoneLookupVariants("35988160553");
  assert.ok(fromLocal.includes("5535988160553"));
  assert.ok(fromLocal.includes("35988160553"));
});

test("isAllowedLogoExt whitelists safe extensions", () => {
  assert.equal(isAllowedLogoExt("png"), true);
  assert.equal(isAllowedLogoExt("PNG"), true);
  assert.equal(isAllowedLogoExt("jpg"), true);
  assert.equal(isAllowedLogoExt("webp"), true);
  assert.equal(isAllowedLogoExt("svg"), true);
  assert.equal(isAllowedLogoExt("exe"), false);
  assert.equal(isAllowedLogoExt("php"), false);
  assert.equal(isAllowedLogoExt(""), false);
});