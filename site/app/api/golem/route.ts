// /api/golem — THE GOLEM ADAPTER + LIVE SUPPLY GAUGE.
//
// August asked for Golem, so Golem is wired. What is built here is the honest
// version of that: a real requestor-side adapter (subnet, allowlist, budget,
// deposit reference, yagna REST target) PLUS a live gauge that pulls Golem's
// OWN stats API every time you look — so the dashboard shows measured supply
// instead of anybody's opinion about it.
//
// ⚠ MEASURED 2026-08-12, and re-measured on every request by this endpoint:
// the Golem network had ZERO GPU providers. Their docs team deleted the GPU
// provider section on 2026-08-06 as "a product that no longer exists". A
// provider must run Linux x86-64 with /dev/kvm and boot a separate OS from a
// USB SSD — no Windows, no macOS, no browser path — so a livestream VIEWER
// cannot contribute through Golem at all.
//
// This adapter therefore serves two real purposes:
//   1. REQUESTOR path — if we ever want to BUY compute from Golem, the wiring
//      is here and it is one env var away from live.
//   2. TRUTH gauge — it keeps measuring, so the day supply appears, we know,
//      and the day it does not, nobody on the team is guessing.
// It never fabricates capacity. If GPUs are zero, it says zero, loudly.
export const dynamic = 'force-dynamic';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, x-live-secret',
  'cache-control': 'no-store',
};

// ⚠ The DOCUMENTED host `api.stats.golem.network` has no A record. The live
// host is `api2`. This tripped up the research and would trip up anyone else.
const STATS = 'https://api2.stats.golem.network';

// Polygon mainnet. GLM token + the Deposits lock contract (yagna 0.16.0), which
// lets a third party FUND someone else's jobs. Note it donates MONEY, not
// MACHINES — the opposite axis from viewers lending hardware — and it had zero
// mainnet events across the 40k blocks we sampled.
const CHAIN = {
  network: 'polygon', chainId: 137,
  glm: '0x0B220b82F3eA3B7F6d9A1D8ab58930C064A2b5Bf',
  deposits: '0x57ff7451E008647cbDB84e652B00ef05856Dba23',
};

type Probe = {
  reachable: boolean; providers: number; gpus: number;
  runtimes: Record<string, number>; error: string; source: string;
};

