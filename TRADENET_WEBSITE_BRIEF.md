# TradeNet Terminal — Website Redesign Brief
## For: Claude Code (Website Repo)
## Last Updated: April 2026

---

## OVERVIEW & MISSION

TradeNet Terminal is a professional-grade cryptocurrency derivatives trading terminal built by TradeNet L.L.C. The website's singular goal is to convert visitors into waitlist signups and eventually paying subscribers. Every design decision, copy choice, and feature description must serve that goal.

This is NOT a trading course, mentorship, or signal group. It is institutional-grade software. The website must reflect that positioning at every level. Remove any copy, nav items, or sections that imply education, mentorship, or trading signals.

---

## BRAND IDENTITY

**Company:** TradeNet L.L.C.
**Product:** TradeNet Terminal
**Domain:** tradenet.org
**Positioning:** The only crypto derivatives terminal with a real-time liquidation PREDICTION engine. Not historical. Not delayed. Predictive.
**Tone:** Institutional, confident, data-driven, slightly intimidating. Like software that knows something you don't.
**Audience:** Serious crypto derivatives traders — people who trade BTC/ETH/SOL futures on leverage, understand order flow, and are willing to pay for a professional edge.

**What we are NOT:**
- A trading course or mentorship
- A signal group
- A TradingView indicator bundle
- A web app (we are a native desktop terminal)

---

## DESIGN REQUIREMENTS

**Color Palette:**

The TradeNet brand colors are **gold and black** — derived from the logo. The site does not need to be exclusively these colors, but gold must be used for primary interactive elements (buttons, badges, highlights, glows, borders on featured cards) so the brand identity is immediately legible.

- Background: `#09090f` (near-black, deep obsidian)
- **Primary brand accent: `#c9a84c` (gold — use for primary CTAs, badges, founding member callouts, key highlights)**
- **Primary brand accent light: `#f0c040` (brighter gold — use for hover states, glow effects on gold elements)**
- Secondary accent: `#39ff14` (neon green — use sparingly for live data elements, "LIVE" indicators, real-time readouts only)
- Danger/liquidation: `#ff4444` (red — heatmap references, short liquidation indicators)
- Card backgrounds: `#0f0f1a` with subtle border `#1a1a2e`
- Featured card border: gold glow `#c9a84c` with `box-shadow` glow
- Text primary: `#ffffff`
- Text secondary: `#8888aa`

**Color usage rules:**
- Gold (`#c9a84c`) = primary CTA buttons, "Most Popular" badge, founding member callout, nav "Join Waitlist" button, key stat highlights
- Green (`#39ff14`) = data elements only — live trade readouts, "LIVE" tags, real-time indicators, the founding spots counter
- Red (`#ff4444`) = liquidation references, short side heatmap, danger indicators only
- Do NOT make the entire site gold — use it as an accent on black to maintain the premium, institutional feel. Think gold trim on a black card, not a gold room.

**Typography:**
- Headers: Space Grotesk or Inter (bold, geometric)
- Body: Inter
- Data/terminal readouts: JetBrains Mono or IBM Plex Mono (monospace) — use for stats, counters, code-style elements

**Aesthetic:**
- Dark, cinematic, dense — like a Bloomberg Terminal crossed with next-gen fintech
- Glassmorphism cards with subtle glow borders
- Scroll-triggered fade-up animations on all sections
- NO generic crypto/NFT cube graphics or stock illustrations
- Use actual terminal screenshots or mockups where possible
- Particle or data-stream background on hero section (interactive with cursor if possible)
- The interactive cube background currently on the site can stay if it reads as "data" not "NFT"

---

## NAVIGATION

**Remove:**
- "Indicator" nav item — legacy product, does not belong on this site
- "Reviews" nav item — premature, no public users yet

**Keep/Add:**
- Home
- Terminal (product feature page)
- Pricing
- About (optional, minimal)
- "Join Waitlist" CTA button — right-aligned, always visible, **gold background (`#c9a84c`), black text**

---

## PAGE STRUCTURE & COPY

---

### 1. HERO SECTION

**Current problem:** "Most Traders Lose. We Built a System That Doesn't." sounds like a trading course. Replace entirely.

