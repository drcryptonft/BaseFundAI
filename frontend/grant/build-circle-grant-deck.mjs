import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outputDir = join(here, "output");
const runtimePackageJson =
  process.env.CODEX_RUNTIME_PACKAGE_JSON ||
  "C:/Users/WIN11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json";
const runtimeRequire = createRequire(runtimePackageJson);

async function importRuntimePackage(name) {
  return import(pathToFileURL(runtimeRequire.resolve(name)).href);
}

const artifact = await importRuntimePackage("@oai/artifact-tool");
const sharpModule = await importRuntimePackage("sharp").catch(() => null);
const sharp = sharpModule?.default || sharpModule;

const {
  Presentation,
  PresentationFile,
  column,
  row,
  grid,
  text,
  panel,
  rule,
  shape,
  fill,
  fixed,
  hug,
  grow,
  fr,
} = artifact;

const W = 1920;
const H = 1080;
const COLORS = {
  ink: "#101827",
  muted: "#536070",
  pale: "#F6F8FA",
  line: "#D8DEE8",
  usdc: "#2775CA",
  arc: "#19B884",
  robinhood: "#1F2937",
  mint: "#E9FBF5",
  bluePale: "#EAF3FF",
  amber: "#F4B83E",
  rose: "#E95858",
  white: "#FFFFFF",
};

const stats = [
  { chain: "Base Sepolia", asset: "USDC", campaigns: 8, backers: 13, raised: 592, status: "Live testnet" },
  { chain: "Arc Testnet", asset: "USDC", campaigns: 3, backers: 3, raised: 55, status: "Live on Arc" },
  { chain: "Robinhood Testnet", asset: "USDG", campaigns: 3, backers: 3, raised: 85, status: "Live testnet" },
];

const totals = stats.reduce(
  (acc, item) => ({
    campaigns: acc.campaigns + item.campaigns,
    backers: acc.backers + item.backers,
    raised: acc.raised + item.raised,
  }),
  { campaigns: 0, backers: 0, raised: 0 }
);

function title(textValue, opts = {}) {
  return text(textValue, {
    name: opts.name || "slide-title",
    width: opts.width || fill,
    height: hug,
    style: {
      fontSize: opts.size || 58,
      bold: true,
      color: opts.color || COLORS.ink,
      fontFace: "Aptos Display",
    },
  });
}

function body(textValue, opts = {}) {
  return text(textValue, {
    name: opts.name || "body",
    width: opts.width || fill,
    height: hug,
    style: {
      fontSize: opts.size || 27,
      color: opts.color || COLORS.muted,
      fontFace: "Aptos",
      lineSpacingMultiple: 1.12,
    },
  });
}

function label(textValue, opts = {}) {
  return text(textValue, {
    name: opts.name || "label",
    width: opts.width || fill,
    height: hug,
    style: {
      fontSize: opts.size || 18,
      bold: opts.bold ?? true,
      color: opts.color || COLORS.muted,
      fontFace: "Aptos",
      letterSpacing: 0,
    },
  });
}

function footer(slideNo) {
  return row(
    { name: `footer-${slideNo}`, width: fill, height: hug, gap: 20 },
    [
      label("BaseFundAI | Circle 2026 Cohort 2", { width: grow(1), size: 16, color: "#7A8494" }),
      label(`0${slideNo}`, { width: fixed(42), size: 16, color: "#7A8494" }),
    ]
  );
}

function metric(number, caption, accent = COLORS.usdc) {
  return column(
    { name: `metric-${caption}`, width: grow(1), height: hug, gap: 4 },
    [
      text(String(number), {
        name: `metric-number-${caption}`,
        width: fill,
        height: hug,
        style: { fontSize: 60, bold: true, color: accent, fontFace: "Aptos Display" },
      }),
      label(caption, { size: 19, color: COLORS.muted }),
    ]
  );
}

function sectionHeader(kicker, headline, sub) {
  return column(
    { name: "title-stack", width: fill, height: hug, gap: 14 },
    [
      label(kicker.toUpperCase(), { size: 17, color: COLORS.arc }),
      title(headline),
      sub ? body(sub, { width: 1300, size: 25 }) : null,
    ].filter(Boolean)
  );
}

