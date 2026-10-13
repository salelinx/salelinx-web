import type { CSSProperties, ReactNode } from "react";
import { GLYPH, type Brand } from "@/components/BrandWordmark";

const INK = "#18181b";
const MID = "#a1a1aa";
const SOFT = "#f4f4f5";
const PAPER = "#ffffff";
const DEPOP = "#ff2300";
const VINTED = "#007782";
const GREEN = "#16a34a";

const P = {
  beanie: "/products/star-beanie.jpg",
  ukBeanie: "/products/union-jack-beanie.jpg",
  greyBeanie: "/products/grey-star-beanie.jpg",
  whiteBeanie: "/products/white-star-beanie.jpg",
  belt: "/products/western-belt.jpg",
  shades: "/products/black-sunglasses.jpg",
  sportShades: "/products/sport-sunglasses.jpg",
  catRing: "/products/cat-ring.jpg",
  rings: "/products/strawberry-rings.jpg",
  necklace: "/products/cross-necklace.jpg",
  cross: "/products/crystal-cross.jpg",
  rose: "/products/rose-charm.jpg",
};

export type SceneId =
  | "listings"
  | "grow"
  | "relist"
  | "refresh"
  | "crosslist"
  | "shopDesigner"
  | "deadStock"
  | "autoOffers"
  | "linking"
  | "restocker"
  | "priceDrops"
  | "offers"
  | "messages"
  | "labels";

function a(name: string, seconds: number, delay = 0, extra?: CSSProperties): CSSProperties {
  return {
    animation: `${name} ${seconds}s cubic-bezier(0.4, 0, 0.2, 1) ${delay}s infinite both`,
    ...extra,
  };
}

const BRAND_COLOR: Record<Brand, string> = { depop: DEPOP, vinted: VINTED };

function Mark({ x, y, brand, r = 9 }: { x: number; y: number; brand: Brand; r?: number }) {
  const g = GLYPH[brand].mark;
  const s = r * 1.05;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={BRAND_COLOR[brand]} stroke={PAPER} strokeWidth={1.5} />
      <svg x={x - s / 2} y={y - s / 2} width={s} height={s} viewBox={g.viewBox} fill={PAPER}>
        {g.d}
      </svg>
    </g>
  );
}

function Wordmark({ x, y, brand, h = 12 }: { x: number; y: number; brand: Brand; h?: number }) {
  const g = GLYPH[brand].wordmark;
  const [, , vw, vh] = g.viewBox.split(" ").map(Number);
  const w = (vw / vh) * h;
  return (
    <svg x={x - w / 2} y={y} width={w} height={h} viewBox={g.viewBox} fill={g.fill}>
      {g.d}
    </svg>
  );
}

