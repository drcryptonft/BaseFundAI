export const FACTORY_ADDRESS =
  "0x1c20832065121f0719fEe423ED1899eb84A784Ab";

export const USDC_ADDRESS =
  "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";

export const FACTORY_ABI = [
  {
    name: "getCampaigns",
    outputs: [{ type: "address[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "createCampaign",
    inputs: [
      { name: "goal", type: "uint256" },
      { name: "durationInDays", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export const CAMPAIGN_ABI = [
  { name: "goal", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { name: "totalRaised", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { name: "deadline", outputs: [{ type: "uint256" }], stateMutability: "view", type: "function" },
  { name: "creator", outputs: [{ type: "address" }], stateMutability: "view", type: "function" },
  { name: "finalized", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  { name: "successful", outputs: [{ type: "bool" }], stateMutability: "view", type: "function" },
  {
    name: "contributions",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  { name: "contribute", inputs: [{ type: "uint256" }], stateMutability: "nonpayable", type: "function" },
  { name: "finalize", inputs: [], stateMutability: "nonpayable", type: "function" },
  { name: "claimFunds", inputs: [], stateMutability: "nonpayable", type: "function" },
  { name: "claimRefund", inputs: [], stateMutability: "nonpayable", type: "function" },
];

export const ERC20_ABI = [
  {
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    name: "allowance",
    inputs: [
      { type: "address" },
      { type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];