function slideRoot(slide, children, slideNo, opts = {}) {
  slide.compose(
    column(
      {
        name: `slide-${slideNo}-root`,
        width: fill,
        height: fill,
        padding: { x: 86, y: 64 },
        gap: opts.gap || 34,
      },
      [...children, row({ width: fill, height: grow(1) }, []), footer(slideNo)]
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
}

function softPanel(name, children, opts = {}) {
  return panel(
    {
      name,
      width: opts.width || fill,
      height: opts.height || hug,
      padding: opts.padding || { x: 28, y: 24 },
      fill: opts.fill || COLORS.pale,
      borderRadius: opts.radius || 20,
    },
    column({ width: fill, height: hug, gap: opts.gap || 10 }, children)
  );
}

function tableRow(cells, opts = {}) {
  const widths = opts.widths || [420, 250, 250, 250, 360];
  return row(
    { name: opts.name || "table-row", width: fill, height: fixed(opts.height || 58), gap: 0 },
    cells.map((cell, index) =>
      text(String(cell), {
        name: `${opts.name || "row"}-${index}`,
        width: fixed(widths[index]),
        height: hug,
        style: {
          fontSize: opts.fontSize || 23,
          bold: opts.bold || false,
          color: opts.color || COLORS.ink,
          fontFace: "Aptos",
        },
      })
    )
  );
}

await mkdir(outputDir, { recursive: true });

const deck = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = deck.slides.add();
  slide.compose(
    column(
      { name: "cover-root", width: fill, height: fill, padding: { x: 96, y: 80 }, gap: 28 },
      [
        label("Circle 2026 Cohort 2 | Public testnet beta", { size: 20, color: COLORS.usdc }),
        text("BaseFundAI", {
          name: "cover-title",
          width: fill,
          height: hug,
          style: { fontSize: 118, bold: true, color: COLORS.ink, fontFace: "Aptos Display" },
        }),
        text("Stablecoin-native crowdfunding on Arc", {
          name: "cover-subtitle",
          width: 1180,
          height: hug,
          style: { fontSize: 48, color: COLORS.ink, fontFace: "Aptos Display" },
        }),
        rule({ name: "cover-rule", width: fixed(520), stroke: COLORS.arc, weight: 7 }),
        body(
          "A non-custodial campaign funding protocol using USDC-denominated contracts on Arc Testnet and Base Sepolia.",
          { width: 980, size: 29 }
        ),
        row(
          { width: fill, height: grow(1), gap: 30 },
          [
            shape({ name: "cover-blue-field", width: grow(1), height: fixed(18), shapeType: "rect", fill: COLORS.usdc }),
            shape({ name: "cover-green-field", width: grow(2), height: fixed(18), shapeType: "rect", fill: COLORS.arc }),
          ]
        ),
        row(
          { width: fill, height: hug, gap: 24 },
          [
            label("https://basefundai.tech", { width: grow(1), size: 23, color: COLORS.ink }),
            label("Not mainnet production", { width: fixed(280), size: 18, color: COLORS.rose }),
          ]
        ),
      ]
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 }
  );
}

// 2. Problem
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader(
        "Problem",
        "Crowdfunding still asks contributors to trust opaque rails",
        "Creators need global reach. Contributors need stable value, transparent settlement, and visible campaign outcomes."
      ),
      row(
        { name: "problem-points", width: fill, height: hug, gap: 34 },
        [
          softPanel("problem-1", [label("01", { color: COLORS.usdc }), title("Payment friction", { size: 38 }), body("Cross-border support is slow, expensive, and inconsistent for small campaigns.", { size: 24 })], { width: grow(1), height: fixed(260) }),
          softPanel("problem-2", [label("02", { color: COLORS.arc }), title("Weak transparency", { size: 38 }), body("Backers often cannot verify funds raised, settlement state, or campaign history.", { size: 24 })], { width: grow(1), height: fixed(260) }),
          softPanel("problem-3", [label("03", { color: COLORS.amber }), title("Volatility risk", { size: 38 }), body("Crypto fundraising is harder to understand when campaign targets move with asset prices.", { size: 24 })], { width: grow(1), height: fixed(260) }),
        ]
      ),
    ],
    2
  );
}

// 3. Product
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader(
        "Product",
        "A non-custodial campaign factory with stable-asset settlement",
        "BaseFundAI turns campaign creation, contribution, discovery, and settlement into a transparent onchain workflow."
      ),
      row(
        { name: "product-flow", width: fill, height: fixed(300), gap: 18 },
        [
          softPanel("flow-create", [label("Create", { color: COLORS.usdc }), body("Creator launches a campaign with goal, deadline, and immutable metadata.", { color: COLORS.ink })], { width: grow(1), height: fill, fill: COLORS.bluePale }),
          softPanel("flow-fund", [label("Fund", { color: COLORS.arc }), body("Contributors approve USDC and contribute directly to the campaign contract.", { color: COLORS.ink })], { width: grow(1), height: fill, fill: COLORS.mint }),
          softPanel("flow-index", [label("Discover", { color: COLORS.amber }), body("Subgraph, RPC reads, and registry metadata power feeds and stats.", { color: COLORS.ink })], { width: grow(1), height: fill }),
          softPanel("flow-settle", [label("Settle", { color: COLORS.rose }), body("Campaign state exposes success, failure, refunds, and claimability.", { color: COLORS.ink })], { width: grow(1), height: fill }),
        ]
      ),
      body("The product is live as a public testnet beta, not a mainnet custody product.", { size: 23, color: COLORS.muted }),
    ],
    3
  );
}

