const { ethers } = require("hardhat");
const throttle = require('lodash.throttle') //安装throttle：npm install lodash.throttle
//wss://eth-mainnet.g.alchemy.com/v2/AXk8ifAkCTMh3R4QaKveR 
const ALCHEMY_MAINNET_WSSURL = 'wss://eth-mainnet.g.alchemy.com/v2/AXk8ifAkCTMh3R4QaKveR';
const provider = new ethers.WebSocketProvider(ALCHEMY_MAINNET_WSSURL);
//判断交易是否值得进行三明治攻击uniswapv2:
function simulateSwap(x, y, dx) {
  const newY = (x * y) / (x + dx);
  const dy = y - newY;
  return { dy, newX: x + dx, newY };
}

function isProfitableSandwich(pool, victimIn, attackerIn, gasCost) {
  const { x, y } = pool;

  // 1. attacker frontrun
  const front = simulateSwap(x, y, attackerIn);

  // 2. victim after attacker
  const victim = simulateSwap(front.newX, front.newY, victimIn);

  // 3. attacker backrun (sell)
  const back = simulateSwap(
    victim.newX,
    victim.newY,
    front.dy // attacker received WETH
  );

  const attackerOut = back.dy;

  const profit = attackerOut - attackerIn - gasCost;

  return { profit, attackerOut, front, victim, back };
}
//调用isProfitableSandwich：
// const res = isProfitableSandwich(
//   { x, y },                 // pool reserves
//   victimAmountIn,           // victim Δx
//   ethers.parseUnits("10"),  // attacker small frontrun
//   gasCost
// );

// if (res.profit > 0n) {
//   console.log("值得三明治攻击，利润:", res.profit.toString());
// }
const iface = new ethers.Interface([
    "function transfer(address, uint) public returns (bool)",
])
function handleBigInt(key, value) {
    if (typeof value === "bigint") {
        return value.toString() + "n"; // or simply return value.toString();
    }
    return value;
}
const selector = iface.getFunction("transfer").selector
async function main() {
    let j = 0
    provider.on("pending", throttle(async (txHash) => {
        if (txHash && j <= 100) {
            // 获取tx详情
            let tx = await provider.getTransaction(txHash);
            j++;
            if (tx !== null && tx.data.indexOf(selector) !== -1) {
                console.log(`[${(new Date).toLocaleTimeString()}]监听到第${j + 1}个pending交易:${txHash}`)
                console.log(`打印解码交易详情:${JSON.stringify(iface.parseTransaction(tx), handleBigInt, 2)}`)
                console.log(`转账目标地址:${iface.parseTransaction(tx).args[0]}`)
                console.log(`转账金额:${ethers.formatEther(iface.parseTransaction(tx).args[1])}`)
                provider.removeListener('pending', this)
            }

        }
    }, 1000));
}

main().catch(console.error);

//npx hardhat run scripts/sandwich_simulation.js