**New headline options (pick the strongest or A/B test):**
- "See What the Market Is About to Do."
- "The Liquidation Map Nobody Else Has."
- "Institutional Intelligence. Built for the Trader, Not the Institution."

**Recommended headline:**
```
See What the Market
Is About to Do.
```
*(large, bold, white — "Is About to Do." in gold)*

**Subheadline:**
```
TradeNet Terminal delivers real-time liquidation prediction,
aggregated order flow, and multi-exchange derivatives analytics
in a GPU-accelerated native desktop terminal.
Built for traders who trade differently.
```

**CTA Buttons:**
- Primary: "Join the Waitlist →" (gold `#c9a84c`, black text, subtle gold glow on hover)
- Secondary: "See It In Action" (ghost/outline, white border)

**Remove:** The current subheadline referencing "institutional-grade education and the Fusion AI Indicator" — do not mention education or indicators anywhere on this site.

**Stats Bar (below hero):**
Replace current stats with accurate, defensible numbers:
```
[ 4 EXCHANGES ]   [ 3 SYMBOLS LIVE ]   [ REAL-TIME PREDICTION ]   [ NATIVE DESKTOP ]
```
Do NOT use "1K+ Members" or "96% Positive Feedback" unless these are verified and accurate. False social proof destroys credibility with the target audience.

**Exchange logos strip:**
Show supported exchange logos: Binance, Bybit, OKX, Hyperliquid — monochrome, small, clean.

---

### 2. THE MOAT — PRIMARY FEATURE SECTION

This section must be the most prominent feature callout on the page. It is the entire reason TradeNet Terminal exists and has no competitor.

**Section headline:**
```
Every Competitor Shows You What Already Happened.
We Show You What's Coming.
```

**Body copy:**
```
TradeNet Terminal is the only platform in the world with a
self-calibrating liquidation prediction algorithm, visualized
as a real-time heatmap. While Coinglass, Market Monkey, and
Exocharts display liquidations after they cascade — our algorithm
continuously calibrates to live market conditions and maps exactly
where forced liquidations will occur before the market gets there.

Validated during the February 28 Iran strike: our algorithm identified
exact liquidation clusters hours before 2,623 force orders swept
through them.

This is not a feature. This is the moat.
```

**Visual:** Heatmap screenshot or animated mockup showing predicted liq zones with price approaching them. If a real screenshot is available, use it. If not, use a stylized mockup that accurately represents the heatmap layout.

---

### 3. FEATURE SECTIONS (3-column cards, scroll-triggered)

**Card 1 — Liquidation Prediction Heatmap**
- Icon: Targeting reticle / crosshair
- Title: "Predict, Don't React"
- Body: "A proprietary self-calibrating liquidation prediction algorithm, visualized as a real-time heatmap. It continuously adapts to live market conditions and maps exactly where liquidation clusters will form — before the market gets there. Validated across multiple live market events. No other platform offers this."
- Badge: "EXCLUSIVE"

**Card 2 — Multi-Exchange Aggregation**
- Icon: Network node cluster
- Title: "Four Exchanges. One View."
- Body: "Real-time order flow aggregated across Binance, Bybit, OKX, and Hyperliquid simultaneously. Footprint charts, open interest delta, CVD, and orderbook heatmaps — all in a single native terminal."

**Card 3 — GPU-Accelerated Native Desktop**
- Icon: Circuit board / terminal window
- Title: "Built Different."
- Body: "Written in Rust. Rendered on the GPU via wgpu. No browser, no latency excuses, no throttling. The same performance standard as the infrastructure that moves institutional capital."

---

### 4. FULL FEATURE LIST SECTION

Present as a clean two-column grid or scannable list. Group by category.

**Order Flow & Charts:**
- Real-time footprint charts (multi-exchange aggregated, server-side, ~300ms load)
- Candlestick charts with custom timeframes
- Aggregated CVD (Cumulative Volume Delta)
- Bar stats panel: Volume, Delta, OI Delta, OI CVD, Liq data, Funding Rate (9 rows total)
- Volume Profile (post-launch)

**Liquidation Intelligence:**
- Self-calibrating liquidation prediction algorithm displayed as a real-time heatmap (proprietary — unique in market)
- Continuously adapts to live market conditions — not a static model
- Historical liquidation heatmap
- Liquidation bubbles overlay on charts
- Liq event streaming with deduplication
- Swept zone visual persistence

