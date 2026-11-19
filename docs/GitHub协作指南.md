# 两人共用 GitHub 仓库

仓库创建者在 GitHub 仓库的 Settings → Collaborators 中添加队友的 GitHub 用户名，队友接受邀请后即可推送分支。建议先使用私有仓库。

## 队友开始开发

在仓库页面点击 Code，复制 HTTPS 地址，替换以下示例中的地址：

```powershell
git clone <仓库HTTPS地址>
cd <下载的仓库目录>
git switch -c feat/plan-verifier
pnpm install --frozen-lockfile
Copy-Item .env.example .env.local
```

队友按 [队员开发任务](队员开发任务.md) 实现三个指定文件。该模块是纯函数，开发与运行其测试不需要填写真实模型密钥。

```powershell
node --experimental-strip-types --test tests/plan-verifier.test.mjs
git add src/lib/agents/plan-verifier.ts tests/plan-verifier.test.mjs docs/核验模块说明.md
git commit -m "实现计划核验模块"
git push -u origin feat/plan-verifier
```

在 GitHub 点击 Compare & pull request，目标分支选 `main`。在说明中写清改动内容、实际运行的测试及结果，检查通过后合并。主开发也使用单独分支提交模型、编排和页面改动。

## 同步最新版本

先提交当前分支中需要保留的改动，再切回主分支更新：

```powershell
git switch main
git pull --ff-only
```

新任务从更新后的 `main` 创建新分支。若出现冲突，保留双方需要的修改并重新运行测试；不要强制覆盖远端分支。

## 配置约定

- `.env.example` 只放字段和空值；每人自己配置 `.env.local`，不通过仓库或聊天转发密钥。
- 不上传 `node_modules`、`.next`、导出归档或个人原始资料。
- 共同类型需要调整时先沟通，再同时更新调用方、核验器和样例。
- 仓库未附开源许可证，是否公开及采用何种许可证由团队另行决定。
