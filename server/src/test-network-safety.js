import { resolvePublicAddress } from "./services/scraper/network-safety.js";

const testUrls = [
  // Public IP
  "https://1.1.1.1",

  // Private and loopback
  "http://127.0.0.1",
  "http://10.0.0.1",
  "http://192.168.1.1",

  // Special-use IPv4 ranges
  "http://169.254.169.254",
  "http://100.64.0.1",
  "http://192.0.2.1",
  "http://198.18.0.1",
  "http://224.0.0.1",
  "http://240.0.0.1",

  // Special-use IPv6 ranges
  "http://[::1]",
  "http://[::]",
  "http://[fc00::1]",
  "http://[fe80::1]",
  "http://[2001:db8::1]",
];

async function main() {
  for (const url of testUrls) {
    const result = await resolvePublicAddress(url);

    console.log(
      `${url} => ${result ? `ALLOWED (${result.address})` : "BLOCKED"}`,
    );
  }
}

main();
