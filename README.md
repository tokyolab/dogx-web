# DogX Web

DogX 的 PC 管理后台前端，基于 Vue、Vben5 和 Naive UI。

## 环境要求

- Node.js 22.18.0 及以上的 22.x，或 Node.js 24.x
- pnpm 10.x

## 本地启动

```bash
corepack enable
pnpm install
pnpm dev
```

默认开发端口为 `5888`。当前保留 Vben 的本地 Mock 服务用于验证基础界面，后续接入 DogX 后端后移除。

临时 Mock 账号：`admin`，密码：`123456`。

图标采用本地白名单，不在运行时请求 Iconify 公共 API。新增图标时，需要在 `apps/web-naive/src/icons/index.ts` 中导入并注册。

## 上游来源

Vben 上游版本及同步方式见 [UPSTREAM.md](./UPSTREAM.md)。第三方许可声明位于 `THIRD_PARTY_NOTICES`。
