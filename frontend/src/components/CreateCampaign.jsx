import { useState } from "react"
import { useWalletClient } from "wagmi"
import { FACTORY_ADDRESS, FACTORY_ABI } from "../contracts"
import { publicClient } from "../wagmi"
import { parseUnits } from "viem"
import { uploadMetadata } from "../ipfs"

export default function CreateCampaign(){

const { data: walletClient } = useWalletClient()

const [headline,setHeadline] = useState("")
const [desc,setDesc] = useState("")
const [goal,setGoal] = useState("")
const [video,setVideo] = useState("")
const [duration,setDuration] = useState("7")
const [images,setImages] = useState([])


function handleImageUpload(e){

const files = Array.from(e.target.files).slice(0,3)

const readers = files.map(file=>{
return new Promise(resolve=>{

if(file.size > 500000){
alert("Image must be under 500KB")
resolve(null)
return
}

const reader = new FileReader()

reader.onload = () => resolve(reader.result)

reader.readAsDataURL(file)

})
})

Promise.all(readers).then(res=>{
setImages(res.filter(Boolean))
})

}

function formatYoutube(url){

if(!url) return ""

if(url.includes("youtube.com/watch")){
const id = url.split("v=")[1]?.split("&")[0]
return `https://www.youtube.com/embed/${id}`
}

if(url.includes("youtu.be")){
const id = url.split("youtu.be/")[1]
return `https://www.youtube.com/embed/${id}`
}

return url
}

async function createCampaign(){

try{

if(!walletClient){
alert("Connect wallet")
return
}

if(!headline || !desc || !goal){
alert("Fill required fields")
return
}

if(Number(duration) < 1 || Number(duration) > 15){
alert("Campaign duration must be between 1 and 15 days")
return
}

/* Upload metadata */

const metadata = {
headline,
description: desc,
youtube: formatYoutube(video),
images
}

const ipfsHash = await uploadMetadata(metadata)

const goalUnits = parseUnits(goal,6)

/* GET CURRENT CAMPAIGN COUNT BEFORE CREATION */

const campaignsBefore = await publicClient.readContract({
address: FACTORY_ADDRESS,
abi: FACTORY_ABI,
functionName:"getCampaigns"
})

const previousCount = campaignsBefore.length

const txHash = await walletClient.writeContract({
address: FACTORY_ADDRESS,
abi: FACTORY_ABI,
functionName:"createCampaign",
args:[goalUnits,Number(duration)],
account:walletClient.account
})

alert("Transaction sent")

await publicClient.waitForTransactionReceipt({ hash: txHash })

/* GET NEW CAMPAIGN ADDRESS RELIABLY */

const campaigns = await publicClient.readContract({
address: FACTORY_ADDRESS,
abi: FACTORY_ABI,
functionName:"getCampaigns"
})

const newCampaignAddress = campaigns[previousCount]
console.log("NEW CAMPAIGN ADDRESS:", newCampaignAddress)
console.log("IPFS HASH:", ipfsHash)



/* store metadata */

let map = JSON.parse(localStorage.getItem("campaignMeta") || "{}")
map[newCampaignAddress] = ipfsHash

localStorage.setItem("campaignMeta",JSON.stringify(map))

console.log("STORED MAP:", map)

alert("Campaign created")

window.location.reload()

}catch(err){

console.error(err)
alert("Transaction failed")

}

}

return(

<div style={{ background:"linear-gradient(135deg,#0f172a,#1e293b)", padding:"30px", borderRadius:"12px" }}>

<h2 style={{ color:"#fff", fontSize:"26px", marginBottom:"20px" }}>
Launch Campaign
</h2>

<div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr auto", gap:"12px" }}>

<input placeholder="Headline" value={headline} onChange={e=>setHeadline(e.target.value)} style={input}/>

<input placeholder="Description" value={desc} onChange={e=>setDesc(e.target.value)} style={input}/>

<input placeholder="Goal USDC" value={goal} onChange={e=>setGoal(e.target.value)} style={input}/>

<input placeholder="YouTube video" value={video} onChange={e=>setVideo(e.target.value)} style={input}/>

<select value={duration} onChange={e=>setDuration(e.target.value)} style={input}>
<option value="1">1 day</option>
<option value="3">3 days</option>
<option value="7">7 days</option>
<option value="10">10 days</option>
<option value="15">15 days</option>
</select>

<button onClick={createCampaign} style={button}>
Create Campaign
</button>

</div>

<div style={{marginTop:"15px"}}>

<input type="file" multiple accept="image/*" onChange={handleImageUpload}/>

<div style={{display:"flex",gap:"8px",marginTop:"10px"}}>

{images.map((img,i)=>(
<img key={i} src={img} style={{ width:"70px", height:"50px", objectFit:"cover", borderRadius:"6px" }}/>
))}

</div>

</div>

</div>

)

}

const input={
padding:"10px",
borderRadius:"6px",
border:"1px solid #334155",
background:"#0f172a",
color:"#fff"
}

const button={
background:"#2563eb",
color:"#fff",
border:"none",
padding:"10px 18px",
borderRadius:"6px",
cursor:"pointer"
}