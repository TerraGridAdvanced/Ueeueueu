import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import WebGL from "three/addons/capabilities/WebGL.js";

const $=x=>document.getElementById(x);
let model,brain,scene,camera,renderer,controls,fly;
let t=0,last=performance.now();
const body={x:0,z:0,heading:.4,v:0,turn:0,phase:0,distance:0};
const sense={food:0,light:0,hazard:0,wall:0,touch:0};
const objects={food:[],hazard:[]};

function classify(n=""){n=n.toUpperCase();if(/^(R|L|A|B|C|D|E|F|G|H|J|K|M|N|O|P|Q|S|T|V|W|X|Y|Z)/.test(n)&&/SENS|VIS|OLFACT|CHEM/.test(n))return"sens";if(/MOTOR|MN|MUS/.test(n))return"motor";return"inter"}
function fallback(){let neurons=Array.from({length:160},(_,i)=>({id:i,name:i<35?`SENS${i}`:i<125?`INT${i}`:`MOTOR${i}`,type:"unknown"}));let edges=[];for(let i=0;i<159;i++)edges.push([i,i+1,1]);for(let i=0;i<155;i+=3)edges.push([i,i+3,.6]);for(let i=35;i<125;i+=2)edges.push([i,125+(i%35),.9]);return{source:"DEMO FALLBACK",neurons,edges}}
function initBrain(){let N=model.neurons.length,inc=Array.from({length:N},()=>[]);for(const [a,b,w] of model.edges)if(a<N&&b<N)inc[b].push([a,w]);brain={v:new Float32Array(N).fill(-70),fired:new Uint8Array(N),inc,spikes:0,L:0,R:0}}
function sensory(){let a=[];for(let i=0;i<model.neurons.length;i++)if(classify(model.neurons[i].name)==="sens")a.push(i);return a}
function neural(dt){
 const N=model.neurons.length,p=brain.v,n=new Float32Array(p);brain.fired.fill(0);brain.L=0;brain.R=0;
 const ext=(sense.food*1.4+sense.light*.5+sense.hazard*1.7+sense.wall*1.4+sense.touch*1.2);
 for(const i of sensory().slice(0,100))n[i]+=ext*15*dt;
 let sp=0;
 for(let i=0;i<N;i++){let syn=0;for(const[a,w]of brain.inc[i])syn+=((p[a]+70)/70)*Math.sign(w)*Math.min(1.8,Math.abs(w));n[i]+=((-70-p[i])*.14+syn*2.6)*dt;n[i]=Math.max(-85,Math.min(18,n[i]));if(n[i]>=-52){brain.fired[i]=1;sp++;n[i]=-70;let name=model.neurons[i].name.toUpperCase();if(classify(name)==="motor"){if(/L/.test(name))brain.L++;else if(/R/.test(name))brain.R++;else if(i%2)brain.L++;else brain.R++}}}
 brain.v.set(n);brain.spikes=sp;
 // ONLY motor spikes become body forces. No target, steering, navigation or behavior code.
 const thrust=(brain.L+brain.R)*.0011,turn=(brain.R-brain.L)*.00045;
 body.v+=(thrust-body.v)*Math.min(1,dt*5);body.v*=Math.pow(.993,dt*60);
 body.turn+=(turn-body.turn)*Math.min(1,dt*5);body.heading+=body.turn;
 body.x+=Math.cos(body.heading)*body.v*dt*38;body.z+=Math.sin(body.heading)*body.v*dt*38;body.distance+=Math.abs(body.v*dt*38);body.phase+=dt*(4+body.v*80);t+=dt;
}
function sensing(){
 sense.food=sense.hazard=sense.wall=sense.touch=sense.light=0;
 for(const o of objects.food){let d=Math.hypot(body.x-o.x,body.z-o.z);sense.food=Math.max(sense.food,Math.max(0,1-d/4))}
 for(const o of objects.hazard){let d=Math.hypot(body.x-o.x,body.z-o.z);sense.hazard=Math.max(sense.hazard,Math.max(0,1-d/3))}
 sense.wall=Math.min(1,Math.max(0,(Math.abs(body.x)-8)/2,(Math.abs(body.z)-8)/2));
 sense.light=Math.max(0,1-Math.hypot(body.x+3,body.z+2)/10);
 if(Math.abs(body.x)>9||Math.abs(body.z)>9)sense.touch=1;
}
function setup(){
 if(!WebGL.isWebGL2Available())throw Error("WebGL 2 is unavailable. Try Chrome/Firefox with hardware acceleration enabled.");
 scene=new THREE.Scene();scene.background=new THREE.Color(0x07120d);scene.fog=new THREE.FogExp2(0x07120d,.025);
 camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,100);camera.position.set(0,8.5,14);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;$("world").appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=5;controls.maxDistance=25;controls.target.set(0,0,0);
 scene.add(new THREE.HemisphereLight(0xd5ffe9,0x07120e,2));let sun=new THREE.DirectionalLight(0xffffff,3.5);sun.position.set(5,12,6);sun.castShadow=true;scene.add(sun);
 let glow=new THREE.PointLight(0x55eaff,18,25);glow.position.set(-5,5,-5);scene.add(glow);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(24,24),new THREE.MeshStandardMaterial({color:0x183525,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
 const grid=new THREE.GridHelper(24,24,0x3c674d,0x24422f);grid.position.y=.01;grid.material.transparent=true;grid.material.opacity=.35;scene.add(grid);
 // world objects: visual + sensory only
 for(let i=0;i<90;i++){let x=Math.sin(i*13.31)*10.5,z=Math.cos(i*9.17)*10.5;if(Math.hypot(x,z)<2)continue;let h=.3+Math.abs(Math.sin(i*3.7))*.8;let m=new THREE.Mesh(new THREE.ConeGeometry(.12+Math.random()*.13,.5+h,5),new THREE.MeshStandardMaterial({color:0x2c603d,roughness:1}));m.position.set(x,h/2,z);m.castShadow=true;scene.add(m)}
 for(let i=0;i<8;i++){let x=Math.sin(i*4.9)*7,z=Math.cos(i*5.8)*7;let m=new THREE.Mesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshStandardMaterial({color:0x7cf0a8,emissive:0x12472b,emissiveIntensity:1.5}));m.position.set(x,.2,z);scene.add(m);objects.food.push({x,z,mesh:m})}
 for(let i=0;i<6;i++){let x=Math.sin(i*5.7+1)*6.8,z=Math.cos(i*4.2+2)*6.8;let m=new THREE.Mesh(new THREE.ConeGeometry(.25,.45,6),new THREE.MeshStandardMaterial({color:0xff655c,emissive:0x4a0907,emissiveIntensity:1}));m.position.set(x,.23,z);m.castShadow=true;scene.add(m);objects.hazard.push({x,z,mesh:m})}
 let wall=new THREE.MeshStandardMaterial({color:0x244337,roughness:1});for(const[x,z,a,b]of[[0,-10,20,.3],[0,10,20,.3],[-10,0,.3,20],[10,0,.3,20]]){let m=new THREE.Mesh(new THREE.BoxGeometry(a,.8,b),wall);m.position.set(x,.4,z);scene.add(m)}
 // Fruit-fly body
 fly=new THREE.Group();scene.add(fly);let bodyMat=new THREE.MeshStandardMaterial({color:0x24272a,roughness:.5}),thoraxMat=new THREE.MeshStandardMaterial({color:0x3b3030,roughness:.48});
 let abdomen=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),bodyMat);abdomen.scale.set(1.55,.55,.55);abdomen.position.x=-.65;fly.add(abdomen);
 let thorax=new THREE.Mesh(new THREE.SphereGeometry(.72,16,10),thoraxMat);thorax.position.x=.55;fly.add(thorax);
 let head=new THREE.Mesh(new THREE.SphereGeometry(.48,16,10),bodyMat);head.position.x=1.15;fly.add(head);
 let eye=new THREE.MeshStandardMaterial({color:0xb51f31,emissive:0x7c0814,emissiveIntensity:1.8});for(const z of[-.28,.28]){let e=new THREE.Mesh(new THREE.SphereGeometry(.18,12,8),eye);e.position.set(1.3,.08,z);fly.add(e)}
 // transparent wings
 let wingMat=new THREE.MeshPhysicalMaterial({color:0x9eefff,transparent:true,opacity:.34,roughness:.15,side:THREE.DoubleSide});
 for(const z of[-.8,.8]){let w=new THREE.Mesh(new THREE.SphereGeometry(1,12,6,0,Math.PI,0,Math.PI/2),wingMat);w.scale.set(1.3,.08,.75);w.position.set(.1,.35,z*.55);w.rotation.y=z>0?.25:-.25;fly.add(w)}
 // six legs
 let legMat=new THREE.MeshStandardMaterial({color:0x17191a});for(let side of[-1,1])for(let i=0;i<3;i++){let l=new THREE.Mesh(new THREE.CylinderGeometry(.025,.04,.9,6),legMat);l.position.set(.5-i*.55,-.38,side*.38);l.rotation.z=side*.75;l.rotation.x=.35;fly.add(l)}
 const resize=()=>{renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()};addEventListener("resize",resize);resize();
 renderer.domElement.addEventListener("pointerdown",()=>{sense.touch=1});
}
function animate(now){let dt=Math.min(.035,(now-last)/1000);last=now;sensing();neural(dt);fly.position.set(body.x,.75+Math.sin(body.phase)*.04,body.z);fly.rotation.y=-body.heading;fly.rotation.z=Math.sin(body.phase)*.05;for(const o of objects.food)o.mesh.rotation.y+=.012;for(const o of objects.hazard)o.mesh.rotation.y+=.01;controls.update();$("time").textContent=t.toFixed(2)+" s";$("fire").textContent=brain.spikes;$("speed").textContent=(Math.abs(body.v)*60).toFixed(2);$("dist").textContent=body.distance.toFixed(2);requestAnimationFrame(animate);renderer.render(scene,camera)}
async function main(){try{setup();$("bootText").textContent="Loading connectome…";try{let r=await fetch("/api/connectome");if(!r.ok)throw Error();model=await r.json();$("state").textContent="NEURAL WORLD ONLINE"}catch{model=fallback();$("state").textContent="DEMO NEURAL WORLD"}initBrain();$("bootText").textContent=`Fruit fly body ready · ${model.neurons.length} neurons`;$("dot").classList.add("live");setTimeout(()=>{$("boot").style.opacity=0;setTimeout(()=>$("boot").remove(),500)},350);requestAnimationFrame(animate)}catch(e){$("boot").remove();$("err").style.display="block";$("err").textContent="3D startup error: "+e.message}}
main();
