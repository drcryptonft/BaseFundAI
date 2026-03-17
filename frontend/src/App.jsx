import { ConnectButton } from "@rainbow-me/rainbowkit";
import CreateCampaign from "./components/CreateCampaign";
import CampaignList from "./components/CampaignList";
import logo from "./assets/logo.png";

export default function App() {

return (

<div
style={{
minHeight:"100vh",
background:"#f8fafc",
color:"#0f172a",
fontFamily:"Arial"
}}
>

<header
style={{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
padding:"15px 40px",
borderBottom:"1px solid #e2e8f0",
background:"#ffffff"
}}
>

<div style={{display:"flex",alignItems:"center",gap:"10px"}}>

<img
src={logo}
style={{
height:"40px",
width:"40px",
objectFit:"contain"
}}
/>

<h1
style={{
fontSize:"22px",
fontWeight:"600"
}}
>
BaseFundAI
</h1>

</div>

<nav
style={{
display:"flex",
gap:"25px",
color:"#64748b",
fontSize:"14px"
}}
>

<a style={{cursor:"pointer"}}>Home</a>
<a style={{cursor:"pointer"}}>Docs</a>
<a style={{cursor:"pointer"}}>Community</a>
<a style={{cursor:"pointer"}}>Twitter</a>

</nav>

<ConnectButton/>

</header>

<main
style={{
maxWidth:"1100px",
margin:"auto",
padding:"40px 20px"
}}
>

<CreateCampaign/>

<div style={{marginTop:"50px"}}>

<h2
style={{
fontSize:"26px",
marginBottom:"20px",
fontWeight:"600"
}}
>
Live Campaigns
</h2>

<CampaignList/>

</div>

</main>

</div>

)

}