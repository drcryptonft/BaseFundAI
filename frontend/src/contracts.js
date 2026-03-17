// src/contracts.js

export const FACTORY_ADDRESS = "0x1c20832065121f0719fEe423ED1899eb84A784Ab";



/* ================= FACTORY ABI ================= */

export const FACTORY_ABI = [

{
  "inputs": [
    { "internalType": "uint256", "name": "goal", "type": "uint256" },
    { "internalType": "uint256", "name": "durationInDays", "type": "uint256" }
  ],
  "name": "createCampaign",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
},

{
  "inputs": [],
  "name": "getCampaigns",
  "outputs": [
    { "internalType": "address[]", "name": "", "type": "address[]" }
  ],
  "stateMutability": "view",
  "type": "function"
},

{
  "inputs": [],
  "name": "campaignCount",
  "outputs": [
    { "internalType": "uint256", "name": "", "type": "uint256" }
  ],
  "stateMutability": "view",
  "type": "function"
}

];



/* ================= CAMPAIGN ABI ================= */

export const CAMPAIGN_ABI = [

{
 "inputs":[
   {"internalType":"address","name":"_usdc","type":"address"},
   {"internalType":"address","name":"_creator","type":"address"},
   {"internalType":"uint256","name":"_goal","type":"uint256"},
   {"internalType":"uint256","name":"_durationInDays","type":"uint256"}
 ],
 "stateMutability":"nonpayable",
 "type":"constructor"
},

{
 "inputs":[],
 "name":"goal",
 "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"totalRaised",
 "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"deadline",
 "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"creator",
 "outputs":[{"internalType":"address","name":"","type":"address"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"finalized",
 "outputs":[{"internalType":"bool","name":"","type":"bool"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"successful",
 "outputs":[{"internalType":"bool","name":"","type":"bool"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[
   {"internalType":"uint256","name":"amount","type":"uint256"}
 ],
 "name":"contribute",
 "outputs":[],
 "stateMutability":"nonpayable",
 "type":"function"
},

{
 "inputs":[],
 "name":"finalize",
 "outputs":[],
 "stateMutability":"nonpayable",
 "type":"function"
},

{
 "inputs":[],
 "name":"claimFunds",
 "outputs":[],
 "stateMutability":"nonpayable",
 "type":"function"
},

{
 "inputs":[],
 "name":"claimRefund",
 "outputs":[],
 "stateMutability":"nonpayable",
 "type":"function"
},

{
 "inputs":[
   {"internalType":"address","name":"","type":"address"}
 ],
 "name":"contributions",
 "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"getCampaignState",
 "outputs":[{"internalType":"uint8","name":"","type":"uint8"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"timeLeft",
 "outputs":[{"internalType":"uint256","name":"","type":"uint256"}],
 "stateMutability":"view",
 "type":"function"
},

{
 "inputs":[],
 "name":"isActive",
 "outputs":[{"internalType":"bool","name":"","type":"bool"}],
 "stateMutability":"view",
 "type":"function"
}

];