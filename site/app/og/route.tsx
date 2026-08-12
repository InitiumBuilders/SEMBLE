/* ═══════════════════════════════════════════════════════════════════════════
   SEMBLE SHARE CARDS — the face every link wears.

   THE GAP THIS CLOSES: not one Semble surface had an og:image. A partnership
   ANNOUNCEMENT page — a page whose entire job is to be shared — rendered as a
   blank grey rectangle in X, Farcaster, iMessage, Slack and Discord. The
   doorway was unbuilt while the rooms behind it were finished.

   ── Satori is not a browser. The rules it actually enforces: ──────────────
   ① Every element with more than one child needs an explicit `display: flex`.
      Omit it and the render throws, which means a 500, which means no card.
   ② No CSS grid. No backdrop-filter — so the glass here is FAKED with layered
      translucent fills, a hairline border and a highlight edge. On a flat
      raster that reads identically; there is nothing behind it to blur.
   ③ No background-clip: text. The gradient wordmarks from the live pages
      become solid ink here — and per the contrast law that is the safer
      caste anyway.
   ④ No external fetch, no live data. A crawler gives you a short timeout and
      retries rarely; a card that sometimes fails is worse than one that is
      always the same. Deterministic by design.
   ⑤ ⚠ THE ONE THAT BIT: the default font has NO SYMBOL GLYPHS. The first
      render put five tofu boxes on the card — ◈ ★ ✕ ◈ ✦ all came out as ▯,
      including the ✕ joining the two names, which is the most meaningful mark
      on a partnership card. Only ⚡ survived, and only as an off-palette
      colour emoji.
      So every mark here is DRAWN AS GEOMETRY — rotated squares and dots, not
      characters. No font dependency, nothing to subset or ship, and it cannot
      regress on a font update. The only non-ASCII characters permitted are
      ones Latin-1 guarantees: × and ·

   Every colour below is lifted from the live stylesheets on purpose: the card
   and the page it opens have to be the same world, or the click feels like a
   redirect to somewhere else.
   ═══════════════════════════════════════════════════════════════════════════ */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const C = {
  bg:      '#0F1114',
  panel:   'rgba(255,255,255,.045)',
  edge:    'rgba(255,255,255,.10)',
  cyan:    '#22D3EE',
  accentT: '#7BE3EA',
  azure:   '#60A5FA',
  violet:  '#A78BFF',
  signalT: '#CBBCFF',
  gold:    '#E8C46B',
  goldT:   '#F0D48C',
  ink:     '#F4F6F9',
  ink2:    '#DCE3EC',
};

type Chip = { label: string; color: string };
type Card = {
  kicker: string;
  tier?: string;
  titleA: string;
  titleB?: string;
  join?: boolean;
  colorA: string;
  colorB: string;
  lead: string;
  chips: Chip[];
  url: string;
};

const CARDS: Record<string, Card> = {
  thezao: {
    kicker: 'OFFICIAL PARTNERSHIP',
    tier: 'FIRST PARTNER · BUILD',
    titleA: 'SEMBLE',
    join: true,
    titleB: 'THE ZAO',
    colorA: C.accentT,
    colorB: C.goldT,
    lead: 'Artists reclaiming their margins. An audience that becomes infrastructure.',
    chips: [
      { label: 'COMPUTE', color: C.cyan },
      { label: 'OPEN RAILS', color: C.violet },
      { label: 'SYSTEMS DESIGN', color: C.gold },
    ],
    url: 'semble.cc/The-ZAO',
  },
  partners: {
    kicker: 'PARTNERS',
    titleA: 'We build with',
    titleB: 'people who move.',
    colorA: C.ink,
    colorB: C.accentT,
    lead: 'We bring infrastructure, not a logo. Every claim on the page is checkable with curl.',
    chips: [
      { label: 'COMPUTE', color: C.cyan },
      { label: 'OPEN RAILS', color: C.violet },
      { label: 'SYSTEMS DESIGN', color: C.gold },
    ],
    url: 'semble.cc/Partners',
  },
  live: {
    kicker: 'THE BUILDER STREAM',
    titleA: 'MOTUSLIVE',
    titleB: 'the compute commons',
    colorA: C.accentT,
    colorB: C.signalT,
    lead: 'Crowdfund compute on a live stream. One press, no install, no account — your machine joins the pool.',
    chips: [
      { label: 'LIVE', color: '#FF6B4A' },
      { label: 'VERIFIED WORK', color: C.cyan },
      { label: 'REAL PAYOUTS', color: C.gold },
    ],
    url: 'semble.cc/live',
  },
  semble: {
    kicker: 'AN OPEN BUILD',
    titleA: 'SEMBLE',
    titleB: 'the community compute commons',
    colorA: C.accentT,
    colorB: C.ink,
    lead: 'A livestream audience that becomes a verified compute pool. Public ledger, public kernels, public receipts.',
    chips: [
      { label: 'COMPUTE', color: C.cyan },
      { label: 'OPEN SOURCE', color: C.violet },
      { label: 'RECEIPTS', color: C.gold },
    ],
    url: 'semble.cc',
  },
};

/* THE SEMBLE MARK, drawn. A diamond holding a diamond — the ◈ from the live
   pages, as two rotated squares rather than a character that may not exist in
   whatever font the renderer falls back to. Explicit left/top on both: an
   absolutely positioned child in Satori should never rely on the parent's
   flex centering to place it. */
