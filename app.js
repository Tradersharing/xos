// === Constants & Setup ===
let provider, signer, userAddress;
let activeSelectionType = null;

// Chain & Network Params
const CHAIN_ID_HEX = "0x4F3";
const XOS_PARAMS = {
  chainId: CHAIN_ID_HEX,
  chainName: "XOS Testnet",
  nativeCurrency: { name: "XOS", symbol: "XOS", decimals: 18 },
  rpcUrls: ["https://testnet-rpc.xoscan.io"],
  blockExplorerUrls: ["https://testnet.xoscan.io"]
};

// Contract Addresses
const routerAddress = "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151";
const factoryAddress = "0x122D9a2B9D5117377F6b123a727D08A99D4d24b8";

// Minimal ABIs
const routerAbi = [
  "function getAmountsOut(uint,address[]) view returns(uint[])",
  "function swapExactTokensForTokens(uint,uint,address[],address,uint) external returns(uint[])",
  "function swapExactETHForTokens(uint,address[],address,uint) payable external returns(uint[])",
  "function swapExactTokensForETH(uint,uint,address[],address,uint) external returns(uint[])",
  "function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns(uint,uint,uint)"
];
const factoryAbi = [
  "function getPair(address,address) view returns(address)",
  "function createPair(address,address) returns(address)"
];
const lpAbi = ["function mint(address) returns(uint)"];

// Token List
const tokenList = [
  { address: "native", symbol: "XOS", decimals: 18 },
  { address: "0x0AAB67cf6F2e99847b9A95DeC950B250D648c1BB", symbol: "wXOS", decimals: 18 },
  { address: "0x2CCDB83a043A32898496c1030880Eb2cB977CAbc", symbol: "USDT", decimals: 6 },
  { address: "0xb2C1C007421f0Eb5f4B3b3F38723C309Bb208d7d", symbol: "USDC", decimals: 6 },
  { address: "0xb129536147c0CA420490d6b68d5bb69D7Bc2c151", symbol: "Tswap", decimals: 18 }
];

// Contracts
let routerContract, factoryContract;
let tokenSelector;

// Selected tokens
let selectedSwapIn = null;
let selectedSwapOut = null;
let selectedLiquidityIn = null;
let selectedLiquidityOut = null;

// === Initialization ===
document.addEventListener("DOMContentLoaded", async () => {
  // Connect Wallet button
  const btnConnect = document.getElementById("btnConnect");
  if (btnConnect) {
    btnConnect.disabled = false;
    btnConnect.addEventListener("click", async () => {
      if (!window.ethereum) return alert("MetaMask tidak ditemukan.");
      try { await connectWallet(); } catch(e){ console.error(e); }
    });
  }
  if (!window.ethereum) return alert("MetaMask belum terpasang.");

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();
  routerContract = new ethers.Contract(routerAddress, routerAbi, signer);
  factoryContract = new ethers.Contract(factoryAddress, factoryAbi, signer);
  tokenSelector = document.getElementById("tokenSelector");

  await ensureCorrectChain();
  await tryAutoConnect();

  // Event listeners
  document.getElementById("tokenInBtn")?.addEventListener("click", () => openTokenSelector("swapIn"));
  document.getElementById("tokenOutBtn")?.addEventListener("click", () => openTokenSelector("swapOut"));
  document.getElementById("liquidityTokenInBtn")?.addEventListener("click", () => openTokenSelector("liqIn"));
  document.getElementById("liquidityTokenOutBtn")?.addEventListener("click", () => openTokenSelector("liqOut"));

  document.getElementById("amount")?.addEventListener("input", updateSwapPreview);
  document.getElementById("btnSwap")?.addEventListener("click", doSwap);
  document.getElementById("btnAddLiquidity")?.addEventListener("click", addLiquidity);

  document.querySelectorAll(".tab-bar button").forEach(btn => btn.addEventListener("click", () => switchPage(btn)));
  window.addEventListener("click", e => { if(e.target===tokenSelector) tokenSelector.classList.add("hidden"); });

  populateTokenDropdowns();
  // Default selection
  selectedSwapIn = tokenList.find(t=>t.symbol==="USDT");
  selectedSwapOut = tokenList.find(t=>t.symbol==="TSWAP");
  selectedLiquidityIn = selectedSwapIn;
  selectedLiquidityOut = selectedSwapOut;
  updateSelectionUI(selectedSwapIn);
  updateSelectionUI(selectedSwapOut);
  updateSelectionUI(selectedLiquidityIn);
  updateSelectionUI(selectedLiquidityOut);

  window.ethereum.on("accountsChanged",accounts=>{ if(accounts.length){ userAddress=accounts[0]; updateWalletUI(); updateAllBalances(); } else resetUI(); });
  window.ethereum.on("chainChanged",()=>location.reload());
});