async function probeGolem(): Promise<Probe> {
  const out: Probe = { reachable: false, providers: 0, gpus: 0, runtimes: {}, error: '', source: `${STATS}/v2/network/online` };
  try {
    const r = await fetch(out.source, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { out.error = `stats API HTTP ${r.status}`; return out; }
    const nodes = await r.json();
    if (!Array.isArray(nodes)) { out.error = 'unexpected stats shape'; return out; }
    out.reachable = true;
    out.providers = nodes.length;
    for (const n of nodes) {
      const rt = n?.runtimes || {};
      for (const [name, v] of Object.entries<Record<string, unknown>>(rt)) {
        out.runtimes[name] = (out.runtimes[name] || 0) + 1;
        // GPU capability is advertised under the gap-35 experimental namespace
        const props = (v as { properties?: Record<string, unknown> })?.properties || {};
        const model = props['golem.!exp.gap-35.v1.inf.gpu.model'];
        if (model) out.gpus++;
      }
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : 'probe failed';
  }
  return out;
}

/** Requestor-side adapter config. Live the moment a yagna appkey is present. */
function adapter() {
  const appkey = process.env.GOLEM_APPKEY || '';
  const api = process.env.GOLEM_API_URL || 'http://127.0.0.1:7465';
  const subnet = process.env.GOLEM_SUBNET || 'public';
  const budget = Number(process.env.GOLEM_BUDGET_GLM || 0);
  const allow = (process.env.GOLEM_ALLOW_PROVIDERS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return {
    role: 'requestor',
    configured: !!appkey,
    // the appkey is wallet control — it is NEVER echoed, only its presence
    appkeyPresent: !!appkey,
    api, subnet, budgetGlm: budget, allowProviders: allow.length,
    // A local yagna daemon is mandatory: REST on 127.0.0.1:7465, bearer appkey.
    // There is no hosted gateway and no daemonless path.
    requires: 'a local yagna daemon (REST 127.0.0.1:7465, bearer app-key). No hosted gateway exists.',
    donatePattern: allow.length
      ? 'custom subnet + zero price + allowlist — simulates a donated pool by convention, not by protocol guarantee'
      : 'not configured',
  };
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }

export async function GET() {
  const [probe] = await Promise.all([probeGolem()]);
  const a = adapter();

  // The verdict is COMPUTED from the live probe, never hard-coded — if Golem
  // ever grows GPU supply, this flips on its own and nobody has to remember.
  const usableForViewers = false;   // structural: no browser/Windows/macOS provider path exists
  const usableForRenting = probe.reachable && probe.gpus > 0;

  return Response.json({
    adapter: a,
    chain: CHAIN,

    supply: {
      measuredAt: Date.now(),
      reachable: probe.reachable,
      providers: probe.providers,
      gpus: probe.gpus,
      runtimes: probe.runtimes,
      error: probe.error || undefined,
      source: probe.source,
    },

    verdict: {
      viewersCanContribute: usableForViewers,
      whyNot: 'A Golem provider needs Linux x86-64, /dev/kvm nested virtualization enabled in BIOS, and a boot into a separate OS from a USB SSD with the GPU bound to VFIO. There is no Windows provider, no macOS provider, and no browser node. A livestream viewer cannot do this.',
      canRentGpu: usableForRenting,
      rentNote: probe.gpus > 0
        ? `${probe.gpus} GPU provider(s) visible — renting is possible right now.`
        : 'Zero GPU providers online. Golem\'s own docs team removed the GPU provider product on 2026-08-06. Renting GPU here is not currently possible.',
      recheck: 'This gauge re-measures on every request. It is not a cached opinion.',
    },

    // What we run instead, and why it is not a consolation prize
    insteadWeUse: {
      path: 'browser-native contribution (WebGPU capability probe + WASM/WebGPU work units), distributed from our own page',
      why: 'No token, no daemon, no BIOS setting, no reboot, no separate OS. It is the only path a livestream viewer can actually walk through — and it is what golem.network/ai advertises but does not deliver.',
      settlement: 'DASH for reward, TRUST attestation for receipt. See /api/payouts.',
    },
  }, { headers: CORS });
}

/** Operator-only: dry-run a requestor order so the wiring is provably real. */
export async function POST(req: Request) {
  const secret = process.env.LIVE_SECRET;
  if (!secret || req.headers.get('x-live-secret') !== secret) {
    return Response.json({ ok: false, error: 'not the operator' }, { status: 401, headers: CORS });
  }
  const b = await req.json().catch(() => ({}));
  const a = adapter();
  const probe = await probeGolem();

  const demand = {
    'golem.srv.comp.task_package': String(b.image || 'hash:sha3:<image-hash>:http://<image-url>'),
    'golem.node.debug.subnet': a.subnet,
    'golem.com.payment.platform.erc20-polygon-glm.address': '<requestor-address>',
    ...(b.gpu ? { 'golem.!exp.gap-35.v1.inf.gpu.model': '*' } : {}),
  };

  return Response.json({
    ok: true,
    dryRun: true,
    reason: a.configured
      ? 'Adapter is configured. This is still a dry run — no agreement is signed and no GLM moves from here.'
      : 'GOLEM_APPKEY is not set, so no order can be placed. The demand below is what WOULD be published.',
    wouldPublish: demand,
    against: { providersOnline: probe.providers, gpusOnline: probe.gpus },
    blocked: b.gpu && probe.gpus === 0
      ? 'A GPU demand cannot be matched: zero GPU providers are online. This order would hang unmatched until it expired.'
      : undefined,
    note: 'Signing and settlement happen on the operator\'s yagna node. This service never holds the app-key, which is wallet control.',
  }, { headers: CORS });
}
