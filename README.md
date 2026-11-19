# 仲恺校园百事通

从 Coze 导出并改造的校园智能助手，支持独立运行。使用 Next.js 16、React 19、TypeScript 和 shadcn/ui；模型通过服务端兼容 Chat Completions 的接口调用。

## 已有功能

- 校园首页、三个聊天人设、流式回答。
- 23 个本地知识模块及关键词检索。
- 海珠、白云校区地点、地图展示与天气查询。
- 通用模型接入、消息长度校验、超时及取消处理。

多智能体任务编排、计划核验和修正循环仍待开发。三个聊天人设不代表已经完成多智能体协作。

## 本机启动

准备 Node.js 22.18+ 或 24，以及 pnpm 9+。仅使用 pnpm 管理依赖。

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

在本机 `.env.local` 填写 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY`，模型名称和权限以服务商控制台为准，然后启动：

```powershell
pnpm dev
```

打开 <http://127.0.0.1:5000>。未配置真实模型时可查看页面，聊天会提示配置缺失。修改配置后需重启应用。

地图为可选功能：填写高德 Web JS 的 `NEXT_PUBLIC_AMAP_KEY` 和 `NEXT_PUBLIC_AMAP_SECURITY_CODE`，并在高德控制台配置域名限制。这两项会进入浏览器；模型密钥仅保留在服务端。地图配置留空时显示“地图暂不可用”。

## 构建与验证

```powershell
pnpm test:model
pnpm ts-check
pnpm build
pnpm start
```

开发和生产启动默认只监听本机地址。公网部署前还需增加用户认证、调用配额与限流。真实模型、地图授权和天气服务需使用各自账号继续联调。

## 协作

双方共用一个私有 GitHub 仓库，在各自分支开发并通过 Pull Request 合并。

- [GitHub 协作步骤](docs/GitHub协作指南.md)
- [队员开发任务](docs/队员开发任务.md)：独立实现计划核验模块。
- [共享类型](src/lib/agents/plan-contract.ts)与[输入输出样例](docs/计划核验接口样例.json)。
- [详细配置与已有验证](开始使用.md)。

请保留 `.env.local` 在自己电脑中，不上传密钥、依赖目录或构建缓存。源码中的原有知识资料仍需在参赛前核对来源、时效和使用范围。

## 主要目录

```text
src/app/               页面与聊天 API
src/components/        页面组件与地图
src/data/knowledge/    校园知识模块
src/lib/               模型、检索及共享接口
tests/                 自动测试
docs/                  分工、协作与接口说明
public/                静态资源
```