function Mark(p: { size?: number; color?: string }) {
  const size = p.size ?? 34;
  const color = p.color ?? C.cyan;
  const o = Math.round(size * 0.64);
  const i = Math.round(size * 0.26);
  return (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size }}>
      <div
        style={{
          position: 'absolute',
          left: (size - o) / 2, top: (size - o) / 2, width: o, height: o,
          border: `3px solid ${color}`, borderRadius: 4, transform: 'rotate(45deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: (size - i) / 2, top: (size - i) / 2, width: i, height: i,
          backgroundColor: color, borderRadius: 2, transform: 'rotate(45deg)',
        }}
      />
    </div>
  );
}

/* A chip's bullet. Colour is the whole job: it ties each pillar to its hue in
   the palette instead of leaning on an emoji that renders differently on every
   platform that shows this card. */
function Dot(p: { color: string; size?: number }) {
  const s = p.size ?? 10;
  return (
    <div style={{ display: 'flex', width: s, height: s, borderRadius: 999, backgroundColor: p.color, marginRight: 12 }} />
  );
}

/* One aurora blob. Absolutely positioned and given its own single gradient
   rather than stacking comma-separated backgrounds — one shape per node is
   the shape Satori renders most predictably. */
function Blob(p: { x: string; y: string; size: number; color: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: p.x,
        top: p.y,
        width: p.size,
        height: p.size,
        backgroundImage: `radial-gradient(circle at center, ${p.color} 0%, rgba(0,0,0,0) 70%)`,
      }}
    />
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const card = CARDS[(searchParams.get('v') || 'semble').toLowerCase()] || CARDS.semble;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: C.bg,
          padding: '56px 64px',
          position: 'relative',
        }}
      >
        {/* ── the aurora: the same hues as the live pages, in the same places.
             Cyan sits behind the wordmark, gold behind the tier badge, violet
             pooled low — so the light is where the meaning is, not scattered. ── */}
        <Blob x="-200px" y="-250px" size={820} color="rgba(34,211,238,.38)" />
        <Blob x="620px"  y="-300px" size={840} color="rgba(232,196,107,.26)" />
        <Blob x="180px"  y="290px"  size={920} color="rgba(167,139,255,.26)" />
        <Blob x="760px"  y="230px"  size={640} color="rgba(96,165,250,.18)" />
        {/* a floor wash so the bottom rule never floats on pure black */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 260,
            backgroundImage: 'linear-gradient(to top, rgba(15,17,20,.94), rgba(15,17,20,0))',
          }}
        />
        {/* the charged edge — one hairline that says which world this is */}
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: 0, height: 5,
            backgroundImage: `linear-gradient(to right, ${C.cyan}, ${C.violet} 46%, ${C.gold})`,
          }}
        />

        {/* ── header row ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Mark size={34} color={C.cyan} />
            <div style={{ fontSize: 30, fontWeight: 700, color: C.ink, letterSpacing: '.16em', marginLeft: 14 }}>
              SEMBLE
            </div>
          </div>
          {card.tier ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '11px 22px',
                borderRadius: 999,
                border: '1px solid rgba(232,196,107,.42)',
                backgroundColor: 'rgba(232,196,107,.10)',
              }}
            >
              <Mark size={17} color={C.gold} />
              <div style={{ fontSize: 19, letterSpacing: '.12em', color: C.goldT, marginLeft: 11 }}>
                {card.tier}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', fontSize: 19, letterSpacing: '.3em', color: C.signalT }}>
              {card.kicker}
            </div>
          )}
        </div>

        {/* ── the middle: the one thing this card is about ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {card.tier ? (
            <div style={{ display: 'flex', fontSize: 20, letterSpacing: '.34em', color: C.signalT, marginBottom: 22 }}>
              {card.kicker}
            </div>
          ) : null}

          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ fontSize: 86, fontWeight: 800, color: card.colorA, letterSpacing: '-.02em', lineHeight: 1.05 }}>
              {card.titleA}
            </div>
            {/* × is Latin-1, so it is one of the few non-ASCII characters that
                is genuinely safe here. It carries the whole meaning of the
                card: these two are one thing now. */}
            {card.join ? (
              <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, color: C.azure, margin: '0 28px' }}>
                ×
              </div>
            ) : null}
          </div>

          {card.titleB ? (
            <div
              style={{
                display: 'flex',
                fontSize: card.join ? 86 : 62,
                fontWeight: 800,
                color: card.colorB,
                letterSpacing: '-.02em',
                lineHeight: 1.1,
                marginTop: card.join ? 0 : 8,
              }}
            >
              {card.titleB}
            </div>
          ) : null}

          <div
            style={{
              display: 'flex',
              fontSize: 27,
              color: C.ink2,
              lineHeight: 1.45,
              marginTop: 22,
              maxWidth: 940,
            }}
          >
            {card.lead}
          </div>
        </div>

        {/* ── footer: the pillars, then the address ── */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', marginBottom: 26 }}>
            {card.chips.map((c) => (
              <div
                key={c.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 22px',
                  marginRight: 12,
                  borderRadius: 16,
                  border: `1px solid ${C.edge}`,
                  backgroundColor: C.panel,
                }}
              >
                <Dot color={c.color} />
                <div style={{ fontSize: 20, letterSpacing: '.08em', color: C.ink }}>{c.label}</div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: `1px solid ${C.edge}`,
              paddingTop: 24,
            }}
          >
            <div style={{ display: 'flex', fontSize: 25, color: C.accentT, letterSpacing: '.03em' }}>
              {card.url}
            </div>
            <div style={{ display: 'flex', fontSize: 19, color: C.signalT, letterSpacing: '.2em' }}>
              MOTUS IS THE MINDSET
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Crawlers refetch rarely and these cards are deterministic, so let the
        // CDN hold them. `immutable` is safe precisely BECAUSE there is no live
        // data in here — the moment that changes, this header has to change too.
        'cache-control': 'public, immutable, no-transform, max-age=31536000',
      },
    }
  );
}
