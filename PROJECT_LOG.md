# Jingling 棋苑 · 开发日志

> 项目目标：从零搭建一个支持**五子棋**和**中国象棋**的网站，匿名快玩、登录可保存棋谱、可在线联机对战、可分享复盘。
>
> 本文件记录截至 2026-05-13 当天的整体设计、完成项、以及过程中遇到的所有坑与对应的解决方法。

---

## 1. 总览

### 1.1 核心体验

- **本地双人对战**：同一台电脑两人轮流落子
- **在线联机对战**：输昵称即可开房 → 复制链接发好友 → Realtime 同步走子
- **复盘**：本地棋盘可点击任一手回到当时局面；联机对局走子持久化到数据库
- **未来扩展**：象棋、残局/教学、计时器、AI 对战等

### 1.2 技术栈（最终落地版本）

| 层 | 选择 | 版本 |
|---|---|---|
| 框架 | Next.js + TypeScript + App Router + Turbopack | **Next.js 16.2.6** + React 19.2.4 |
| 样式 | Tailwind CSS | 4.x |
| 状态 | Zustand（客户端棋局状态） | 5.x |
| 数据获取 | TanStack Query | 5.x |
| 后端 | Supabase（Auth + Postgres + Realtime） | `@supabase/supabase-js` 2.x + `@supabase/ssr` 0.10 |
| 测试 | Vitest + Testing Library + Playwright | 3.2.4 / 16.x / 1.60 |
| DOM 测试环境 | happy-dom | 20.x |
| 包管理 | pnpm | 10.33.4 |
| 部署 | Vercel + Supabase 托管 | — |

---

## 2. 整体架构

### 2.1 目录结构（已落地）

```
src/
├── app/
│   ├── page.tsx                 # 首页：两款游戏卡片 + 联机入口
│   ├── gomoku/page.tsx          # 五子棋本地双人
│   ├── play/
│   │   ├── page.tsx             # 联机大厅（创建房间）
│   │   └── [matchId]/
│   │       ├── page.tsx         # 路由包装：解开 params Promise
│   │       └── MatchClient.tsx  # 联机对局核心客户端组件
│   └── layout.tsx
├── components/
│   ├── auth/NicknameDialog.tsx
│   ├── board/GomokuBoard.tsx    # SVG 棋盘：可下/只读、悬停预览、落子动画
│   └── match/
│       ├── MoveList.tsx         # 走子记录面板，可点击跳转复盘
│       └── VictoryOverlay.tsx   # 胜利/失败/和棋浮层
├── lib/
│   ├── audio/
│   │   └── useGameAudio.ts      # Web Audio 合成音效 + 静音持久化
│   ├── game-engine/
│   │   ├── types.ts             # 通用 Game<S,M,Init> 接口
│   │   └── gomoku/
│   │       ├── types.ts         # GomokuState, GomokuMove, ...
│   │       ├── pi-digits.ts     # 圆周率小数前 2400 位
│   │       ├── firstMove.ts     # decideBlack(hhmm, host)
│   │       ├── rules.ts         # isLegalMove, detectWin
│   │       ├── undo.ts          # 悔棋状态机
│   │       ├── index.ts         # 装配 Game 接口 + snapshotAt
│   │       └── *.test.ts        # 48 个单元测试
│   ├── realtime/
│   │   └── useMatchSync.ts      # 订阅 matches/moves 表变更
│   └── supabase/
│       ├── client.ts            # 浏览器端 client
│       ├── server.ts            # SSR client
│       ├── auth.ts              # ensureSession + getCurrentSession
│       ├── matches.ts           # createMatch, joinMatch, submitMove, finishMatch
│       └── types.ts             # 与 schema 对应的 TypeScript 类型
├── test/setup.ts                # Vitest 全局 setup
supabase/
└── migrations/
    └── 0001_init.sql            # 表结构、RLS、join_match RPC
vitest.config.mts
.env.example
.env.local                       # 本地凭据，已 gitignore
```

### 2.2 游戏引擎抽象

