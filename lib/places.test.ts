import assert from "node:assert/strict";
import test from "node:test";
import { reverseLabel, searchLabel } from "./places";

test("search labels keep the match and a broader place", () => {
  assert.equal(
    searchLabel({ name: "Helsinki", state: "Uusimaa", country: "Finland" }),
    "Helsinki, Uusimaa",
  );
  assert.equal(
    searchLabel({ name: "Helsinki Olympic Stadium", city: "Helsinki", country: "Finland" }),
    "Helsinki Olympic Stadium, Helsinki",
  );
  assert.equal(searchLabel({}), null);
});

test("reverse labels prefer the neighborhood over the street", () => {
  assert.equal(
    reverseLabel({
      name: "Ruusinahontie",
      district: "Härjänvatsa",
      city: "Salo",
      country: "Finland",
    }),
    "Härjänvatsa, Salo",
  );
  assert.equal(reverseLabel({}), null);
});