async function ensureCorrectChain(){ if(!window.ethereum) return; const chainId=await window.ethereum.request({method:'eth_chainId'}); if(chainId!==CHAIN_ID_HEX){ try{await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:CHAIN_ID_HEX}]});}catch(e){if(e.code===4902){await window.ethereum.request({method:'wallet_addEthereumChain',params:[XOS_PARAMS]});}else console.error(e);} }}
async function tryAutoConnect(){ if(!window.ethereum) return; try{const accounts=await provider.send("eth_accounts",[]); if(accounts.length){userAddress=accounts[0]; signer=await provider.getSigner(); updateWalletUI(); updateAllBalances();}}catch(e){console.error(e);}}
async function connectWallet(){try{const accounts=await provider.send("eth_requestAccounts",[]);if(accounts.length){userAddress=accounts[0]; signer=await provider.getSigner(); updateWalletUI(); updateAllBalances();}}catch(e){console.error(e);}}
function updateWalletUI(){const st=document.getElementById("walletStatus");if(st)st.innerText=`Connected: ${shortenAddress(userAddress)}`;const btn=document.getElementById("btnConnect");if(btn){btn.innerText="Connected";btn.disabled=true;}["stakingBtn","faucetBtn","lpBtn"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=false;});["btnSwap","btnAddLiquidity"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=false;});}
function resetUI(){userAddress=null;const st=document.getElementById("walletStatus");if(st)st.innerText="Not connected";const btn=document.getElementById("btnConnect");if(btn){btn.innerText="Connect Wallet";btn.disabled=false;}["stakingBtn","faucetBtn","lpBtn","btnSwap","btnAddLiquidity"].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=true;});}
function shortenAddress(a){return a.slice(0,6)+"..."+a.slice(-4);} 
function openTokenSelector(type){activeSelectionType=type;tokenSelector.classList.remove("hidden");tokenSelector.style.display="flex";}function closeTokenSelector(){tokenSelector.classList.add("hidden");tokenSelector.style.display="none";}
function populateTokenDropdowns(){const list=document.getElementById("tokenList");if(!list) return;list.innerHTML="";tokenList.forEach(tok=>{const div=document.createElement("div");div.className="token-item";div.dataset.address=tok.address;div.dataset.symbol=tok.symbol;div.innerHTML=`<div class='token-balance' id='bal-${tok.symbol}'>⏳</div><div class='token-symbol'>${tok.symbol}</div>`;div.onclick=()=>selectToken(tok);list.appendChild(div);getBalance(tok).then(b=>{const e=document.getElementById(`bal-${tok.symbol}`);if(e)e.innerText=`Balance: ${b}`;});});}
async function getBalance(tok){if(!userAddress) return"0.00";if(tok.address==="native"){const b=await provider.getBalance(userAddress);return parseFloat(ethers.formatEther(b)).toFixed(4);}const c=new ethers.Contract(tok.address,["function balanceOf(address) view returns(uint256)","function decimals() view returns(uint8)"],provider);const[raw,dec]=await Promise.all([c.balanceOf(userAddress),c.decimals()]);return parseFloat(ethers.formatUnits(raw,dec)).toFixed(4);}  
function selectToken(tok){if((activeSelectionType==="swapIn"&&selectedSwapOut?.symbol===tok.symbol)||(activeSelectionType==="swapOut"&&selectedSwapIn?.symbol===tok.symbol))return alert("Token sudah dipilih di sisi lain.");if(activeSelectionType==="swapIn")selectedSwapIn=tok;if(activeSelectionType==="swapOut")selectedSwapOut=tok;if(activeSelectionType==="liqIn")selectedLiquidityIn=tok;if(activeSelectionType==="liqOut")selectedLiquidityOut=tok;updateSelectionUI(tok);closeTokenSelector();}
function updateSelectionUI(tok){const map={swapIn:{btn:"tokenInBtn",bal:"tokenInBalance"},swapOut:{btn:"tokenOutBtn",bal:"tokenOutBalance"},liqIn:{btn:"liquidityTokenInBtn",bal:"liquidityTokenInBalance"},liqOut:{btn:"liquidityTokenOutBtn",bal:"liquidityTokenOutBalance"}};const ids=map[activeSelectionType];const btn=document.getElementById(ids.btn);getBalance(tok).then(bal=>{btn.innerHTML=`<div class='token-balance-display'>Balance: ${bal}</div><div class='token-symbol'>${tok.symbol}</div>`;const el=document.getElementById(ids.bal);if(el)el.innerText=`Balance: ${bal}`;});}
async function updateSwapPreview(){const inE=document.getElementById("amount"),outE=document.getElementById("amountOut");if(!selectedSwapIn||!selectedSwapOut)return;const val=inE.value;if(!val||isNaN(val))return outE.value="";const inW=ethers.parseUnits(val,selectedSwapIn.decimals);try{const am=await routerContract.getAmountsOut(inW,[selectedSwapIn.address,selectedSwapOut.address]);outE.value=ethers.formatUnits(am[1],selectedSwapOut.decimals);}catch(e){outE.value="";console.error(e);}}  
async function doSwap(){try{if(!selectedSwapIn||!selectedSwapOut)return alert("Pilih token swap in/out");const val=document.getElementById("amount").value;if(!val||isNaN(val))return alert("Isi jumlah yang valid");const inW=ethers.parseUnits(val,selectedSwapIn.decimals);const bal=await getBalance(selectedSwapIn);if(parseFloat(val)>parseFloat(bal))return alert("Jumlah melebihi saldo");if(selectedSwapIn.address!="native")await new ethers.Contract(selectedSwapIn.address,["function approve(address,uint256) returns(bool)"],signer).approve(routerAddress,inW);const tx=await routerContract.swapExactTokensForTokens(inW,0,[selectedSwapIn.address,selectedSwapOut.address],userAddress,Math.floor(Date.now()/1000)+600);await tx.wait();alert("Swap sukses");updateAllBalances();}catch(e){console.error(e);alert("Swap gagal: "+e.message);}}  
async function addLiquidity(){try{if(!selectedLiquidityIn||!selectedLiquidityOut)return alert("Pilih token liquidity A/B");let aV=document.getElementById("liquidity」
}]}
