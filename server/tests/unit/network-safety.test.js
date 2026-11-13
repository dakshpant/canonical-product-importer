// Tests for the SSRF guard: the scraper may only connect to public addresses.
// Literal IPs need no DNS, so this runs offline.
//
// Run: node --test tests/unit/network-safety.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { resolvePublicAddress } from "../../src/services/scraper/network-safety.js";

const BLOCKED = {
  "loopback": ["http://127.0.0.1", "http://[::1]", "http://localhost"],
  "private networks": ["http://10.0.0.1", "http://172.16.0.1", "http://192.168.1.1", "http://[fc00::1]"],
  "link-local and cloud metadata": ["http://169.254.169.254", "http://[fe80::1]"],
  "special-use ranges": [
    "http://0.0.0.0",
    "http://[::]",
    "http://100.64.0.1",
    "http://192.0.2.1",
    "http://198.18.0.1",
    "http://224.0.0.1",
    "http://240.0.0.1",
    "http://[2001:db8::1]",
  ],
  // Tricks that turn a private address into something that looks harmless.
  "disguised private addresses": [
    "http://2130706433", // 127.0.0.1 written as one decimal number
    "http://0x7f000001", // 127.0.0.1 in hex
    "http://[::ffff:127.0.0.1]", // IPv4-mapped IPv6
    "http://[::ffff:169.254.169.254]",
  ],
};

for (const [group, urls] of Object.entries(BLOCKED)) {
  test(`blocks ${group}`, async () => {
    for (const url of urls) {
      assert.equal(await resolvePublicAddress(url), null, `${url} must be blocked`);
    }
  });
}

test("allows a public address and returns the IP to connect to", async () => {
  const result = await resolvePublicAddress("https://1.1.1.1");
  assert.equal(result?.address, "1.1.1.1");
});
