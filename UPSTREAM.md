# Vben 上游来源

DogX Web 以源码快照方式使用 Vben，不保留 Vben 的 Git 历史，也不自动合并上游代码。

- 仓库：<https://github.com/vbenjs/vue-vben-admin>
- Tag：`v5.7.0`
- Commit：`63a38dce49ba109f61607994e21ba921d8e970e9`
- 导入日期：`2026-08-27`
- 使用应用：`apps/web-naive`

同步新版本时，优先检查以下范围，再按 DogX 的实际需要手工移植：

1. `apps/web-naive`
2. `packages/@core`
3. `packages/effects`
4. `packages/preferences`、`packages/stores`、`packages/styles`
5. `internal`

同步上游修改后，应重新安装依赖并执行类型检查、静态检查和单元测试。
