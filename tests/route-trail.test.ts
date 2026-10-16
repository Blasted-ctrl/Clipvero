import assert from "node:assert/strict";
import { test } from "node:test";
import {
  routeProgress,
  routeSegments,
  routeTrail,
} from "../packages/video-engine/src/route-trail";
import { getLength } from "@remotion/paths";

test("the hash-map trail starts empty, ends full and never moves backwards", () => {
  assert.equal(routeProgress(0, 477), 0);
  assert.ok(Math.abs(routeProgress(1, 477) - 1) < 1e-9);
  let last = -1;
  for (let move = 0; move <= 1.0001; move += 0.02) {
    const progress = routeProgress(Math.min(1, move), 201);
    assert.ok(progress >= last, `progress regressed at ${move}`);
    last = progress;
  }
});

test("the trail reaches each corner exactly when the chip does", () => {
  const targetX = 307;
  const segments = routeSegments(targetX);
  const lengths = segments.map((s) => getLength(s.d));
  const total = lengths.reduce((a, b) => a + b, 0);
  let covered = 0;
  for (const [i, segment] of segments.entries()) {
    covered += lengths[i];
    assert.ok(
      Math.abs(routeProgress(segment.at, targetX) - covered / total) < 1e-9,
    );
  }
});

test("dash props expose the visible part of the route", () => {
  const half = routeTrail(0.4, 307);
  assert.ok(
    Number(half.strokeDashoffset) > 0 && half.strokeDasharray.length > 0,
  );
});
