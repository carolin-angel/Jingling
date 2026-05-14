import Link from "next/link";

const games = [
  {
    slug: "gomoku",
    title: "五子棋",
    subtitle: "Gomoku",
    description: "15×15 棋盘，先成五连者胜。落子明快，三十手见输赢。",
    accent: "from-amber-50 to-amber-100",
    available: true,
  },
  {
    slug: "xiangqi",
    title: "中国象棋",
    subtitle: "Xiangqi",
    description: "楚河汉界，七种棋子，将军将死。千年博弈。",
    accent: "from-rose-50 to-rose-100",
    available: false,
  },
] as const;

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col items-center overflow-hidden px-6 py-16 md:py-20">
      <BackgroundDecor />

      <Logo />

      <h1 className="mt-6 text-5xl font-bold tracking-tight">棋苑</h1>
      <p className="mt-1 text-xs uppercase tracking-[0.4em] text-zinc-400">
        Jingling
      </p>

      <div className="mt-10 max-w-md text-center">
        <p className="text-lg font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
          对弈，是另一种聊天。
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          和一个人，慢慢下一盘。
        </p>
      </div>

      <section className="mt-14 grid w-full max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </section>

      <Link
        href="/play"
        className="group mt-10 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-7 py-3 text-sm font-medium text-white shadow-sm transition-all hover:gap-3 hover:bg-zinc-700 hover:shadow-md dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        <span>进入联机对战</span>
        <span className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>

      <p className="mt-6 max-w-md text-center text-xs text-zinc-400">
        无需注册即可开房；想保留棋谱与战绩可点右上角登录。
      </p>
    </main>
  );
}

function Logo() {
  return (
    <svg
      width={112}
      height={112}
      viewBox="0 0 120 120"
      aria-label="Jingling 棋苑 logo"
      className="drop-shadow-sm"
    >
      <defs>
        <radialGradient id="wood" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#f0d8b1" />
          <stop offset="100%" stopColor="#c4a878" />
        </radialGradient>
        {/* 黑子：云子质感——蓝黑底、亮处有微微高光 */}
        <radialGradient id="black-stone" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#4a4a52" />
          <stop offset="35%" stopColor="#202028" />
          <stop offset="100%" stopColor="#08080c" />
        </radialGradient>
        {/* 精灵的灵子：象牙月光白，温和不冷 */}
        <radialGradient id="spirit-stone" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="45%" stopColor="#f7f1e2" />
          <stop offset="100%" stopColor="#ddd0b0" />
        </radialGradient>
        {/* 月光光晕：通透的柔白，不带蓝 */}
        <radialGradient id="aura" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#fff5e0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fff5e0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 木色棋盘底 */}
      <circle cx="60" cy="60" r="54" fill="url(#wood)" opacity="0.95" />

      {/* 棋盘交叉线（淡） */}
      <g stroke="#7a5a3a" strokeWidth="0.9" opacity="0.55">
        <line x1="14" y1="60" x2="106" y2="60" />
        <line x1="44" y1="14" x2="44" y2="106" />
        <line x1="76" y1="14" x2="76" y2="106" />
      </g>

      {/* 灵子背后的月光光晕（半径大于棋子，溢出来） */}
      <circle cx="76" cy="60" r="26" fill="url(#aura)" />

      {/* 小星点：散在灵子周围 */}
      <g fill="#ffffff">
        <circle cx="91" cy="44" r="1.4" opacity="0.95" />
        <circle cx="96" cy="62" r="0.9" opacity="0.85" />
        <circle cx="84" cy="80" r="1.1" opacity="0.9" />
        <circle cx="62" cy="42" r="0.7" opacity="0.7" />
      </g>

      {/* 四芒星：精灵的"灵签" */}
      <g transform="translate(86 40)" fill="#ffffff" opacity="0.95">
        <path d="M 0 -6 L 1.4 -1.4 L 6 0 L 1.4 1.4 L 0 6 L -1.4 1.4 L -6 0 L -1.4 -1.4 Z" />
      </g>

      {/* 黑子（人） */}
      <circle cx="44" cy="60" r="13" fill="url(#black-stone)" />

      {/* 灵子（精灵）—— 描边用米色而非蓝色，避免冷调 */}
      <circle
        cx="76"
        cy="60"
        r="13"
        fill="url(#spirit-stone)"
        stroke="#c0b48a"
        strokeOpacity="0.7"
        strokeWidth="0.6"
      />
    </svg>
  );
}

function BackgroundDecor() {
  return (
    <>
      {/* 顶端柔和的米色光晕 */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 -z-10 h-96 w-[120%] -translate-x-1/2 rounded-[50%] bg-gradient-to-b from-amber-100/60 to-transparent blur-2xl dark:from-amber-900/20"
        aria-hidden
      />
      {/* 底部一抹更浅的暖色 */}
      <div
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-64 w-[100%] -translate-x-1/2 bg-gradient-to-t from-rose-50/50 to-transparent blur-2xl dark:from-rose-950/20"
        aria-hidden
      />
    </>
  );
}

function GameCard({
  game,
}: {
  game: (typeof games)[number];
}) {
  if (!game.available) {
    return (
      <div className="group relative cursor-not-allowed overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 opacity-60 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-semibold">{game.title}</h2>
          <span className="text-xs text-zinc-500">{game.subtitle}</span>
        </div>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {game.description}
        </p>
        <p className="mt-6 text-sm font-medium text-zinc-400">
          即将上线
        </p>
      </div>
    );
  }

  return (
    <Link
      href={`/${game.slug}`}
      className={`group relative overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br ${game.accent} p-6 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950`}
    >
      <CardPattern />
      <div className="relative flex items-baseline justify-between">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          {game.title}
        </h2>
        <span className="text-xs text-zinc-500">{game.subtitle}</span>
      </div>
      <p className="relative mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-400">
        {game.description}
      </p>
      <p className="relative mt-6 text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
        本地对战 →
      </p>
    </Link>
  );
}

/** 卡片右下角的淡淡棋盘装饰 */
function CardPattern() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-3 -right-3 opacity-10"
      width={120}
      height={120}
      viewBox="0 0 120 120"
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth="0.8" fill="none">
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 18} x2="120" y2={i * 18} />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 18} y1="0" x2={i * 18} y2="120" />
        ))}
      </g>
      <circle cx="36" cy="54" r="6" fill="currentColor" />
      <circle cx="54" cy="36" r="6" fill="currentColor" opacity="0.5" />
    </svg>
  );
}
