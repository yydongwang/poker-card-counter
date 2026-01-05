# 🃏 poker-card-counter

一个基于 **计算机视觉（Computer Vision）** 的扑克记牌器，  
使用 **Node.js 调用 OpenCV**，通过模板匹配从截图中识别扑克牌，并在一局游戏内统计剩余牌数。

---

## ✨ 项目简介

本项目通过 **OpenCV 模板匹配** 的方式，从游戏截图中识别扑克牌，
结合 **非极大值抑制（NMS）** 去除重复识别结果，
并在一局游戏内维护已识别牌的状态，从而实现记牌与剩余牌数统计。

特点：

- 仅处理截图图像，不侵入游戏进程
- 无需训练模型，结果稳定、可调试
- 支持多分辨率截图
- 适合工程实践与计算机视觉学习

---

## 📁 目录结构

```text
poker-card-counter
├── src
│   ├── core
│   │   └── cardCounter.js      # 核心识别与记牌逻辑
│   ├── utils.JS                  # 工具方法（缩放 / NMS 等）
│   └── index.js               # 启动入口
│
├── templates                  # 扑克牌模板（png）
├── screenshots                # 测试截图目录
│
├── package.json
├── README.md
└── LICENSE
```

## ⚙️ 环境要求

### Node.js

建议版本：

```text
Node.js >= 16
```

---

### OpenCV

本项目依赖本机 OpenCV 环境，请 **先安装 OpenCV**。

---

## 📦 安装依赖

在项目根目录执行：

```bash
npm install
```

依赖说明：

* `@u4/opencv4nodejs`：Node.js 调用 OpenCV 的绑定库安装，具体安装方式可看此仓库文档https://github.com/UrielCh/opencv4nodejs

---

## 🃏 模板准备说明

模板位于 `templates/` 目录，命名规则如下：

```text
花色_牌面.png
```

示例：

```text
hongxin_a.png
heitao_10.png
meihua_3.png
```

支持花色示例：

* fangkuai（方块）
* heitao（黑桃）
* hongxin（红心）
* meihua（梅花）

---

## 🚀 启动项目

### 1️⃣ 准备截图

将待识别的截图放入：

```text
screenshots/
```

支持格式：

* `.png`

---

### 2️⃣ 启动程序

```bash
npm run start
```

程序将自动：

1. 预加载所有模板

2. 初始化牌库

3. 遍历 `screenshots` 目录

4. 执行识别并输出剩余牌数

5. （可选）生成带标注的识别结果图在test_results文件夹下

   如图：

   ![](https://github.com/yydongwang/poker-card-counter/blob/main/test_results/result_2026-01-05T03-44-08-374Z.jpg)

   ![](https://github.com/yydongwang/poker-card-counter/blob/main/test_results/result_2026-01-05T03-44-09-303Z.jpg)

---

## 🧪 运行示例输出

```text
📦 模板预加载完成：54 张
游戏开始
总耗时: 132ms
Map(13) {
  'A' => 2,
  'K' => 3,
  'Q' => 4,
  ...
}
```

## 📌 后续规划

- Electron 实时截图接入

- 多窗口支持

- 记牌策略模块化

- 规则配置外置化

- 性能进一步优化

  
## 交流
qq交流群：620398052