// 4. Traction
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader("Live beta traction", "Public testnet activity across three networks", "Live API metrics verified on May 11, 2026. Values are testnet units, not real-money AUM."),
      row(
        { name: "metrics-row", width: fill, height: hug, gap: 42 },
        [
          metric(totals.campaigns, "campaigns", COLORS.usdc),
          metric(totals.backers, "backers", COLORS.arc),
          metric(totals.raised, "raised", COLORS.amber),
        ]
      ),
      column(
        { name: "traction-table", width: fill, height: hug, gap: 12 },
        [
          tableRow(["Network", "Asset", "Campaigns", "Backers", "Raised"], { name: "header", bold: true, color: COLORS.muted, fontSize: 19, height: 42 }),
          rule({ width: fill, stroke: COLORS.line, weight: 2 }),
          ...stats.flatMap((item, index) => [
            tableRow([item.chain, item.asset, item.campaigns, item.backers, item.raised], { name: `chain-${index}`, height: 62 }),
            index < stats.length - 1 ? rule({ width: fill, stroke: COLORS.line, weight: 1 }) : null,
          ].filter(Boolean)),
        ]
      ),
    ],
    4
  );
}

// 5. Circle alignment
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader(
        "Circle alignment",
        "Current integration is USDC on Arc and Base; deeper Circle products are roadmap",
        "This avoids overclaiming: Circle Wallets, CCTP, and Gateway are planned, not currently live."
      ),
      row(
        { name: "alignment-columns", width: fill, height: fixed(390), gap: 34 },
        [
          softPanel(
            "current-circle",
            [
              label("CURRENT", { color: COLORS.arc }),
              title("USDC-denominated campaign funding", { size: 38 }),
              body("Arc Testnet and Base Sepolia campaign contracts use USDC token configuration. Users connect wallets through wagmi/RainbowKit and fund campaigns through ERC-20 approve + contribute.", { size: 23, color: COLORS.ink }),
            ],
            { width: grow(1), height: fill, fill: COLORS.mint }
          ),
          softPanel(
            "planned-circle",
            [
              label("PLANNED", { color: COLORS.usdc }),
              title("Wallets, CCTP, Gateway", { size: 38 }),
              body("Grant work will evaluate Circle Wallets for onboarding, CCTP for cross-chain USDC movement, and Gateway for smoother stablecoin access where technically appropriate.", { size: 23, color: COLORS.ink }),
            ],
            { width: grow(1), height: fill, fill: COLORS.bluePale }
          ),
        ]
      ),
    ],
    5
  );
}

// 6. Architecture
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader("Architecture", "The shipped flow is simple enough to inspect", "Frontend wallet actions write to campaign contracts; backend indexing turns chain state into discoverable product data."),
      row(
        { name: "architecture-flow", width: fill, height: fixed(330), gap: 18 },
        [
          softPanel("arch-wallet", [label("1"), title("Wallet UI", { size: 34 }), body("Network selection, campaign forms, contribution panel.", { size: 21 })], { width: grow(1), height: fill }),
          softPanel("arch-token", [label("2"), title("USDC approve", { size: 34 }), body("ERC-20 allowance and balance checks before funding.", { size: 21 })], { width: grow(1), height: fill, fill: COLORS.bluePale }),
          softPanel("arch-contracts", [label("3"), title("Campaign contract", { size: 34 }), body("createCampaign, contribute, claimFunds, refund.", { size: 21 })], { width: grow(1), height: fill, fill: COLORS.mint }),
          softPanel("arch-index", [label("4"), title("Feed API", { size: 34 }), body("Subgraphs, RPC reads, registry metadata, trust context.", { size: 21 })], { width: grow(1), height: fill }),
        ]
      ),
      body("Technical video should show: networks.js, contracts.js, CreateCampaign.jsx, ContributeBox.jsx, and campaignFeed.js.", { size: 24, color: COLORS.ink }),
    ],
    6
  );
}