`src/lib/game-engine/types.ts` 定义通用契约：

```ts
export interface Game<State, Move, InitOptions = unknown> {
  initial(options: InitOptions): State;
  isLegal(state: State, move: Move): boolean;
  apply(state: State, move: Move): State;
  currentPlayer(state: State): Player;
  result(state: State): Result;
  serializeMove(move: Move): string;
}
```

设计动机：两款游戏并行开发，先抽象出共同接口，避免后期为象棋大改五子棋代码。`Player = "a" | "b"` 表示房间内的两位逻辑玩家（与棋子颜色解耦：五子棋黑白、象棋红黑都由 `blackPlayer/redPlayer` 等字段决定哪边对应 a/b）。

### 2.3 五子棋自定义规则（与标准不同！）

详见 `~/.claude/projects/-Users-liuling-Desktop-Jingling/memory/gomoku-custom-rules.md`。

| 规则 | 内容 | 实现位置 |
|---|---|---|
| 棋盘 | 15×15，黑先 | `gomoku/types.ts` BOARD_SIZE |
| **悔棋** | 每人每局申请一次；需对方同意；成功才算用过 | `gomoku/undo.ts` |
| **执黑决定** | 每局开局服务器时刻 HHMM（如 17:05 → 1705），查圆周率小数第 N 位。奇数 → 房主执黑，偶数 → 后加入者执黑。HHMM=0 取第 1 位。每局重新计算 | `gomoku/firstMove.ts` |
| **胜负** | 五连珠胜（标准）**或** 活四胜（4 连珠 + **两端均为棋盘内空格**） | `gomoku/rules.ts` |
| 边界算被堵 | 4 连珠靠墙 + 一端空格 → **不**算活四 → 不胜 | 同上 |
| 结束界面 | 数秒胜利动画 + 失败方"再接再厉"鼓励画面 | `VictoryOverlay.tsx` |

### 2.4 数据库 schema（Postgres / Supabase）

3 张表 + 1 个 RPC：

```sql
profiles (id ←auth.users.id, nickname, is_anonymous, ...)
matches  (id, game_type, status, player_a, player_b, player_a_nickname,
          player_b_nickname, start_hhmm, winner, result_reason,
          share_token unique, undo_used_a/b, ...)
moves    (match_id, ply, notation, data jsonb, primary key(match_id, ply))
```

**RLS 策略要点：**

- `profiles`：自己可写、人人可读（用于显示昵称）
- `matches`：参与者 / status='waiting' / status='finished' 可读；建房必须是房主；更新只参与者
- `moves`：人人可读（用于复盘 + 分享）；写入需 status='playing' + 是参与者

**`join_match(p_match_id, p_nickname)` RPC（SECURITY DEFINER）**：

由后加入者调用，原子化做三件事：
1. 校验房间存在、status='waiting'、不是加入自己的房间
2. 把 `player_b/player_b_nickname` 写入
3. 用服务器 UTC 当前时间计算 `start_hhmm` 写入

服务器算 HHMM 是为了**防止客户端自报开局时间**，保证两端用同一份数据决定执黑方。

### 2.5 Realtime 方案

用 Supabase Realtime 的 **Postgres Changes**（订阅表 INSERT/UPDATE），而非 broadcast：

- 订阅 `matches:id=eq.<id>`：UPDATE 时同步房间状态（玩家加入、status 变 finished 等）
- 订阅 `moves:match_id=eq.<id>`：INSERT 时把新走子追加到本地 history

好处：
1. 自带持久化（任何加入者都能拿到完整历史重放）
2. 不需要自建 WebSocket
3. RLS 同样作用于实时事件

迁移文件末尾 `alter publication supabase_realtime add table public.matches, public.moves;` 启用。

---

## 3. 今日完成项

