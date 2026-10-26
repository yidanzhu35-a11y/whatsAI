# 大模型训练互动导览

一个面向中学生及以上读者的中文科普网页。它用浏览器内运行的微型字符模型，展示数据整理、单步参数更新、重复训练、损失曲线、检查点和推断；后训练、多模态等分支会明确标出教学模拟。网页运行与训练都不需要 API 密钥。

## 在新电脑上开始

安装 Node.js 22 和 Git，然后运行：

```bash
git clone https://github.com/yidanzhu35-a11y/whatsAI.git
cd whatsAI
npm ci
npm run dev
```

在终端显示的本地地址打开网页。每次开始工作前执行 `git pull`；修改完成后执行 `git add .`、`git commit -m "说明修改内容"` 和 `git push`。另一台电脑再执行 `git pull` 即可取得更新。两台电脑同时修改同一文件时，Git 可能要求先解决冲突。

## 验证与导出

```bash
npm run build
npm test
node scripts/export-standalone.mjs
```

构建结果在 `dist/`，独立 HTML 会生成在项目文件夹的上一级，文件名为 `model-training-tour.html`。这份 HTML 内置网页代码与教学数据，便于直接分享；浏览器打开网页时仍会像所有网页一样把这些内容加载到访问者本机。模型计算在访问者的浏览器里完成，不消耗仓库拥有者的 API 额度。

`src/` 是网页源码，`src/model.js` 是微型模型及训练计算，`tests/` 是计算和构建验证。`worker/` 与 `.openai/hosting.json` 是可选的 Sites 部署配置。`node_modules/`、`dist/` 等本机生成内容不会提交到 Git。

本项目的微型模型用于解释训练机制，并不等于真实大语言模型的规模或架构。页面会区分实际计算的数值和为了教学展示的模拟步骤。
