var C=(y)=>typeof y==="function";var g=(y)=>C(y)&&y.length<2,T=(y,x)=>Object.prototype.toString.call(y)===`[object ${x}]`,k=(y)=>(x)=>x instanceof y,I=k(Error),b=k(Promise),q=(y)=>I(y)?y:new Error(String(y)),p=(y,x)=>{if(!x)return!1;return y.name===x.name&&y.message===x.message};if(!("requestAnimationFrame"in globalThis))globalThis.requestAnimationFrame=(y)=>setTimeout(y,16);var Z,D=new Set,U=0,P=new Map,M,h=()=>{M=void 0;for(let y of P.values()){for(let x of y.values())x();y.clear()}},v=()=>{if(M)cancelAnimationFrame(M);M=requestAnimationFrame(h)};queueMicrotask(h);var F=(y)=>{if(Z&&!y.includes(Z))y.push(Z)},N=(y)=>{for(let x of y)U?D.add(x):x()},m=()=>{while(D.size){let y=Array.from(D);D.clear();for(let x of y)x()}},t=(y)=>{U++,y(),m(),U--},R=(y,x)=>{let $=Z;Z=x,y(),Z=$},s=(y,x)=>new Promise(($,L)=>{let B=()=>{try{$(y())}catch(z){L(z)}};if(x){let[z,G]=x;if(!P.has(z))P.set(z,new Map);P.get(z).set(G,B)}v()}),u=async()=>new Promise(requestAnimationFrame);function Y(y,...x){let $=C(y)?{ok:y}:y,L=()=>R(()=>{let B=E(x,$);if(I(B))throw new Error("Unhandled error in effect:",{cause:B})},L);L()}var d="Computed",j=(y,...x)=>{let $=C(y)?{ok:y}:y,L=[],B=K,z,G=!0,H=!1,J=!1,A=()=>{if(G=!0,!H)N(L)},Q=()=>R(()=>{if(J)throw new Error("Circular dependency detected");let V=(X)=>{if(!Object.is(X,B))B=X,G=!1,z=void 0,H=!1},o=(X)=>{let _=q(X);H=p(_,z),z=_};H=!0,J=!0;let W=E(x,$);if(b(W))W.then((X)=>{V(X),N(L)}).catch(o);else if(I(W))o(W);else if(W==null)H=K===B,B=K,z=void 0;else V(W);J=!1},A),S={[Symbol.toStringTag]:d,get:()=>{if(F(L),m(),G)Q();if(z)throw z;return B},map:(V)=>j(()=>V(S.get())),match:(V)=>Y(V,S)};return S},f=(y)=>T(y,d);var n="State",w=(y)=>{let x=[],$=y,L={[Symbol.toStringTag]:n,get:()=>{return F(x),$},set:(B)=>{if(Object.is($,B))return;if($=B,N(x),K===$)x.length=0},update:(B)=>{L.set(B($))},map:(B)=>{return j(()=>B(L.get()))},match:(B)=>Y(B,L)};return L},O=(y)=>T(y,n);var K=Symbol(),i=(y)=>O(y)||f(y),c=(y)=>i(y)?y:g(y)?j(y):w(y),E=(y,x)=>{let{ok:$,nil:L,err:B}=x,z=[],G=[],H=!1;for(let A of y)try{let Q=A.get();if(Q===K)H=!0;z.push(Q)}catch(Q){G.push(q(Q))}let J=void 0;try{if(!H&&!G.length)J=$(...z);else if(G.length&&B)J=B(...G);else if(H&&L)J=L()}catch(A){J=q(A)}finally{return J}};export{R as watch,c as toSignal,w as state,O as isState,i as isSignal,f as isComputed,s as enqueue,Y as effect,j as computed,t as batch,u as animationFrame,K as UNSET};