**Orderbook Analysis:**
- Orderbook heatmap with sqrt scaling and noise filtering
- Level outlining for clarity
- ETH/SOL parity on OB heatmap
- Historical depth visualization

**Open Interest:**
- 3-exchange aggregated OI (Binance, Bybit, OKX)
- OI Delta per timeframe
- OI CVD (Open Interest Cumulative Volume Delta)
- Historical OI with 24h depth at 15-second resolution

**Multi-Exchange Data:**
- Binance, Bybit, OKX, Hyperliquid aggregated
- 12 market pairs
- Sub-1ms exchange latency from server infrastructure

**Infrastructure:**
- Native desktop application (Windows + macOS)
- GPU-accelerated rendering (wgpu)
- Server-side data processing (Hetzner backend)
- No browser bottleneck — real terminal performance

**Screener (coming soon):**
- Multi-coin screener across 200+ pairs
- OI data, funding rates, sortable columns

---

### 5. COMPETITIVE COMPARISON TABLE

Show a clean comparison table. Use checkmarks and X marks. Keep it factual.

| Feature | TradeNet | Market Monkey | Coinglass | Bookmap | Exocharts |
|---|---|---|---|---|---|
| Self-calibrating liq prediction algorithm | ✅ ONLY US | ❌ | ❌ historical only | ❌ | ❌ |
| Liq historical heatmap | ✅ | ✅ | ✅ | ❌ | ✅ |
| OB heatmap | ✅ | ✅ | ❌ | ✅ | ❌ |
| Footprint charts | ✅ multi-exchange | ✅ | ❌ | ✅ paid | ✅ |
| Multi-exchange aggregation | ✅ 4 exchanges | ✅ | partial | ❌ | ❌ |
| OI tools | ✅ 3-exchange | ✅ | ✅ | limited | ✅ |
| Native desktop app | ✅ GPU | ❌ web | ❌ web | ✅ Java | ✅ .NET |
| Free tier | ✅ | ✅ | ✅ | ✅ limited | ❌ |
| Price (Pro) | $39/mo | $29/mo | $28/mo | $49/mo | €49/mo |

**Callout below table:**
```
"The only platform that predicts where the market is going to break
before it happens. Everything else shows you the aftermath."
```

---

### 6. PRICING SECTION

**Section headline:**
```
Simple Pricing. Serious Edge.
```

**IMPORTANT — Pricing structure (3 boxes):**

**Box 1 — Free (left)**
- Label: Free
- Price: $0/mo
- Features:
  - BTC only
  - Delayed liquidation heatmap (5 min delay)
  - 1 chart layout
  - Orderbook heatmap
  - Footprint chart
  - Watermarked screenshots
  - Requires Bitunix signup via referral link
- CTA: "Join Waitlist" (ghost button)
- Note below: "Free access is powered by our exchange partnership. Sign up to Bitunix through our link — no deposit required."

**Box 2 — Pro Annual (CENTER, "Most Popular" badge, glowing gold border)**
- Label: Pro
- Sub-label: "Billed Annually"
- Price: **$32/mo**
- Annual total with savings: ~~$468/yr~~ → $384/yr — Save $84
- Founding Member callout (highlighted in gold, inside card):
  ```
  🔒 Founding Member: $24/mo — locked forever
  First 100 annual members only. Price never increases.
  ```
- Features:
  - All coins (BTC, ETH, SOL + more)
  - Real-time self-calibrating liquidation prediction heatmap
  - Real-time orderbook heatmap
  - Unlimited charts & layouts
  - Full footprint charts (multi-exchange)
  - Bar stats panel (all 9 rows)
  - Full OI tools & CVD
  - Liq bubbles overlay
  - No watermark on screenshots
  - Priority support
- CTA: "Join Waitlist" (solid gold `#c9a84c`, black text, gold glow)

**Box 3 — Pro Monthly (right)**
- Label: Pro
- Sub-label: "Billed Monthly"
- Price: **$39/mo**
- Small nudge: "Save 18% with annual billing →"
- Same feature list as Box 2
- No founding member pricing (annual only)
- CTA: "Join Waitlist" (ghost button, less prominent)