| 阶段 | 状态 | 内容 |
|---|---|---|
| **Phase 0** 脚手架 | ✅ | Next.js + Tailwind + Supabase 客户端 + Vitest + Playwright |
| **Phase 1.1** 引擎抽象 | ✅ | `Game<S,M,Init>` 接口 |
| **Phase 1.2** 五子棋核心 | ✅ | 规则、活四/五连珠胜负、悔棋、π 定先手 |
| **Phase 1 UX** | ✅ | 走子记录面板、悬停预览、落子动画、音效（落子/胜利/失败）、静音持久化 |
| **Phase 2** 联机对战 MVP | ✅ | Supabase Auth（匿名）+ 建房/加入/Realtime/复盘 |
| **Phase 5** 部署 | ✅ | GitHub 推送 + Vercel 部署上线（https://jingling.vercel.app）+ Cron keepalive 防 Supabase 暂停 |
| **Phase 1.3** 中国象棋 | ⏳ | 未做 |
| **Phase 2** 联机配套 | ⏳ | 联机悔棋协商、投降、求和、计时未做 |
| **Phase 3** 我的对局/分享 | ⏳ | 未做 |
| **Phase 4** 残局/教学 | ⏳ | 未做 |

**测试覆盖**：`pnpm test:run` → **48/48 通过**

- 圆周率前 2400 位用 BigInt Machin 公式独立计算后交叉核对
- 活四在 4 个方向都验证，边界被堵的反例也覆盖
- 悔棋配额状态机
- HHMM 边界（0 / 1705 / 2359）

---

## 4. 遇到的问题与解决

按时间顺序，复盘的话能复用，避免再次踩坑。

### 4.1 工程脚手架类

#### 问题 1：`create-next-app` 拒绝大写目录名

**现象**：项目目录是 `/Users/liuling/Desktop/Jingling`，跑 `pnpm create next-app .` 报错：

```
Could not create a project called "Jingling" because of npm naming restrictions:
    * name can no longer contain capital letters
```

**原因**：npm 包名规范不允许大写字母，而 `create-next-app` 用目录基名做 `package.json` 的 name 字段。

**解决**：在 `/tmp/jingling-init` 用小写名创建，再 `rsync -a` 到目标目录，最后手动把 `package.json` 的 name 改成 `jingling`。

#### 问题 2：pnpm 11 要求 Node 22.13+

**现象**：`npm install -g pnpm` 装上的是 11.1.1，但本机 Node 是 22.2.0：

```
ERROR: This version of pnpm requires at least Node.js v22.13
```

**解决**：降到 `npm install -g pnpm@10`（pnpm 10.33.4 兼容 Node 22.2）。

#### 问题 3：Vitest 4 缺 darwin-arm64 原生二进制

**现象**：Vitest 4 用 rolldown 编译，pnpm 没自动装上 `@rolldown/binding-darwin-arm64`：

```
Cannot find native binding. ... 
Cannot find module '@rolldown/binding-darwin-arm64'
```

**原因**：pnpm 对 `optionalDependencies` 的平台检测在某些情况下失灵。

**解决**：降到 Vitest 3 + `@vitejs/plugin-react` 4，跳过 rolldown 依赖链。

#### 问题 4：Vite 7 与 Vitest 3 的 ESM/CJS 冲突

**现象**：装好 Vitest 3 后跑测试报：

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../vite/dist/node/index.js 
from .../vitest/dist/config.cjs not supported.
```

**原因**：Vitest 3 的 `dist/config.cjs` 用 `require()` 加载 vite 7（已是纯 ESM）。

**解决**：把 `vitest.config.ts` 改名为 `vitest.config.mts`，强制 Node 用 ESM 解析。

#### 问题 5：jsdom 29 在 Vitest 3 下崩溃

**现象**：

```
Error [ERR_REQUIRE_ESM]: require() of ES Module
  .../html-encoding-sniffer/lib/html-encoding-sniffer.js