// 7. Roadmap
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader("Roadmap", "Grant work turns the beta into a stronger Arc-native USDC product", "A focused 90-day plan: harden what is live, then integrate deeper Circle infrastructure where it improves onboarding and liquidity."),
      grid(
        { name: "roadmap-grid", width: fill, height: fixed(390), columns: [fr(1), fr(1), fr(1)], rows: [fr(1)], columnGap: 30 },
        [
          softPanel("roadmap-1", [label("0-30 DAYS", { color: COLORS.usdc }), title("Arc beta hardening", { size: 34 }), body("Improve Arc indexing, campaign state reliability, monitoring, and demo documentation.", { size: 22 })], { width: fill, height: fill, fill: COLORS.bluePale }),
          softPanel("roadmap-2", [label("31-60 DAYS", { color: COLORS.arc }), title("Circle integration design", { size: 34 }), body("Prototype onboarding and cross-chain USDC paths with Circle Wallets, CCTP, and Gateway evaluation.", { size: 22 })], { width: fill, height: fill, fill: COLORS.mint }),
          softPanel("roadmap-3", [label("61-90 DAYS", { color: COLORS.amber }), title("Launch readiness", { size: 34 }), body("Security review, creator controls, analytics, and public docs for a mainnet-ready path.", { size: 22 })], { width: fill, height: fill }),
        ]
      ),
    ],
    7
  );
}

// 8. Ask
{
  const slide = deck.slides.add();
  slideRoot(
    slide,
    [
      sectionHeader("Grant ask", "Support the move from shipped testnet beta to production-grade USDC crowdfunding", "BaseFundAI has already shipped the core product. The grant funds the next reliability, integration, and security layer."),
      row(
        { name: "ask-row", width: fill, height: fixed(360), gap: 34 },
        [
          column(
            { name: "ask-left", width: grow(1), height: fill, gap: 22 },
            [
              title("What funding unlocks", { size: 44 }),
              body("Engineering time for Arc-specific hardening, Circle product prototypes, monitoring, test coverage, security review, and public documentation.", { size: 27, color: COLORS.ink }),
              body("Founder-led full-stack execution across contracts, frontend, backend indexing, trust signals, and VPS production deployment.", { size: 22, color: COLORS.muted }),
            ]
          ),
          softPanel(
            "ask-right",
            [
              label("LIVE LINKS", { color: COLORS.usdc }),
              title("basefundai.tech", { size: 42 }),
              body("Public testnet beta is live over HTTPS with health checks and chain summary APIs.", { size: 23 }),
              label("Submission note: upload this deck plus the 5-minute technical video.", { size: 18, color: COLORS.muted }),
            ],
            { width: grow(1), height: fill, fill: COLORS.pale }
          ),
        ]
      ),
    ],
    8
  );
}

const pptxPath = join(outputDir, "BaseFundAI-Circle-Grant-Deck.pptx");
const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(pptxPath);

const previewDir = join(outputDir, "previews");
const parityPreviewDir = join(outputDir, "pptx-previews");
await mkdir(previewDir, { recursive: true });
await mkdir(parityPreviewDir, { recursive: true });

for (let i = 0; i < deck.slides.count; i += 1) {
  const slide = deck.slides.getItem(i);
  const png = await slide.export({ mimeType: "image/png" });
  await writeFile(join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`), Buffer.from(await png.arrayBuffer()));
}

const savedBytes = await readFile(pptxPath);
const imported = await PresentationFile.importPptx(savedBytes);
for (let i = 0; i < imported.slides.count; i += 1) {
  const slide = imported.slides.getItem(i);
  const png = await slide.export({ mimeType: "image/png" });
  await writeFile(join(parityPreviewDir, `slide-${String(i + 1).padStart(2, "0")}.png`), Buffer.from(await png.arrayBuffer()));
}

if (sharp) {
  const slideFiles = Array.from({ length: imported.slides.count }, (_, i) =>
    join(parityPreviewDir, `slide-${String(i + 1).padStart(2, "0")}.png`)
  );
  const thumbWidth = 480;
  const thumbHeight = 270;
  const columns = 2;
  const rows = Math.ceil(slideFiles.length / columns);
  const composites = [];
  for (let i = 0; i < slideFiles.length; i += 1) {
    const input = await sharp(slideFiles[i]).resize(thumbWidth, thumbHeight).png().toBuffer();
    composites.push({
      input,
      left: (i % columns) * thumbWidth,
      top: Math.floor(i / columns) * thumbHeight,
    });
  }
  await sharp({
    create: {
      width: columns * thumbWidth,
      height: rows * thumbHeight,
      channels: 4,
      background: "#FFFFFF",
    },
  })
    .composite(composites)
    .png()
    .toFile(join(outputDir, "BaseFundAI-Circle-Grant-Deck-montage.png"));
}

console.log(JSON.stringify({
  pptxPath,
  previewDir,
  parityPreviewDir,
  montagePath: join(outputDir, "BaseFundAI-Circle-Grant-Deck-montage.png"),
  slideCount: deck.slides.count,
}, null, 2));