**Below all three boxes:**
```
Elite tier — coming soon.  Join the waitlist to be notified when early access opens.
```
*(small, muted text — this anchors Pro as the middle option psychologically)*

**Founding member counter (monospace, green, below pricing):**
```
[ FOUNDING SPOTS REMAINING: 94 / 100 ]
```
*(Update this number manually as spots fill. Creates urgency.)*

---

### 7. WAITLIST SECTION

Full-width dark section, glowing card border.

**Headline:**
```
Early Access Is Limited.
```

**Subheadline:**
```
The first 100 annual members lock in founding pricing forever.
$24/mo. Never increases. Never expires.
```

**Email input + submit button**
- Placeholder: "Enter your email"
- Button: "Claim Your Spot →" (gold `#c9a84c`, black text)
- Below input (small text): "No spam. No fluff. You'll be first to know when we ship."

**Referral mechanic note:**
```
Share your referral link to move up the waitlist.
Every friend who signs up moves you closer to the front.
```

---

### 8. SOCIAL PROOF / ENDORSEMENT SECTION

If Fabio Valentini endorsement quote is available — feature it here prominently. World champion scalper endorsement is significant social proof for the target audience.

Format as a large pull quote with his name, title, and photo if available.

If no endorsements are ready for launch, skip this section rather than fabricating metrics.

---

### 9. FOOTER

**Left:** TradeNet logo
**Center links:** Privacy Policy, Terms of Service, Discord
**Right:** TradeNet L.L.C. © 2026

**Do NOT include:**
- Social media links that aren't active
- "Indicator" product links
- Mentorship or course links

---

## WHAT TO REMOVE FROM CURRENT SITE

The following must be removed entirely:

1. **"Indicator" nav item** — legacy, wrong positioning
2. **"Reviews" nav item** — premature
3. **"Quantum Terminal" naming** — product is called "TradeNet Terminal"
4. **"Most Traders Lose. We Built a System That Doesn't."** headline — sounds like a guru course
5. **"institutional-grade education"** anywhere — we are not an education product
6. **"Fusion AI Indicator"** references — do not mention this product
7. **"96% Positive Feedback"** stat — unverifiable, looks fabricated to skeptical traders
8. **"1K+ Members"** stat — only use if accurate and verifiable
9. **3D cube graphic** on hero — generic, looks like an NFT project
10. **Any mentorship or signal group language**

---

## TONE & COPY RULES

- Write for a trader who is skeptical and has seen too many gurus. Earn credibility, don't claim it.
- Lead with the moat (liq prediction algorithm) in every major section.
- Be specific. "2,623 force orders" beats "thousands of liquidations."
- Never use the word "revolutionary," "game-changing," or "disruptive."
- Monospace font for any numbers, stats, or data-style callouts.
- Short sentences. Active voice. No fluff.
- Always refer to the liquidation feature as the **"self-calibrating liquidation prediction algorithm"** — never just "heatmap" (the heatmap is the visualization, the algorithm is the moat). The distinction matters for credibility.
- The word "prediction" is the single most important word on this site. Use it intentionally.

---

## TECHNICAL NOTES FOR IMPLEMENTATION

- Waitlist form should connect to an email capture service (Mailchimp, Klaviyo, or similar)
- The founding member counter (`[ FOUNDING SPOTS REMAINING: XX ]`) should ideally be dynamic but can be manually updated for launch
- All CTAs point to the waitlist — there is no live product to link to yet
- "See It In Action" button can link to a demo video, a screenshot gallery, or scroll to the feature section — do not link to a dead page
- Mobile responsiveness is required — many visitors will come from TikTok and Instagram
- Page load speed matters — no heavy unoptimized assets
- Interactive background (current cube animation) can stay if performance is acceptable on mobile, otherwise replace with a CSS particle effect

---

## WHAT SUCCESS LOOKS LIKE

A visitor who lands on this page from a TikTok video about the liquidation heatmap should:

1. Immediately understand this is professional trading software, not a course
2. See the liquidation prediction engine as something they've never seen before
3. Feel like the free tier is a fair trade for their exchange signup
4. Feel urgency about the founding member spots running out
5. Enter their email before they leave

That conversion funnel — awareness → credibility → urgency → action — is the only thing this website needs to accomplish.
