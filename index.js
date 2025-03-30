var J=(x)=>typeof x==="function",p=(x)=>J(x)&&x.constructor.name==="AsyncFunction",Y=(x,y)=>Object.prototype.toString.call(x)===`[object ${y}]`,i=(x)=>x instanceof Error,b=(x)=>x instanceof DOMException&&x.name==="AbortError",d=(x)=>x instanceof Promise,A=(x)=>i(x)?x:Error(String(x));class V extends Error{constructor(x){super(`Circular dependency in ${x} detected`);return this}}var j,P=new Set,U=0,S=new Map,q,o=()=>{q=void 0;let x=Array.from(S.values());S.clear();for(let y of x)y()},n=()=>{if(q)cancelAnimationFrame(q);q=requestAnimationFrame(o)};queueMicrotask(o);var F=(x)=>{if(j&&!x.has(j)){let y=j;x.add(y),j.cleanups.add(()=>{x.delete(y)})}},O=(x)=>{for(let y of x)if(U)P.add(y);else y()},T=()=>{while(P.size){let x=Array.from(P);P.clear();for(let y of x)y()}},h=(x)=>{U++;try{x()}finally{T(),U--}},C=(x,y)=>{let L=j;j=y;try{x()}finally{j=L}},l=(x,y)=>new Promise((L,z)=>{let $=()=>{try{L(x())}catch(K){z(K)}};if(y)S.set(y,$);n()});function I(x){let{signals:y,ok:L,err:z=console.error,nil:$=()=>{}}=J(x)?{signals:[],ok:x}:x,K=!1,H=()=>C(()=>{if(K)throw new V("effect");K=!0;let Q=D({signals:y,ok:L,err:z,nil:$});if(J(Q))H.cleanups.add(Q);K=!1},H);return H.cleanups=new Set,H(),()=>{H.cleanups.forEach((Q)=>Q()),H.cleanups.clear()}}var m="Computed",u=(x,y)=>{if(!y)return!1;return x.name===y.name&&x.message===y.message},R=(x)=>{let y=new Set,L=J(x)?{signals:[],ok:x}:x,z=W,$,K=!0,H=!1,Q=!1,G,X=(B)=>{if(!Object.is(B,z))z=B,K=!1,$=void 0,H=!1},g=()=>{H=W===z,z=W,$=void 0},N=(B)=>{let Z=A(B);H=u(Z,$),z=W,$=Z},M=()=>{if(K=!0,G?.abort("Aborted because source signal changed"),y.size){if(!H)O(y)}else M.cleanups.forEach((B)=>B()),M.cleanups.clear()};M.cleanups=new Set;let f=()=>C(()=>{if(Q)throw new V("computed");if(H=!0,Q=!0,p(L.ok))G=new AbortController,L.abort=L.abort instanceof AbortSignal?AbortSignal.any([L.abort,G.signal]):G.signal;let B;try{B=D(L)}catch(Z){N(A(Z)),Q=!1;return}if(d(B))g(),B.then((Z)=>{if(G?.signal.aborted)return N(new DOMException(G?.signal.reason,"AbortError")),Q=!1,f();else X(Z),O(y)}).catch((Z)=>{N(Z),O(y)});else if(B==null||W===B)g();else X(B);Q=!1},M),k={[Symbol.toStringTag]:m,get:()=>{if(F(y),T(),K)f();if($)throw $;return z},map:(B)=>R({signals:[k],...J(B)?{ok:B}:B}),tap:(B)=>I({signals:[k],...J(B)?{ok:B}:B})};return k},_=(x)=>Y(x,m);var s="State",E=(x)=>{let y=new Set,L=x,z={[Symbol.toStringTag]:s,get:()=>{return F(y),L},set:($)=>{if(Object.is(L,$))return;if(L=$,O(y),W===L)y.clear()},update:($)=>{z.set($(L))},map:($)=>R({signals:[z],...J($)?{ok:$}:$}),tap:($)=>I({signals:[z],...J($)?{ok:$}:$})};return z},w=(x)=>Y(x,s);var W=Symbol(),v=(x)=>w(x)||_(x),c=(x)=>J(x)&&!x.length,t=(x)=>v(x)?x:J(x)?R(x):E(x),D=(x)=>{let{signals:y,ok:L}=x,z=x.err??((...G)=>{if(G.length>1)throw new AggregateError(G);else throw G[0]}),$=x.nil??(()=>W),K=[],H=!1,Q=y.map((G)=>{try{let X=G.get();if(X===W)H=!0;return X}catch(X){if(b(X))throw X;K.push(A(X))}});try{return H?$():K.length?z(...K):L(...Q)}catch(G){if(b(G))throw G;return z(A(G))}};export{C as watch,t as toSignal,E as state,w as isState,v as isSignal,c as isComputedCallback,_ as isComputed,l as enqueue,I as effect,R as computed,h as batch,W as UNSET,V as CircularDependencyError};
