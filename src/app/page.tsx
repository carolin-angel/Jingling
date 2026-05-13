import Link from "next/link";

const games = [
  {
    slug: "gomoku",
    title: "五子棋",
    subtitle: "Gomoku",
    description: "15×15 棋盘，先成五连者胜。规则简单、节奏明快。",
  },
  {
    slug: "xiangqi",
    title: "中国象棋",
    subtitle: "Xiangqi",
    description: "楚河汉界，七种棋子，将军将死。千年博弈。",
  },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <header className="mb-12 max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Jingling 棋苑
        </h1>
        <p className="mt-4 text-base text-zinc-600 dark:text-zinc-400">
          在线五子棋与中国象棋。匿名快玩，登录可保存棋谱与复盘。
        </p>
      </header>

      <section className="grid w-full max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2">
        {games.map((game) => (
          <Link
            key={game.slug}
            href={`/${game.slug}`}
            className="group rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-semibold">{game.title}</h2>
              <span className="text-sm text-zinc-500">{game.subtitle}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {game.description}
            </p>
            <p className="mt-6 text-sm font-medium text-zinc-900 group-hover:underline dark:text-zinc-100">
              本地对战 →
            </p>
          </Link>
        ))}
      </section>

      <Link
        href="/play"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        🌐 联机对战 →
      </Link>
    </main>
  );
}
