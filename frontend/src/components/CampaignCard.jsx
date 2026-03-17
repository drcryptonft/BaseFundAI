import { useEffect, useState } from "react"
import { publicClient } from "../wagmi"
import { CAMPAIGN_ABI } from "../contracts"
import { useWalletClient } from "wagmi"
import useCountdown from "../hooks/useCountdown"
import { FaTwitter, FaFacebook, FaLinkedin, FaReddit, FaLink } from "react-icons/fa"

export default function CampaignCard({ campaign, refreshCampaigns }) {

const campaignAddress = campaign?.address

/* ---------- STATES ---------- */

const goal = campaign?.goal ? Number(campaign.goal)/1e6 : 0
const raised = campaign?.raised ? Number(campaign.raised)/1e6 : 0
const deadline = campaign?.deadline || 0
const finalized = campaign?.finalized || false
const successful = campaign?.successful || false
const creator = campaign?.creator || ""

const [userContribution,setUserContribution] = useState(0)
const [refunded,setRefunded] = useState(false)
const [claimed,setClaimed] = useState(false)

const [thankYou,setThankYou] = useState(false)
const [amount,setAmount] = useState("")
const [support,setSupport] = useState(true)
const [donation,setDonation] = useState(1)

const timeLeft = useCountdown(deadline)

const { data: walletClient } = useWalletClient()

/* ---------- LOAD USER CONTRIBUTION ---------- */

useEffect(()=>{

async function loadContribution(){

if(!walletClient?.account?.address || !campaignAddress) return

try{

const value = await publicClient.readContract({
address: campaignAddress,
abi: CAMPAIGN_ABI,
functionName: "contributions",
args: [walletClient.account.address]
})

setUserContribution(Number(value)/1e6)

}catch(err){
console.log(err)
}

}

loadContribution()

},[walletClient,campaignAddress])

/* ---------- METADATA ---------- */

const [content,setContent] = useState({})
const [expanded,setExpanded] = useState(false)

const youtube = content.youtube || ""
const images = content.images || (content.image ? [content.image] : [])

const [activeMedia,setActiveMedia] = useState("video")
const [imageIndex,setImageIndex] = useState(0)

/* ---------- LOAD METADATA ---------- */

useEffect(()=>{
if(campaign?.address){
loadMetadata()
}
},[campaign])

async function loadMetadata(){

try{

const map = JSON.parse(localStorage.getItem("campaignMeta") || "{}")

if(map[campaign.address]){

const res = await fetch(`https://gateway.pinata.cloud/ipfs/${map[campaign.address]}`)
const data = await res.json()

setContent(data)

}

}catch(err){

console.log("Metadata load error",err)

}

}

/* ---------- USDC ---------- */

const USDC_ADDRESS = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f"
const PLATFORM_WALLET = "0x736824756b5cea6fc8bc6446f27052cf182feb4a"

const ERC20_ABI=[{
name:"approve",
type:"function",
stateMutability:"nonpayable",
inputs:[
{ name:"spender", type:"address" },
{ name:"amount", type:"uint256" }
],
outputs:[{ type:"bool" }]
}]

const ERC20_TRANSFER_ABI=[{
name:"transfer",
type:"function",
stateMutability:"nonpayable",
inputs:[
{ name:"to", type:"address" },
{ name:"amount", type:"uint256" }
],
outputs:[{ type:"bool" }]
}]

/* ---------- CONTRIBUTE ---------- */

async function contribute(){

if(raised >= goal){
alert("Funding goal already reached")
return
}

try{

if(!walletClient){
alert("Connect wallet")
return
}

const contribution = Number(amount || 0)

if(contribution <= 0){
alert("Enter contribution amount")
return
}

const donationValue = support ? Number(donation) : 0

const contributionUnits = Math.floor(contribution*1e6)
const donationUnits = Math.floor(donationValue*1e6)

const totalUnits = contributionUnits + donationUnits

await walletClient.writeContract({
address: USDC_ADDRESS,
abi: ERC20_ABI,
functionName:"approve",
args:[campaignAddress,totalUnits],
account:walletClient.account
})

if(contributionUnits>0){

await walletClient.writeContract({
address: campaignAddress,
abi: CAMPAIGN_ABI,
functionName:"contribute",
args:[contributionUnits],
account:walletClient.account
})

}

if(donationUnits>0){

await walletClient.writeContract({
address:USDC_ADDRESS,
abi:ERC20_TRANSFER_ABI,
functionName:"transfer",
args:[PLATFORM_WALLET,donationUnits],
account:walletClient.account
})

}

setThankYou(true)

setTimeout(()=>{
setThankYou(false)
},4000)

setUserContribution(prev => prev + contribution)

refreshCampaigns?.()

}catch(err){
console.log(err)
}

}

/* ---------- DONATE ---------- */

async function donate(){

try{

if(!walletClient){
alert("Connect wallet")
return
}

const donationValue = Number(donation)

if(donationValue <= 0){
alert("Enter donation amount")
return
}

const donationUnits = Math.floor(donationValue*1e6)

await walletClient.writeContract({
address:USDC_ADDRESS,
abi:ERC20_TRANSFER_ABI,
functionName:"transfer",
args:[PLATFORM_WALLET,donationUnits],
account:walletClient.account
})

setThankYou(true)

setTimeout(()=>setThankYou(false),4000)

refreshCampaigns?.()

}catch(err){
console.log(err)
}

}

/* ---------- FINALIZE ---------- */

async function finalizeCampaign(){

try{

await walletClient.writeContract({
address: campaignAddress,
abi: CAMPAIGN_ABI,
functionName:"finalize",
account:walletClient.account
})

refreshCampaigns?.()

}catch(err){
console.log(err)
}

}

/* ---------- CLAIM FUNDS ---------- */

async function claimFunds(){

await walletClient.writeContract({
address: campaignAddress,
abi: CAMPAIGN_ABI,
functionName:"claimFunds",
account:walletClient.account
})

setClaimed(true)

refreshCampaigns?.()

}

/* ---------- REFUND ---------- */

async function claimRefund(){

await walletClient.writeContract({
address: campaignAddress,
abi: CAMPAIGN_ABI,
functionName:"claimRefund",
account:walletClient.account
})

setRefunded(true)
setUserContribution(0)

refreshCampaigns?.()

}

/* ---------- STATUS ---------- */

const progress = goal ? Math.min((raised / goal) * 100, 100) : 0
const now = Math.floor(Date.now() / 1000)

let campaignState = "LOADING"

if (deadline > 0) {

if(finalized && successful && raised > 0){
campaignState = "SUCCESS"
}
else if(finalized && successful && raised === 0){
campaignState = "CLAIMED"
}
else if(finalized && !successful){
campaignState = "FAILED"
}
else if(now >= deadline && !finalized){
campaignState = "AWAITING_FINALIZATION"
}
else if(raised >= goal && now < deadline){
campaignState = "GOAL_REACHED"
}
else{
campaignState = "ACTIVE"
}

}

const statusMap = {
ACTIVE:"Active",
GOAL_REACHED:"Goal Reached",
AWAITING_FINALIZATION:"Awaiting Finalization",
SUCCESS:"Successful",
CLAIMED:"Funds Claimed",
FAILED:"Failed"
}

const status = statusMap[campaignState]

/* ---------- UI ---------- */

function copyLink(){
navigator.clipboard.writeText(window.location.href)
alert("Link copied")
}

return(

<div style={card}>

<div style={{flexGrow:1}}>

<div style={statusStyle}>{status}</div>

<h2 style={title}>{content.headline || "Untitled Campaign"}</h2>

<p style={desc(expanded)}>
{content.description || ""}
</p>

{content.description?.length>120 && (
<span style={seeMore} onClick={()=>setExpanded(!expanded)}>
{expanded ? "See less":"See more"}
</span>
)}

<div style={creatorStyle}>
Creator: {creator.slice(0,6)}...{creator.slice(-4)}
</div>

<div style={{color:"#ef4444",marginBottom:"8px"}}>
⏳ {timeLeft}
</div>

{/* MEDIA */}

<div style={{display:"flex",gap:"10px",marginBottom:"6px"}}>

{youtube && (
<button onClick={()=>setActiveMedia("video")} style={tab(activeMedia==="video")}>
Video
</button>
)}

{images.length>0 && (
<button onClick={()=>setActiveMedia("images")} style={tab(activeMedia==="images")}>
Images
</button>
)}

</div>

<div style={mediaBox}>

{activeMedia==="video" && youtube && (
<iframe src={youtube} style={{width:"100%",height:"100%",border:"none"}} allowFullScreen/>
)}

{activeMedia==="images" && images.length>0 && (

<>
<img src={images[imageIndex]} style={imageStyle}/>

{images.length>1 && (
<>
<button style={arrowLeft} onClick={()=>setImageIndex((imageIndex-1+images.length)%images.length)}>◀</button>
<button style={arrowRight} onClick={()=>setImageIndex((imageIndex+1)%images.length)}>▶</button>
</>
)}

</>

)}

</div>

<div style={{marginTop:"10px"}}>

<div style={{display:"flex",justifyContent:"space-between"}}>
<span style={{color:"#16a34a"}}>${raised.toFixed(2)} raised</span>
<span>Goal ${goal.toFixed(2)}</span>
</div>

<div style={progressBar}>
<div style={{width:`${progress}%`,height:"8px",background:"#22c55e"}}/>
</div>

</div>

</div>

{/* BUTTONS */}

<div>

<div style={{display:"flex",gap:"10px",marginTop:"10px"}}>

{campaignState==="ACTIVE" && (
<>
<input
type="number"
placeholder="Amount"
value={amount}
onChange={(e)=>setAmount(e.target.value)}
style={input}
/>
<button onClick={contribute} style={btnBlue}>Contribute</button>
</>
)}

{campaignState==="AWAITING_FINALIZATION" && (
<button onClick={finalizeCampaign} style={btnOrange}>Finalize</button>
)}

{campaignState==="SUCCESS" && walletClient?.account?.address?.toLowerCase() === creator?.toLowerCase() && now >= deadline && !claimed && (
<button onClick={claimFunds} style={btnGreen}>Claim</button>
)}

{claimed && (
<button disabled style={btnDisabled}>Claimed</button>
)}

{campaignState==="FAILED" && userContribution>0 && !refunded && (
<button onClick={claimRefund} style={btnRed}>Refund</button>
)}

{refunded && (
<button disabled style={btnDisabled}>Refunded</button>
)}

{(
campaignState==="GOAL_REACHED" ||
campaignState==="FAILED" ||
(campaignState==="SUCCESS" && walletClient?.account?.address?.toLowerCase() !== creator?.toLowerCase())
) && (
<button onClick={donate} style={btnPurple}>Donate</button>
)}

</div>

{/* PLATFORM SUPPORT */}

<div style={{display:"flex",gap:"8px",marginTop:"10px"}}>

<input type="checkbox" checked={support} onChange={()=>setSupport(!support)}/>
<span>❤️ Support the Platform</span>

{support && (
<input type="number"
value={donation}
onChange={(e)=>setDonation(e.target.value)}
style={{width:"70px"}}
/>
)}

<span>USDC</span>

</div>

{/* SHARE */}

<div style={{display:"flex",gap:"15px",marginTop:"10px"}}>

<a href={`https://twitter.com/intent/tweet?url=${window.location.href}`} target="_blank"><FaTwitter/></a>
<a href={`https://www.facebook.com/sharer/sharer.php?u=${window.location.href}`} target="_blank"><FaFacebook/></a>
<a href={`https://www.linkedin.com/sharing/share-offsite/?url=${window.location.href}`} target="_blank"><FaLinkedin/></a>
<a href={`https://reddit.com/submit?url=${window.location.href}`} target="_blank"><FaReddit/></a>

<button onClick={copyLink} style={{border:"none",background:"transparent"}}>
<FaLink/>
</button>

</div>

</div>

{thankYou && (
<div style={toast}>
❤️ Thank you for supporting the platform!
</div>
)}

</div>

)

}

