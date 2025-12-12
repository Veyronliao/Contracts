import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const WS_URL = process.env.MAINNET_WS;
if (!WS_URL) throw new Error("请配置 MAINNET_WS");

const provider = new ethers.WebSocketProvider(WS_URL);

// Uniswap V2 Router
const ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

// 只解析 swap 相关方法
const routerAbi = [
  "function swapExactETHForTokens(uint amountOutMin,address[] path,address to,uint deadline)",
  "function swapExactTokensForETH(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline)",
  "function swapExactTokensForTokens(uint amountIn,uint amountOutMin,address[] path,address to,uint deadline)",
  "function swapETHForExactTokens(uint amountOut,address[] path,address to,uint deadline)"
];

const iface = new ethers.Interface(routerAbi);

console.log("✅ 正在监听以太坊主网真实 mempool...");
console.log("节点:", WS_URL);

provider.on("pending", async (txHash) => {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx || !tx.to || !tx.data) return;

    // 只监听 Uniswap Router
    if (tx.to.toLowerCase() !== ROUTER.toLowerCase()) return;

    let parsed;

    try {
      parsed = iface.parseTransaction({
        data: tx.data,
        value: tx.value
      });
    } catch {
      return; // 非 swap 交易直接忽略
    }

    const method = parsed.name;
    const args = parsed.args;

    console.log("\n🔥 Pending Swap 交易捕获:");
    console.log("TX:", tx.hash);
    console.log("From:", tx.from);
    console.log("Method:", method);
    console.log("Gas Price:", tx.gasPrice?.toString());
    console.log("Value:", ethers.formatEther(tx.value));

    // 解析 path
    let path;
    if (method === "swapExactETHForTokens" || method === "swapETHForExactTokens") {
      path = args[1];
    } else {
      path = args[2];
    }
    

    console.log("Path:", path.join(" -> "));

  } catch (err) {
    console.log("监听错误:", err.message);
  }
});

provider._websocket.on("close", () => {
  console.error("WebSocket 断开，正在退出...");
  process.exit(1);
});

///主网真实 mempool 监听
///监听 mempool → 捕获 pending tx → 解码 → 判断是否为 swap → 分析滑点 → 判断池子流动性 → 估算价格冲击 → 标记目标

//运行：node mainnet_mempool_listener.js
