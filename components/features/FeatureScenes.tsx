import type { CSSProperties, ReactNode } from "react";

const INK = "#18181b";
const MID = "#a1a1aa";
const SOFT = "#f4f4f5";
const PAPER = "#ffffff";

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

function Card({
  x,
  y,
  w = 70,
  h = 84,
  mark,
  style,
  dark = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  mark?: "D" | "V";
  style?: CSSProperties;
  dark?: boolean;
}) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <rect x={x + 7} y={y + 7} width={w - 14} height={h * 0.45} rx={4} fill={dark ? INK : SOFT} />
      <rect x={x + 7} y={y + h * 0.62} width={w * 0.6} height={4} rx={2} fill={INK} />
      <rect x={x + 7} y={y + h * 0.75} width={w * 0.38} height={4} rx={2} fill={MID} />
      {mark && <Mark x={x + w - 4} y={y + 4} letter={mark} />}
    </g>
  );
}

function Mark({ x, y, letter }: { x: number; y: number; letter: "D" | "V" }) {
  return (
    <g>
      <circle cx={x} cy={y} r={9} fill={INK} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize={10} fontWeight={700} fill={PAPER} fontFamily="ui-sans-serif, system-ui">
        {letter}
      </text>
    </g>
  );
}

function Pill({ x, y, text, w = 44, style }: { x: number; y: number; text: string; w?: number; style?: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={18} rx={9} fill={INK} />
      <text x={x + w / 2} y={y + 12.5} textAnchor="middle" fontSize={9} fill={PAPER} fontFamily="ui-monospace, monospace" letterSpacing={0.5}>
        {text}
      </text>
    </g>
  );
}

function Row({ x, y, w = 200, style, bar = 0.6 }: { x: number; y: number; w?: number; style?: CSSProperties; bar?: number }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={30} rx={7} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      <rect x={x + 6} y={y + 6} width={18} height={18} rx={4} fill={SOFT} />
      <rect x={x + 32} y={y + 9} width={(w - 50) * bar} height={4} rx={2} fill={INK} />
      <rect x={x + 32} y={y + 18} width={(w - 50) * 0.35} height={4} rx={2} fill={MID} />
    </g>
  );
}

