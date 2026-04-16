import test from "node:test";
import assert from "node:assert/strict";

import {
  filterUrlsForView,
  getUrlChangeLabel,
} from "../../artifacts/monitor-app/src/lib/website-triage.ts";

const urls = [
  {
    id: 1,
    url: "https://example.com/new-broken",
    isBroken: true,
    isTrackedIssue: true,
    issueType: "not_found" as const,
    lastStatus: 404,
  },
  {
    id: 2,
    url: "https://example.com/recovered",
    isBroken: false,
    isTrackedIssue: false,
    issueType: null,
    lastStatus: 200,
  },
  {
    id: 3,
    url: "https://example.com/stable",
    isBroken: false,
    isTrackedIssue: false,
    issueType: null,
    lastStatus: 200,
  },
];

const summary = {
  currentStatus: {
    totalUrls: 3,
    brokenUrls: 1,
    notFoundUrls: 1,
    serverErrorUrls: 0,
    trackedIssueUrls: 1,
    okUrls: 2,
  },
  recentlyBrokenUrls: ["https://example.com/new-broken"],
  recentlyNotFoundUrls: ["https://example.com/new-broken"],
  recentlyServerErrorUrls: [],
  recentlyFixedUrls: ["https://example.com/recovered"],
};

test("triage filters isolate new, resolved, and recent URLs", () => {
  assert.deepEqual(
    filterUrlsForView(urls, "new", "", summary).map((url) => url.id),
    [1],
  );
  assert.deepEqual(
    filterUrlsForView(urls, "resolved", "", summary).map((url) => url.id),
    [2],
  );
  assert.deepEqual(
    filterUrlsForView(urls, "recent", "", summary).map((url) => url.id),
    [1, 2],
  );
});

test("triage change labels reflect recent issue state", () => {
  assert.equal(getUrlChangeLabel(urls[0], summary), "New 404");
  assert.equal(getUrlChangeLabel(urls[1], summary), "Recovered");
  assert.equal(getUrlChangeLabel(urls[2], summary), null);
});