/* ---------- STYLES ---------- */

const card={background:"#fff",border:"1px solid #e2e8f0",borderRadius:"12px",padding:"20px"}
const statusStyle={fontSize:"12px",color:"#64748b"}
const title={fontSize:"22px"}
const creatorStyle={fontSize:"13px",color:"#64748b"}
const progressBar={height:"8px",background:"#e2e8f0",borderRadius:"5px"}

const input={flex:1,padding:"10px",border:"1px solid #e2e8f0"}

const btnBlue={background:"#2563eb",color:"#fff",padding:"10px"}
const btnOrange={background:"#f59e0b",color:"#fff",padding:"10px"}
const btnGreen={background:"#16a34a",color:"#fff",padding:"10px"}
const btnRed={background:"#ef4444",color:"#fff",padding:"10px"}
const btnPurple={background:"#7c3aed",color:"#fff",padding:"10px"}

const btnDisabled={background:"#94a3b8",color:"#fff",padding:"10px"}

const toast={
position:"fixed",
top:"20px",
left:"50%",
transform:"translateX(-50%)",
background:"#16a34a",
color:"#fff",
padding:"16px 22px",
borderRadius:"10px",
zIndex:9999
}

const mediaBox={width:"100%",aspectRatio:"16/9",background:"#000",borderRadius:"8px",overflow:"hidden",position:"relative"}
const imageStyle={width:"100%",height:"100%",objectFit:"cover"}

const arrowLeft={position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)"}
const arrowRight={position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)"}

const tab=(active)=>({
padding:"4px 10px",
borderRadius:"6px",
border:"none",
background: active ? "#2563eb" : "#e2e8f0",
color: active ? "#fff":"#000",
cursor:"pointer"
})

const desc=(expanded)=>({
fontSize:"14px",
color:"#475569",
display:"-webkit-box",
WebkitLineClamp: expanded ? "unset":2,
WebkitBoxOrient:"vertical",
overflow:"hidden"
})

const seeMore={color:"#2563eb",cursor:"pointer",fontSize:"13px"}