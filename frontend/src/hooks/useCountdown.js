import { useEffect, useState } from "react"

export default function useCountdown(deadline){

const [timeLeft,setTimeLeft] = useState("")

useEffect(()=>{

if(!deadline) return

function updateTimer(){

const now = Math.floor(Date.now()/1000)
const diff = deadline - now

if(diff <= 0){
setTimeLeft("Campaign ended")
return
}

const days = Math.floor(diff / 86400)
const hours = Math.floor((diff % 86400) / 3600)
const minutes = Math.floor((diff % 3600) / 60)
const seconds = diff % 60

setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`)

}

updateTimer()

const interval = setInterval(updateTimer,1000)

return ()=>clearInterval(interval)

},[deadline])

return timeLeft

}