const SCENES: Record<SceneId, () => ReactNode> = {
  listings: () => (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Card
          key={i}
          x={40 + (i % 3) * 84}
          y={18 + Math.floor(i / 3) * 92}
          mark={i % 2 ? "V" : "D"}
          style={a("fa-pop", 5, i * 0.18)}
        />
      ))}
    </>
  ),

  grow: () => {
    const ring = [0, 1, 2, 3, 4, 5].map((i) => {
      const t = (i / 6) * Math.PI * 2 - Math.PI / 2;
      return { x: 160 + Math.cos(t) * 78, y: 100 + Math.sin(t) * 70 };
    });
    return (
      <>
        {ring.map((p, i) => (
          <line
            key={`l${i}`}
            x1={160}
            y1={100}
            x2={p.x}
            y2={p.y}
            stroke={INK}
            strokeWidth={1.5}
            strokeDasharray="80"
            style={a("fa-draw", 5, i * 0.35, { "--len": "80" } as CSSProperties)}
          />
        ))}
        <circle cx={160} cy={100} r={26} fill={INK} />
        <circle cx={160} cy={93} r={8} fill={PAPER} />
        <rect x={147} y={104} width={26} height={11} rx={5.5} fill={PAPER} />
        {ring.map((p, i) => (
          <g key={`c${i}`} style={a("fa-pop", 5, 0.4 + i * 0.35)}>
            <circle cx={p.x} cy={p.y} r={15} fill={PAPER} stroke={INK} strokeWidth={1.5} />
            <path d={`M${p.x - 5} ${p.y}h10M${p.x} ${p.y - 5}v10`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
          </g>
        ))}
      </>
    );
  },

  relist: () => (
    <>
      <Card x={120} y={40} w={80} h={110} style={a("fa-relist-old", 5)} />
      <g style={a("fa-relist-new", 5)}>
        <Card x={120} y={40} w={80} h={110} dark />
        <Pill x={138} y={28} text="NEW" />
      </g>
      <path d="M268 95a22 22 0 1 1-6.4-15.6" fill="none" stroke={MID} strokeWidth={1.5} strokeLinecap="round" />
      <path d="M262 71v8.5h-8.5" fill="none" stroke={MID} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),

  refresh: () => (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Row key={i} x={60} y={30} style={a("fa-refresh-row", 6, -i * 1.5)} bar={0.4 + i * 0.12} />
      ))}
      <path d="M280 150V50m-10 10l10-10 10 10" fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={a("fa-pulse", 1.5)} />
    </>
  ),

  crosslist: () => (
    <>
      <Card x={30} y={50} w={80} h={100} mark="D" />
      <g>
        <rect x={210} y={50} width={80} height={100} rx={8} fill={PAPER} stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" />
        <Mark x={286} y={54} letter="V" />
        <rect x={217} y={57} width={66} height={45} rx={4} fill={SOFT} style={a("fa-appear", 4)} />
        <rect x={217} y={112} width={48} height={4} rx={2} fill={INK} style={a("fa-fill", 4, 0, { transformOrigin: "left center" })} />
        <rect x={217} y={125} width={30} height={4} rx={2} fill={MID} style={a("fa-fill", 4, 0.1, { transformOrigin: "left center" })} />
      </g>
      <g style={a("fa-travel", 4)}>
        <rect x={45} y={80} width={50} height={40} rx={6} fill={INK} />
      </g>
    </>
  ),

  shopDesigner: () => (
    <>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 70 + (i % 3) * 64;
        const y = 30 + Math.floor(i / 3) * 74;
        const style =
          i === 0
            ? a("fa-swap", 5, 0, { "--dx": "128px", "--dy": "74px" } as CSSProperties)
            : i === 5
              ? a("fa-swap", 5, 0, { "--dx": "-128px", "--dy": "-74px" } as CSSProperties)
              : undefined;
        return (
          <g key={i} style={style}>
            <rect x={x} y={y} width={54} height={64} rx={7} fill={i === 0 ? INK : PAPER} stroke={INK} strokeWidth={1.5} />
            <rect x={x + 6} y={y + 46} width={30} height={4} rx={2} fill={i === 0 ? PAPER : MID} />
          </g>
        );
      })}
      {/* SVG transform on the wrapper: a CSS animation on the same element would replace it. */}
      <g transform="translate(110 70)">
        <path
          d="M0 0l0 16 4.5-4.5 3.5 7 3-1.5-3.5-7 6.5 0z"
          fill={PAPER}
          stroke={INK}
          strokeWidth={1.3}
          strokeLinejoin="round"
          style={a("fa-swap", 5, 0, { "--dx": "128px", "--dy": "74px" } as CSSProperties)}
        />
      </g>
    </>
  ),

  deadStock: () => (
    <>
      <Row x={50} y={22} bar={0.9} />
      <Row x={50} y={62} bar={0.7} />
      <Row x={50} y={102} bar={0.15} style={a("fa-dim", 5)} />
      <Row x={50} y={142} bar={0.8} />
      <Pill x={258} y={108} text="-10%" style={a("fa-pop", 5, 1.2)} />
      <path d="M262 92l6-14 6 14z" fill={INK} style={a("fa-pop", 5, 0.9)} />
    </>
  ),

  autoOffers: () => (
    <>
      <Card x={40} y={50} w={80} h={100} mark="V" />
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${70 + i * 14} 40)`}>
          <path
            d="M0 3.5C0 1.5 1.5 0 3.3 0 4.6 0 5.5.8 6 1.8 6.5.8 7.4 0 8.7 0 10.5 0 12 1.5 12 3.5 12 7 6 10.5 6 10.5S0 7 0 3.5z"
            fill={INK}
            style={a("fa-rise", 3, i * 0.6)}
          />
        </g>
      ))}
      <line x1={130} y1={100} x2={196} y2={100} stroke={INK} strokeWidth={1.5} strokeDasharray="4 5" style={a("fa-dash", 1.2)} />
      <path d="M190 94l8 6-8 6" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" />
      <g style={a("fa-pop", 3, 0.8)}>
        <rect x={208} y={78} width={86} height={44} rx={12} fill={INK} />
        <text x={251} y={98} textAnchor="middle" fontSize={9} fill={MID} fontFamily="ui-monospace, monospace">OFFER</text>
        <text x={251} y={113} textAnchor="middle" fontSize={12} fontWeight={700} fill={PAPER} fontFamily="ui-sans-serif, system-ui">£18</text>
      </g>
    </>
  ),

  linking: () => (
    <>
      {[0, 1, 2].map((i) => (
        <Row key={`l${i}`} x={30} y={30 + i * 50} w={100} bar={0.5 + i * 0.15} />
      ))}
      {[0, 1, 2].map((i) => (
        <Row key={`r${i}`} x={190} y={30 + i * 50} w={100} bar={0.8 - i * 0.15} />
      ))}
      <path d="M130 45C160 45 160 95 190 95" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="70" style={a("fa-draw", 5, 0, { "--len": "70" } as CSSProperties)} />
      <path d="M130 145C160 145 160 45 190 45" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="120" style={a("fa-draw", 5, 0.8, { "--len": "120" } as CSSProperties)} />
      <path d="M130 95C160 95 160 145 190 145" fill="none" stroke={INK} strokeWidth={2} strokeDasharray="70" style={a("fa-draw", 5, 1.6, { "--len": "70" } as CSSProperties)} />
    </>
  ),

  restocker: () => (
    <>
      <Card x={50} y={45} w={86} h={110} mark="D" />
      <Card x={184} y={45} w={86} h={110} mark="V" style={a("fa-vanish", 5)} />
      <g style={a("fa-stamp", 5)}>
        <rect x={60} y={58} width={66} height={26} rx={4} fill={PAPER} stroke={INK} strokeWidth={2.5} transform="rotate(-12 93 71)" />
        <text x={93} y={76} textAnchor="middle" fontSize={13} fontWeight={800} fill={INK} transform="rotate(-12 93 71)" fontFamily="ui-sans-serif, system-ui" letterSpacing={1}>SOLD</text>
      </g>
      <path d="M144 100h32" stroke={INK} strokeWidth={1.5} strokeDasharray="4 4" style={a("fa-dash", 1.2)} />
    </>
  ),

  priceDrops: () => (
    <>
      <line x1={40} y1={160} x2={280} y2={160} stroke={MID} strokeWidth={1.5} strokeDasharray="4 4" />
      <text x={280} y={174} textAnchor="end" fontSize={9} fill={MID} fontFamily="ui-monospace, monospace">MIN</text>
      <path d="M40 50H110V90H180V125H250V150" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeDasharray="360" style={a("fa-draw", 6, 0, { "--len": "360" } as CSSProperties)} />
      {(
        [
          ["fa-t1", "£40", 40, 50],
          ["fa-t2", "£36", 110, 90],
          ["fa-t3", "£32", 180, 125],
        ] as const
      ).map(([k, label, x, y]) => (
        <g key={k} style={a(k, 6)}>
          <Pill x={x + 12} y={y - 26} text={label} w={40} />
        </g>
      ))}
    </>
  ),

  offers: () => (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i} style={a("fa-slide-in", 5, i * 0.4)}>
          <Row x={50} y={35 + i * 48} w={170} bar={0.5} />
          <text x={196} y={55 + i * 48} textAnchor="end" fontSize={10} fontWeight={700} fill={INK} fontFamily="ui-sans-serif, system-ui">
            £{[22, 15, 30][i]}
          </text>
        </g>
      ))}
      {[0, 2].map((i) => (
        <g key={`c${i}`} style={a("fa-pop", 5, 1.6 + i * 0.2)}>
          <circle cx={248} cy={50 + i * 48} r={13} fill={INK} />
          <path d={`M242 ${50 + i * 48}l4 4 8-8`} fill="none" stroke={PAPER} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      <g style={a("fa-pop", 5, 1.8)}>
        <circle cx={248} cy={98} r={13} fill={PAPER} stroke={INK} strokeWidth={1.5} />
        <path d="M242 98h12m-4-4l4 4-4 4" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </>
  ),

  messages: () => (
    <>
      <rect x={90} y={14} width={140} height={172} rx={14} fill={PAPER} stroke={INK} strokeWidth={1.5} />
      {[0, 1, 2, 3].map((i) => {
        const left = i % 2 === 0;
        const x = left ? 102 : 136;
        return (
          <g key={i} style={a("fa-pop", 6, i * 0.5)}>
            <rect x={x} y={28 + i * 38} width={82} height={28} rx={10} fill={left ? SOFT : INK} />
            <rect x={x + 10} y={37 + i * 38} width={46} height={4} rx={2} fill={left ? INK : PAPER} />
            <rect x={x + 10} y={45 + i * 38} width={28} height={4} rx={2} fill={MID} />
          </g>
        );
      })}
      <Mark x={62} y={60} letter="D" />
      <Mark x={62} y={140} letter="V" />
      <path d="M74 60h12M74 140h12" stroke={INK} strokeWidth={1.5} strokeDasharray="3 3" style={a("fa-dash", 1.2)} />
    </>
  ),

  labels: () => (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i} style={a("fa-drop", 5, i * 0.3)}>
          <rect x={50 + i * 16} y={60 + i * 10} width={56} height={74} rx={5} fill={PAPER} stroke={INK} strokeWidth={1.5} />
          <rect x={58 + i * 16} y={70 + i * 10} width={30} height={4} rx={2} fill={INK} />
          <rect x={58 + i * 16} y={110 + i * 10} width={40} height={12} rx={2} fill={SOFT} />
        </g>
      ))}
      <path d="M152 110h26m-8-8l8 8-8 8" fill="none" stroke={INK} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <g style={a("fa-sheet-out", 5)}>
        <rect x={196} y={36} width={84} height={124} rx={6} fill={PAPER} stroke={INK} strokeWidth={1.5} />
        {[0, 1, 2].map((j) => (
          <rect key={j} x={206} y={48 + j * 36} width={64} height={28} rx={3} fill={SOFT} stroke={MID} strokeDasharray="3 3" />
        ))}
        <Pill x={216} y={150} text="PDF" />
      </g>
    </>
  ),
};

export function FeatureScene({ id }: { id: SceneId }) {
  return (
    <svg viewBox="0 0 320 200" className="fa h-auto w-full" aria-hidden>
      {SCENES[id]()}
    </svg>
  );
}
