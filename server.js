const http=require("http"), fs=require("fs"), path=require("path"), crypto=require("crypto");
const WebSocket=require("ws");
const PORT=process.env.PORT||8080, rooms=new Map(), MAX_ROOMS=1000, TTL=60*60*1000;
function code(){let s="";const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";do{for(let i=0;i<6;i++)s+=a[Math.floor(Math.random()*a.length)];}while(rooms.has(s));return s}
function cleanup(){for(const [id,r] of rooms)if(Date.now()-r.last>TTL||r.clients.size===0)rooms.delete(id)}
setInterval(cleanup,60000);
const server=http.createServer((req,res)=>{let u=new URL(req.url,"http://localhost");let f=u.pathname==="/"?"index.html":u.pathname.slice(1);let p=path.join(__dirname,"public",f);if(!p.startsWith(path.join(__dirname,"public")))return res.writeHead(403).end();fs.readFile(p,(e,d)=>{if(e)return res.writeHead(404).end("Not found");res.writeHead(200,{"content-type":f.endsWith(".html")?"text/html; charset=utf-8":"text/plain"}).end(d)})});
const wss=new WebSocket.Server({server});
wss.on("connection",(ws)=>{
 let room=null, id=crypto.randomUUID(), nick="匿名";
 ws.on("message",(buf)=>{
  let m;try{m=JSON.parse(buf)}catch{return}
  if(m.type==="create"){if(rooms.size>=MAX_ROOMS)return ws.send(JSON.stringify({type:"error",text:"当前房间过多"}));room=code();rooms.set(room,{clients:new Map([[id,ws]]),last:Date.now()});nick=String(m.nick||"匿名").slice(0,24);return ws.send(JSON.stringify({type:"created",room,nick}))}
  if(m.type==="join"){let r=rooms.get(String(m.room||"").toUpperCase());if(!r)return ws.send(JSON.stringify({type:"error",text:"房间不存在或已过期"}));if(r.clients.size>=2)return ws.send(JSON.stringify({type:"error",text:"房间已满"}));room=String(m.room).toUpperCase();nick=String(m.nick||"匿名").slice(0,24);r.clients.set(id,ws);r.last=Date.now();for(const [,c] of r.clients)if(c!==ws&&c.readyState===1)c.send(JSON.stringify({type:"peer_joined",nick}));return ws.send(JSON.stringify({type:"joined",room,nick}))}
  if(m.type==="message"&&room){let r=rooms.get(room);if(!r)return;let text=String(m.text||"").slice(0,2000);if(!text)return;r.last=Date.now();for(const [cid,c] of r.clients)if(cid!==id&&c.readyState===1)c.send(JSON.stringify({type:"message",nick,text}))}
 });
 ws.on("close",()=>{if(!room)return;let r=rooms.get(room);if(!r)return;r.clients.delete(id);r.last=Date.now();for(const [,c] of r.clients)if(c.readyState===1)c.send(JSON.stringify({type:"peer_left"}));if(r.clients.size===0)rooms.delete(room)});
});
server.listen(PORT,()=>console.log("relay chat listening on "+PORT));