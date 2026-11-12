
import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";

function isPublicAddress(address) {
  try {
    const parsed = ipaddr.process(address);

    // Only globally routable unicast addresses are allowed.
    return parsed.range() === "unicast";
  } catch {
    return false;
  }
}

export async function resolvePublicAddress(inputUrl) {
  try {
    const url = new URL(inputUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    // Don't allow credentials embedded in URLs.
    if (url.username || url.password) {
      return null;
    }

    const hostname = url.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "");

    // Block local hostnames.
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return null;
    }

    // Handle URLs containing an IP address directly.
    if (net.isIP(hostname)) {
      if (!isPublicAddress(hostname)) {
        return null;
      }

      return {
        address: hostname,
        family: net.isIP(hostname),
      };
    }

    // Resolve the hostname.
    const addresses = await dns.lookup(hostname, {
      all: true,
      verbatim: true,
    });

    if (addresses.length === 0) {
      return null;
    }

    // Reject if ANY resolved address is non-public.
    if (!addresses.every(({ address }) => isPublicAddress(address))) {
      return null;
    }

    // Return one verified address for the HTTP connection.
    return addresses[0];

  } catch {
    return null;
  }
}

// Keep the previous function available for existing tests.
export async function isPublicUrl(inputUrl) {
  return (await resolvePublicAddress(inputUrl)) !== null;
}
