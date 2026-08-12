import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj, normalizePhone, isAllowedLogoExt } from "../src/lib/utils/company";

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

test("normalizePhone strips formatting and keeps 10+ digits", () => {
  assert.equal(normalizePhone("(31) 99999-0000"), "31999990000");
  assert.equal(normalizePhone("31 9 9999-0000"), "31999990000");
  assert.equal(normalizePhone("123"), "");
  assert.equal(normalizePhone(""), "");
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