function Photo({ id, x, y, w, h, src, rx = 4 }: { id: string; x: number; y: number; w: number; h: number; src: string; rx?: number }) {
  return (
    <>
      <clipPath id={id}>
        <rect x={x} y={y} width={w} height={h} rx={rx} />
      </clipPath>
      <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${id})`} />
    </>
  );
}

function Card({
  id,
  x,
  y,
  w = 70,
  h = 84,
  src,
  brand,
  price,
  style,
}: {
  id: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  src: string;
  brand?: Brand;
  price?: string;
  style?: CSSProperties;
}) {
  const ph = h * 0.62;
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <Photo id={id} x={x + 5} y={y + 5} w={w - 10} h={ph} src={src} />
      {price ? (
        <text x={x + 8} y={y + ph + 19} fontSize={11} fontWeight={700} fill={INK} fontFamily="ui-sans-serif, system-ui">
          {price}
        </text>
      ) : (
        <rect x={x + 8} y={y + ph + 12} width={w * 0.5} height={4} rx={2} fill={INK} />
      )}
      <rect x={x + 8} y={y + h - 11} width={w * 0.34} height={3.5} rx={1.75} fill={MID} />
      {brand && <Mark x={x + w - 3} y={y + 3} brand={brand} />}
    </g>
  );
}

function Pill({ x, y, text, w = 44, fill = INK, style }: { x: number; y: number; text: string; w?: number; fill?: string; style?: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={18} rx={9} fill={fill} />
      <text x={x + w / 2} y={y + 12.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={PAPER} fontFamily="ui-monospace, monospace" letterSpacing={0.5}>
        {text}
      </text>
    </g>
  );
}

function Row({
  id,
  x,
  y,
  w = 200,
  src,
  brand,
  style,
  bar = 0.6,
  right,
}: {
  id: string;
  x: number;
  y: number;
  w?: number;
  src: string;
  brand?: Brand;
  style?: CSSProperties;
  bar?: number;
  right?: ReactNode;
}) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={32} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <Photo id={id} x={x + 4} y={y + 4} w={24} h={24} src={src} rx={5} />
      <rect x={x + 36} y={y + 10} width={(w - 70) * bar} height={4} rx={2} fill={INK} />
      <rect x={x + 36} y={y + 19} width={(w - 70) * 0.35} height={4} rx={2} fill={MID} />
      {brand && <Mark x={x + w - 15} y={y + 16} brand={brand} r={8} />}
      {right}
    </g>
  );
}

function Heart({ x, y, fill = DEPOP, style }: { x: number; y: number; fill?: string; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M0 3.5C0 1.5 1.5 0 3.3 0 4.6 0 5.5.8 6 1.8 6.5.8 7.4 0 8.7 0 10.5 0 12 1.5 12 3.5 12 7 6 10.5 6 10.5S0 7 0 3.5z"
        fill={fill}
        style={style}
      />
    </g>
  );
}

const SCENES: Record<SceneId, () => ReactNode> = {
  listings: () => {
    const items = [P.beanie, P.shades, P.rings, P.belt, P.necklace, P.ukBeanie];
    return (
      <>
        {items.map((src, i) => (
          <Card
            key={i}
            id={`li${i}`}
            x={40 + (i % 3) * 84}
            y={14 + Math.floor(i / 3) * 92}
            src={src}
            brand={i % 2 ? "vinted" : "depop"}
            price={["£18", "£12", "£9", "£25", "£14", "£20"][i]}
            style={a("fa-pop", 5, i * 0.18)}
          />
        ))}
      </>
    );
  },

  grow: () => {
    const ring = [0, 1, 2, 3, 4, 5].map((i) => {
      const t = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return { x: 160 + Math.cos(t) * 82, y: 100 + Math.sin(t) * 70 };
    });
    const avatars = [1, 2, 3, 4, 5, 6].map((n) => `/people/seller-${n}.jpg`);
    return (
      <>
        {ring.map((p, i) => (
          <line
            key={`l${i}`}
            x1={160}
            y1={100}
            x2={p.x}
            y2={p.y}
            stroke={VINTED}
            strokeWidth={1.5}
            strokeDasharray="80"
            style={a("fa-draw", 5, i * 0.35, { "--len": "80" } as CSSProperties)}
          />
        ))}
        <circle cx={160} cy={100} r={28} fill={INK} />
        <circle cx={160} cy={92} r={8} fill={PAPER} />
        <rect x={147} y={103} width={26} height={11} rx={5.5} fill={PAPER} />
        {ring.map((p, i) => (
          <g key={`c${i}`} style={a("fa-pop", 5, 0.4 + i * 0.35)}>
            <circle cx={p.x} cy={p.y} r={17} fill={PAPER} stroke={INK} strokeWidth={1.5} />
            <Photo id={`gr${i}`} x={p.x - 15} y={p.y - 15} w={30} h={30} src={avatars[i]} rx={15} />
            <Mark x={p.x + 13} y={p.y + 12} brand="vinted" r={7} />
          </g>
        ))}
      </>
    );
  },

  relist: () => (
    <>
      <Card id="rl0" x={115} y={30} w={90} h={130} src={P.ukBeanie} brand="depop" price="£20" style={a("fa-relist-old", 5)} />
      <g style={a("fa-relist-new", 5)}>
        <Card id="rl1" x={115} y={30} w={90} h={130} src={P.ukBeanie} brand="depop" price="£20" />
        <Pill x={138} y={20} text="NEW" fill={GREEN} />
      </g>
      <path d="M268 95a22 22 0 1 1-6.4-15.6" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <path d="M262 71v8.5h-8.5" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  refresh: () => {
    const items = [P.beanie, P.rings, P.shades, P.belt];
    return (
      <>
        <Wordmark x={150} y={4} brand="depop" h={14} />
        {items.map((src, i) => (
          <Row key={i} id={`rf${i}`} x={50} y={30} src={src} style={a("fa-refresh-row", 6, -i * 1.5)} bar={0.4 + i * 0.12} />
        ))}
        <path d="M280 160V50m-10 10l10-10 10 10" fill="none" stroke={DEPOP} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={a("fa-pulse", 1.5)} />
      </>
    );
  },

  crosslist: () => (
    <>
      <Wordmark x={70} y={24} brand="depop" h={13} />
      <Wordmark x={250} y={24} brand="vinted" h={13} />
      <Card id="cl0" x={30} y={46} w={80} h={110} src={P.shades} price="£12" />
      <g>
        <rect x={210} y={46} width={80} height={110} rx={8} fill={PAPER} stroke={VINTED} strokeWidth={1.5} strokeDasharray="4 4" />
        <g style={a("fa-appear", 4)}>
          <Photo id="cl1" x={215} y={51} w={70} h={68} src={P.shades} />
          <text x={218} y={138} fontSize={11} fontWeight={700} fill={INK} fontFamily="ui-sans-serif, system-ui">£12</text>
        </g>
        <rect x={218} y={145} width={30} height={3.5} rx={1.75} fill={MID} style={a("fa-fill", 4, 0.1, { transformOrigin: "left center" })} />
      </g>
      <g style={a("fa-travel", 4)}>
        <rect x={42} y={70} width={56} height={56} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.5} />
        <Photo id="cl2" x={46} y={74} w={48} h={48} src={P.shades} rx={5} />
      </g>
    </>
  ),

  shopDesigner: () => {
    const tiles = [P.ukBeanie, P.beanie, P.greyBeanie, P.whiteBeanie, P.belt, P.rings];
    return (
      <>
        <Wordmark x={160} y={4} brand="depop" h={13} />
        {tiles.map((src, i) => {
          const x = 70 + (i % 3) * 64;
          const y = 28 + Math.floor(i / 3) * 76;
          const style =
            i === 0
              ? a("fa-swap", 5, 0, { "--dx": "128px", "--dy": "76px" } as CSSProperties)
              : i === 5
                ? a("fa-swap", 5, 0, { "--dx": "-128px", "--dy": "-76px" } as CSSProperties)
                : undefined;
          return (
            <g key={i} style={style}>
              <rect x={x} y={y} width={56} height={68} rx={7} fill={PAPER} stroke={i === 0 ? DEPOP : INK} strokeWidth={i === 0 ? 2.5 : 1.5} />
              <Photo id={`sd${i}`} x={x + 4} y={y + 4} w={48} h={48} src={src} />
              <rect x={x + 6} y={y + 57} width={30} height={4} rx={2} fill={MID} />
            </g>
          );
        })}
        <g transform="translate(112 72)">
          <path
            d="M0 0l0 16 4.5-4.5 3.5 7 3-1.5-3.5-7 6.5 0z"
            fill={PAPER}
            stroke={INK}
            strokeWidth={1.3}
            strokeLinejoin="round"
            style={a("fa-swap", 5, 0, { "--dx": "128px", "--dy": "76px" } as CSSProperties)}
          />
        </g>
      </>
    );
  },

  deadStock: () => (
    <>
      <Row id="ds0" x={40} y={20} src={P.beanie} brand="depop" bar={0.9} />
      <Row id="ds1" x={40} y={60} src={P.rings} brand="vinted" bar={0.7} />
      <Row id="ds2" x={40} y={100} src={P.cross} brand="depop" bar={0.15} style={a("fa-dim", 5)} />
      <Row id="ds3" x={40} y={140} src={P.shades} brand="vinted" bar={0.8} />
      <Pill x={250} y={107} text="-10%" fill={DEPOP} style={a("fa-pop", 5, 1.2)} />
      <text x={272} y={98} textAnchor="middle" fontSize={9} fill={MID} fontFamily="ui-monospace, monospace" style={a("fa-pop", 5, 0.9)}>
        90 DAYS
      </text>
    </>
  ),

  autoOffers: () => (
    <>
      <Wordmark x={80} y={168} brand="vinted" h={13} />
      <Card id="ao0" x={40} y={44} w={80} h={110} src={P.catRing} brand="vinted" price="£20" />
      {[0, 1, 2].map((i) => (
        <Heart key={i} x={66 + i * 14} y={36} style={a("fa-rise", 3, i * 0.6)} />
      ))}
      <line x1={130} y1={100} x2={196} y2={100} stroke={VINTED} strokeWidth={1.8} strokeDasharray="4 5" style={a("fa-dash", 1.2)} />
      <path d="M190 94l8 6-8 6" fill="none" stroke={VINTED} strokeWidth={1.8} strokeLinecap="round" />
      <g style={a("fa-pop", 3, 0.8)}>
        <rect x={208} y={76} width={88} height={48} rx={12} fill={VINTED} />
        <text x={252} y={96} textAnchor="middle" fontSize={9} fill={PAPER} opacity={0.8} fontFamily="ui-monospace, monospace">OFFER SENT</text>
        <text x={252} y={113} textAnchor="middle" fontSize={13} fontWeight={700} fill={PAPER} fontFamily="ui-sans-serif, system-ui">£17</text>
      </g>
    </>
  ),

  linking: () => {
    const left = [P.beanie, P.rings, P.belt];
    const right = [P.belt, P.beanie, P.rings];
    return (
      <>
        <Wordmark x={80} y={6} brand="depop" h={13} />
        <Wordmark x={240} y={6} brand="vinted" h={13} />
        {left.map((src, i) => (
          <Row key={`l${i}`} id={`lk${i}`} x={30} y={30 + i * 50} w={100} src={src} bar={0.9} />
        ))}
        {right.map((src, i) => (
          <Row key={`r${i}`} id={`lr${i}`} x={190} y={30 + i * 50} w={100} src={src} bar={0.9} />
        ))}
        <path d="M130 46C160 46 160 96 190 96" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="70" style={a("fa-draw", 5, 0, { "--len": "70" } as CSSProperties)} />
        <path d="M130 96C160 96 160 146 190 146" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="70" style={a("fa-draw", 5, 0.8, { "--len": "70" } as CSSProperties)} />
        <path d="M130 146C160 146 160 46 190 46" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="120" style={a("fa-draw", 5, 1.6, { "--len": "120" } as CSSProperties)} />
      </>
    );
  },

  restocker: () => (
    <>
      <Wordmark x={93} y={14} brand="depop" h={13} />
      <Wordmark x={227} y={14} brand="vinted" h={13} />
      <Card id="rs0" x={50} y={38} w={86} h={120} src={P.rose} price="£14" />
      <Card id="rs1" x={184} y={38} w={86} h={120} src={P.rose} price="£14" style={a("fa-vanish", 5)} />
      <g style={a("fa-stamp", 5)}>
        <rect x={60} y={60} width={66} height={26} rx={4} fill={PAPER} stroke={DEPOP} strokeWidth={2.5} transform="rotate(-12 93 73)" />
        <text x={93} y={78} textAnchor="middle" fontSize={13} fontWeight={800} fill={DEPOP} transform="rotate(-12 93 73)" fontFamily="ui-sans-serif, system-ui" letterSpacing={1}>SOLD</text>
      </g>
      <path d="M144 98h32" stroke={INK} strokeWidth={1.5} strokeDasharray="4.5 4.5" style={a("fa-dash", 1.2)} />
    </>
  ),

  priceDrops: () => (
    <>
      <Card id="pd0" x={232} y={14} w={66} h={80} src={P.whiteBeanie} brand="vinted" />
      <line x1={30} y1={170} x2={290} y2={170} stroke={GREEN} strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={290} y={186} textAnchor="end" fontSize={9} fill={GREEN} fontFamily="ui-monospace, monospace">MIN £30</text>
      <path d="M30 60H90V100H150V135H210V160" fill="none" stroke={SOFT} strokeWidth={2.5} strokeLinejoin="round" />
      <path d="M30 60H90V100H150V135H210V160" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="280" style={a("fa-step-draw", 6)} />
      <g style={a("fa-step-move", 6)}>
        {(["fa-s1", "fa-s2", "fa-s3"] as const).map((k, i) => (
          <g key={k} style={a(k, 6)}>
            <Pill x={40} y={34} text={["£40", "£36", "£32"][i]} w={40} fill={DEPOP} />
          </g>
        ))}
      </g>
    </>
  ),

  offers: () => {
    const rows = [
      { src: P.beanie, brand: "depop" as const, price: "£22" },
      { src: P.sportShades, brand: "vinted" as const, price: "£15" },
      { src: P.necklace, brand: "depop" as const, price: "£30" },
    ];
    return (
      <>
        {rows.map((r, i) => (
          <g key={i} style={a(["fa-of-in1", "fa-of-in2", "fa-of-in3"][i], 6)}>
            <Row
              id={`of${i}`}
              x={40}
              y={30 + i * 50}
              w={190}
              src={r.src}
              brand={r.brand}
              bar={0.5}
              right={
                <text x={192} y={51 + i * 50} textAnchor="end" fontSize={11} fontWeight={700} fill={INK} fontFamily="ui-sans-serif, system-ui">
                  {r.price}
                </text>
              }
            />
          </g>
        ))}
        {[0, 2].map((i) => (
          <g key={`c${i}`} style={a(i ? "fa-of-dec3" : "fa-of-dec1", 6)}>
            <circle cx={256} cy={46 + i * 50} r={14} fill={GREEN} />
            <path d={`M250 ${46 + i * 50}l4 4 8-8`} fill="none" stroke={PAPER} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        <g style={a("fa-of-dec2", 6)}>
          <circle cx={256} cy={96} r={14} fill={PAPER} stroke={INK} strokeWidth={1.5} />
          <path d="M250 96h12m-4-4l4 4-4 4" fill="none" stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </>
    );
  },

  messages: () => (
    <>
      <rect x={96} y={10} width={150} height={180} rx={14} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {[0, 1, 2, 3].map((i) => {
        const brand: Brand = i % 2 ? "vinted" : "depop";
        const y = 24 + i * 40;
        return (
          <g key={i} style={a("fa-pop", 6, i * 0.5)}>
            <rect x={108} y={y} width={126} height={30} rx={10} fill={brand === "depop" ? "#fff1ee" : "#e6f4f5"} />
            <Photo id={`ms${i}`} x={113} y={y + 5} w={20} h={20} src={[P.shades, P.rings, P.beanie, P.belt][i]} rx={10} />
            <rect x={140} y={y + 9} width={60} height={4} rx={2} fill={INK} />
            <rect x={140} y={y + 17} width={36} height={4} rx={2} fill={MID} />
            <Mark x={222} y={y + 15} brand={brand} r={7} />
          </g>
        );
      })}
      <Mark x={58} y={62} brand="depop" r={14} />
      <Mark x={58} y={138} brand="vinted" r={14} />
      <path d="M74 62h18M74 138h18" stroke={INK} strokeWidth={1.5} strokeDasharray="3 3" style={a("fa-dash", 1.2)} />
    </>
  ),

  labels: () => {
    const carriers = ["/brand/royal-mail.png", "/brand/evri.png", "/brand/inpost.png"];
    return (
      <>
        {carriers.map((src, i) => (
          <g key={i} style={a(`fa-lb-drop${i + 1}`, 6)}>
            <rect x={40 + i * 18} y={50 + i * 12} width={60} height={80} rx={5} fill={PAPER} stroke={INK} strokeWidth={1.5} />
            <image href={src} x={46 + i * 18} y={56 + i * 12} width={16} height={16} />
            <rect x={66 + i * 18} y={60 + i * 12} width={28} height={4} rx={2} fill={INK} />
            <rect x={46 + i * 18} y={104 + i * 12} width={48} height={16} rx={2} fill={INK} opacity={0.85} />
          </g>
        ))}
        <path d="M150 110h26m-8-8l8 8-8 8" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <g style={a("fa-lb-sheet", 6)}>
          <rect x={194} y={26} width={92} height={140} rx={6} fill={PAPER} stroke={INK} strokeWidth={1.5} />
          {carriers.map((src, j) => (
            <g key={j} style={a(`fa-lb-row${j + 1}`, 6)}>
              <rect x={202} y={36 + j * 40} width={76} height={32} rx={3} fill={SOFT} />
              <image href={src} x={206} y={40 + j * 40} width={14} height={14} />
              <rect x={224} y={44 + j * 40} width={40} height={3.5} rx={1.75} fill={INK} />
              <rect x={206} y={58 + j * 40} width={60} height={5} rx={1} fill={INK} opacity={0.7} />
            </g>
          ))}
          <Pill x={218} y={156} text="PDF" fill={DEPOP} style={a("fa-lb-pill", 6)} />
        </g>
      </>
    );
  },
};

export function FeatureScene({ id }: { id: SceneId }) {
  return (
    <svg viewBox="0 0 320 200" className="fa h-auto w-full" aria-hidden>
      {SCENES[id]()}
    </svg>
  );
}
