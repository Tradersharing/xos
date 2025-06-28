
let provider, signer, user;
async function connectWallet() {
  if (!window.ethereum) return alert("Install MetaMask!");
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  user = await signer.getAddress();
  document.getElementById("walletStatus").innerText = "Connected: " + user.slice(0, 6) + "...";
}
async function doSwap() {
  const tokenIn = document.getElementById("tokenIn").value;
  const tokenOut = document.getElementById("tokenOut").value;
  const amount = ethers.parseUnits(document.getElementById("amount").value, 18);
  const routerAddress = "0x778dBa0703801c4212dB2715b3a7b9c6D42Cf703";
  const routerABI = [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory)"
  ];
  const tokenABI = ["function approve(address spender, uint amount) external returns (bool)"];
  const token = new ethers.Contract(tokenIn, tokenABI, signer);
  await token.approve(routerAddress, amount);
  const router = new ethers.Contract(routerAddress, routerABI, signer);
  const path = [tokenIn, tokenOut];
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
  const tx = await router.swapExactTokensForTokens(amount, 0, path, user, deadline);
  await tx.wait();
  document.getElementById("result").innerText = "✅ Swap Success!";
}