```

**原因**：jsdom 29 的依赖 `html-encoding-sniffer` 6 是纯 ESM，但 Vitest 3 + 它的 sandbox 仍走 CJS。

**解决**：把 `jsdom` 替换为 `happy-dom`（更轻量、ESM 友好），同时 `vitest.config.mts` 的 `environment` 改为 `"happy-dom"`。

### 4.2 引擎实现类

#### 问题 6：圆周率小数位嵌入容易出错

**现象**：需要圆周率前 2400 位作为常量（HHMM 最大 2359）。凭记忆敲打容易在 1000 位之后出错。

**解决思路**：
1. 用 Node `BigInt` 跑 **Machin 公式**（`π = 16·arctan(1/5) - 4·arctan(1/239)`）生成 2400 位字符串
2. 写入 `pi-digits.ts` 作为常量
3. 同时在 `pi-digits.test.ts` 中再次独立计算并断言相等

这样即使将来误改了常量，测试也会立刻挂掉。

```bash
# 实际生成命令
node -e '...Machin formula...' > /tmp/pi-2400.txt
```

#### 问题 7：测试中"五连胜"被"活四"先触发

**现象**：构造"黑方水平五连"的测试时，每加一颗都触发活四胜，导致后续走子非法报错：

```
Error: 非法落子 (0, 3)
```

**原因**：黑下 (3,7) (4,7) (5,7) (6,7) 时已构成 _XXXX_，活四即胜，第 5 颗 (7,7) 还没下游戏就结束了。

**解决**：用"缺口填补"走法。黑：`(3,7)(4,7)(6,7)(7,7)` 跳着下，最后下 `(5,7)` 补中间形成五连；白棋散落在 2×2 角落避免任何 4 连：

```
黑：● ● _ ● ● → 然后补中间 → ● ● ● ● ●
白：放在 (0,0), (1,0), (0,1), (1,1) 散开
```

#### 问题 8：SSR 水合不一致

**现象**：`/gomoku` 页面用 `useState<LocalGame>(startLocalGame)`，而 `startLocalGame()` 内部 `new Date()`。Next.js 在服务端预渲染时调一次，客户端 hydrate 时再调一次，两次值不同 → 水合警告。

**解决**：初始状态设为 null，用 `useEffect(() => setGame(startLocalGame()), [])` 在 mount 后初始化。期间显示"加载棋盘…"占位。

#### 问题 9：TypeScript 检测到冗余条件

**现象**：

```ts
if (kind !== "ongoing" && prev === "ongoing" && kind !== "ongoing") {
//                                              ^^^^^^^^^^^^^^^^^^
//   Type error: This comparison appears to be unintentional
```

**原因**：第一个条件已经把 `kind` 收窄为 `"win" | "draw"`，第三个 `kind !== "ongoing"` 永真。

**解决**：删掉重复条件。

### 4.3 Supabase 集成类

#### 问题 10：Supabase 客户端泛型 Insert 类型推断失败

**现象**：

```
Type error: Object literal may only specify known properties, 
            and 'id' does not exist in type 'never[]'.
```

**原因**：自定义的 `Database` 类型缺 `Relationships`、`Views`、`Enums`、`CompositeTypes` 占位，Supabase 的 `from(...).insert(...)` 重载推断回退到 `never[]`。

**解决**：在 `src/lib/supabase/types.ts` 的 `Database` 类型里加上：

```ts
public: {
  Tables: {
    profiles: {
      Row: ...
      Insert: ...
      Update: ...
      Relationships: [];   // ← 关键
    };
    // ...
  };
  Views: Record<string, never>;
  Enums: Record<string, never>;
  CompositeTypes: Record<string, never>;
}
```

#### 问题 11：Supabase 默认禁用匿名登录

**现象**：用户点"创建房间"时报：

```
匿名登录失败：Anonymous sign-ins are disabled
```

**解决**：Supabase Dashboard → **Authentication → Providers (或 Sign In/Up Settings)** → 找 `Allow anonymous sign-ins` 开关，打开。

#### 问题 12：两个浏览器窗口 cookie 串号

**现象**：测试联机时第二个"隐身窗口"也显示了房主的身份，而不是被邀加入的访客身份。

**原因**：用户用的不是真正的隐身窗口（或浏览器对同名匿名会话共享 cookie）。

**解决**：用**完全不同的浏览器**测试（Chrome 与 Safari），cookie 物理隔离。或者完全关闭所有隐身窗口再开一个新的。

### 4.4 部署 / 网络类

#### 问题 13：GitHub SSH key 关联了另一个账号

**现象**：本地 SSH key 已配在 GitHub `carolin-angel23` 账号，但用户实际项目仓库在 `carolin-angel` 账号下：

```
ERROR: Permission to carolin-angel/Jingling.git denied to carolin-angel23.
```

**解决**：改用 HTTPS URL：

```bash
git remote remove origin
git remote add origin https://github.com/carolin-angel/Jingling.git
```

#### 问题 14：git push 走不通系统代理

**现象**：浏览器能访问 github.com，但 `git push` 报 `Failed to connect to github.com port 443 after 75003 ms`。

**原因**：macOS 系统代理（Clash 等）不会自动应用到 git 命令。

**解决**：

1. 找出 Clash 的实际 HTTP 端口（本机是 **7897**，非默认 7890）：
   ```bash
   for p in 7890 7891 7892 1087 8001 6152 9090 9091; do 
     nc -zv 127.0.0.1 $p 2>&1 | grep -i succeeded
   done
   ```
2. 给 git 配代理：
   ```bash
   git config --global http.proxy http://127.0.0.1:7897
   git config --global https.proxy http://127.0.0.1:7897
   ```

#### 问题 15：GitHub HTTPS 推送拒 PAT

**现象**：

```
remote: Permission to carolin-angel/Jingling.git denied to carolin-angel.
fatal: ... error 403
```

**原因**：用户已登录正确账号但 PAT 漏勾 `repo` scope。

**解决**：
1. 清掉 Keychain 里的旧凭据：
   ```bash
   printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
   ```
2. 到 https://github.com/settings/tokens/new 新建 PAT，**完整勾选 `repo` 大项**（会自动连子项一起勾）
3. 重试 `git push -u origin main`，输入用户名 + 粘新 PAT 作为密码

#### 问题 16：Vercel 环境变量 Key / Value 容易填反

**现象**：把 `sb_publishable_...` 直接填进了 Key 框，触发：

```
The name of your Environment Variable contains invalid characters. 
Only letters, digits, and underscores are allowed.
```

**原因**："Key" 在不同语境下含义不同——这里指**变量名**（如 `NEXT_PUBLIC_SUPABASE_ANON_KEY`），而不是 API key 的字符串值。

**解决方法**：
- **Key 框** 填变量名（字母+下划线，全大写习惯）
- **Value 框** 填实际值（URL 或 token 字符串）

#### 问题 17：Vercel 环境变量加完不 Redeploy 不生效

**现象**：在 Vercel Dashboard 加完 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，但访问 `jingling.vercel.app/play` 仍然报：

```
@supabase/ssr: Your project's URL and API key are required to create a Supabase client!
```

**原因**：Next.js 把 `NEXT_PUBLIC_*` 变量在 **build 时** 内联到客户端 bundle。环境变量加在 build 之后，不会自动生效。

**解决**：
- Vercel Dashboard → **Deployments** 标签 → 最新部署 → **`···` → Redeploy**
- 弹窗里**不要勾** "Use existing Build Cache"（强制使用新环境变量重建）
- 或者 push 一个新 commit 触发自动 redeploy

### 4.5 部署 / 运维类

#### 问题 18：Supabase Free 项目 7 天无活动自动暂停

**现象**：Free tier 项目连续 7 天没有 API 调用，Supabase 会暂停数据库（数据不丢，但首次访问要等几秒唤醒，期间 API 调用会失败）。

**原因**：Supabase 官方为 Free tier 节省资源的策略。

**解决**：用 Vercel Cron 每天自动 ping 一次：

1. 新建 `src/app/api/keepalive/route.ts`：
   ```ts
   export const runtime = "edge";
   export const dynamic = "force-dynamic";

   export async function GET() {
     const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
     const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
     const res = await fetch(`${url}/rest/v1/matches?select=id&limit=1`, {
       headers: { apikey: key, Authorization: `Bearer ${key}` },
       cache: "no-store",
     });
     return Response.json({ ok: res.ok, pingedAt: new Date().toISOString() });
   }
   ```

2. 项目根目录 `vercel.json`：
   ```json
   {
     "crons": [{ "path": "/api/keepalive", "schedule": "0 9 * * *" }]
   }
   ```

3. Push → Vercel 自动接管 cron。每天 UTC 9 点（北京 17 点）触发一次极简查询，重置 Supabase 计时器。

**验证**：
- Vercel Dashboard → Settings → Cron Jobs 应看到 Active 记录
- 浏览器直接访问 `https://jingling.vercel.app/api/keepalive` 应返回 `{"ok":true, ...}`

### 4.6 其他

#### 问题 19：`.env.example` 被 gitignore 屏蔽

**现象**：`.gitignore` 里 `.env*` 把模板文件也排除了。

**解决**：加 `!.env.example` 例外：

```gitignore
.env*
!.env.example
```

#### 问题 20：活四自动判胜忽略对方"下一步即五连"威胁（实战发现）

**现象**（2026-05-14 实战）：

```
对方走出冲四：X X X X _  （4 连，一端空一端被堵）
        本来对方下一步走开口处就 5 连胜
己方走出活四：O O O O    （4 连，两端均空）
        系统自动判己方胜 ← bug，应该是对方下一步走 5 连先赢
```

**原因**：原 `detectWin` 实现里，活四（两端均空的 4 连）无条件触发"open_four"自动胜。
但实际上，活四能赢的逻辑前提是：**对手在自己回合内做出反应时无法直接获胜**。
如果对手有冲四（XXXX_）或跳四（XX_XX、X_XXX），他/她下一手可以直接形成 5 连，
活四就不该判胜，应让对手用威胁先胜。

**解决**：`src/lib/game-engine/gomoku/rules.ts` 的 `detectWin` 加一层检查：

```ts
if (activeFour && !opponentCanMakeFiveNextMove(board, opponent)) {
  return activeFour;
}
return null;
```

`opponentCanMakeFiveNextMove(board, opponent)` 遍历所有空格，模拟对方落子，
看是否任一处能直接形成 5 连（涵盖冲四、跳四、各种"四子缺一即五"形态）。

**新增测试覆盖**（`rules.test.ts`）：

- 己方活四 + 对方冲四 → 不判胜
- 己方活四 + 对方跳四 → 不判胜
- 己方活四 + 对方只有三连 → 仍判胜
- 己方活四 + 对方四子被两头堵 → 仍判胜
- 己方五连 + 对方冲四同时存在 → 五连优先获胜

测试总数从 48 增至 **53**，全部通过。

---

## 5. 当前进度与下一步

### 5.1 已部署 ✅

- 代码托管：https://github.com/carolin-angel/Jingling
- 线上访问：**https://jingling.vercel.app**
- Vercel Cron 已配，每天自动 ping Supabase 防暂停

### 5.2 建议的下一步选项

按价值优先级：

1. **中国象棋实现**（Phase 1.3）
   - 复用 `Game` 接口和 `MatchClient` 联机框架
   - 难点：7 种棋子走法、将军/将死/困毙/和棋、将帅照面
   - 工作量：1-2 周

2. **联机功能补丁**（Phase 2 收尾）
   - 联机悔棋协商（一方提 → 另一方同意/拒绝的 broadcast 流）
   - 投降 / 求和 / 超时
   - 计时器
   - 工作量：3-5 天

3. **我的对局列表 + 公开分享页**（Phase 3）
   - `/play/history` 个人对局历史
   - `/share/<token>` 公开复盘
   - 工作量：3-5 天

4. **残局/教学模式**（Phase 4）
   - 题库 JSON
   - 引导式答题
   - 工作量：1 周

5. **打磨**（Phase 5 收尾）
   - 移动端适配
   - 暗色模式优化
   - 国际化（按需）

### 5.3 关键账号 / 链接

| 服务 | 链接 / 标识 |
|---|---|
| GitHub | https://github.com/carolin-angel/Jingling |
| Supabase 项目 | https://falfhsmugkqwvfqoskmw.supabase.co |
| Vercel 项目 | https://vercel.com/carolin-angels-projects/jingling |
| 线上站点 | https://jingling.vercel.app |

> ⚠️ Supabase service_role key 不要泄露；PAT 也建议在不需要时撤销（https://github.com/settings/tokens）。

### 5.4 运维成本与国内访问

**当前 0 成本**：

| 服务 | 层级 | 用量上限 | 当前用量 |
|---|---|---|---|
| Vercel Hobby | 免费 | 100 GB 带宽/月、100k 函数调用、2 个 Cron Job | 远未触及 |
| Supabase Free | 免费 | 500 MB DB、5 GB 带宽、200 并发 Realtime、50k MAU | 远未触及 |
| GitHub | 免费 | 私有/公开仓库均免费 | — |

**国内访问情况**：

| 服务 | 国内裸连 |
|---|---|
| `*.vercel.app` | 部分时段/部分运营商可达，不稳定，速度一般 |
| `*.supabase.co` API | 通常能连，延迟 200-500ms |
| Supabase Realtime WebSocket | 不稳定，可能被中间设备干扰 |

**当前结论**：挂 VPN 体验完全流畅；裸连可勉强用但有掉线风险。

**如果想完全国内可达**（不推荐除非有大量国内用户）：

| 路径 | 月成本估算 | 工作量 |
|---|---|---|
| 自定义域名 + Cloudflare 代理 | ¥50/年 域名 | 1-2 小时 |
| 自定义域名 + 备案 + 国内 CDN 回源 Vercel | ¥50/年 + ICP 备案（2-4 周） | 1-2 天 |
| 完全迁国内云（阿里云/腾讯云）+ 自建 PG/WS | ¥150-300/月 | **重写 Auth + Realtime 层，约 1-2 周** |

**建议保持现状**，因为整套架构（匿名 Auth、Postgres RLS、Realtime broadcast）与 Supabase 深度耦合，迁国内的工作量约等于已建工作量的一倍。等真有 50+ 日活国内用户再考虑。

---

## 6. 开发常用命令

```bash
# 本地起服务
pnpm dev                          # http://localhost:3000

# 跑单元测试（48 个）
pnpm test:run                     # 单次跑
pnpm test                         # watch 模式

# 类型检查 + 生产构建
pnpm build

# 跑生产产物
pnpm start

# 重新生成圆周率常量
node -e '...Machin formula...' > /tmp/pi-2400.txt
```

---

## 7. 关键设计决策回顾

1. **匿名 Auth + 可选邮箱绑定**：访客自动获得 Supabase 匿名账号，RLS 一次定型，后期升级邮箱不重构
2. **走子序列存表，不存快照**：体积小，客户端 `applyMove` 重放即可还原任意时刻
3. **HHMM 服务器计算**：联机时由 `join_match` RPC 用 `now() at UTC` 计算，杜绝客户端篡改
4. **Postgres Changes 而非 broadcast**：自带持久化和重放，无需自建 WebSocket
5. **圆周率常量嵌入 + 测试时独立 Machin 校验**：保证 2400 位数字正确
6. **活四即胜的"两端均空"严格定义 + 对方无即胜威胁先决条件**：边界算被堵（标准活四定义）；2026-05-14 修复"忽略对方冲四"的实战 bug，活四只有在对手没有"下一步即 5 连"的威胁时才自动判胜
7. **抽象 `Game<S,M>` 接口先行**：两款游戏并行开发的基础
8. **Vercel Cron + 极简 keepalive 路由**：用 Vercel Hobby 自带的免费 Cron 每天 ping 一次 Supabase，防 Free tier 7 天无活动暂停。零成本零运维。

---

_最后更新：2026-05-14_
