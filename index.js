var J=(y)=>typeof y==="function";var q=(y,x)=>Object.prototype.toString.call(y)===`[object ${x}]`,w=(y)=>(x)=>x instanceof y,m=w(Error),g=w(Promise),A=(y)=>m(y)?y:Error(String(y));class V extends Error{constructor(y){super(`Circular dependency in ${y} detected`);return this}}var Z,F=new Set,b=0,T=new Map,M,E=()=>{M=void 0;let y=Array.from(T.values());T.clear();for(let x of y)x()},s=()=>{if(M)cancelAnimationFrame(M);M=requestAnimationFrame(E)};queueMicrotask(E);var P=(y)=>{if(Z&&!y.has(Z)){let x=Z;y.add(x),Z.cleanups.add(()=>{y.delete(x)})}},R=(y)=>{for(let x of y)if(b)F.add(x);else x()},U=()=>{while(F.size){let y=Array.from(F);F.clear();for(let x of y)x()}},v=(y)=>{b++;try{y()}finally{U(),b--}},C=(y,x)=>{let L=Z;Z=x;try{y()}finally{Z=L}},i=(y,x)=>new Promise((L,z)=>{let $=()=>{try{L(y())}catch(G){z(G)}};if(x)T.set(x,$);s()});function O(y){let{signals:x,ok:L,err:z=console.error,nil:$=()=>{}}=J(y)?{signals:[],ok:y}:y,G=!1,H=()=>C(()=>{if(G)throw new V("effect");G=!0;let W=N({signals:x,ok:L,err:z,nil:$});if(J(W))H.cleanups.add(W);G=!1},H);return H.cleanups=new Set,H(),()=>{H.cleanups.forEach((W)=>W()),H.cleanups.clear()}}var f="Computed",n=(y,x)=>{if(!x)return!1;return y.name===x.name&&y.message===x.message},I=(y)=>{let x=new Set,L=K,z,$=!0,G=!1,H=!1,W=(B)=>{if(!Object.is(B,L))L=B,$=!1,z=void 0,G=!1},Q=()=>{G=K===L,L=K,z=void 0},X=(B)=>{let j=A(B);G=n(j,z),L=K,z=j},Y=()=>{if($=!0,x.size){if(!G)R(x)}else Y.cleanups.forEach((B)=>B()),Y.cleanups.clear()};Y.cleanups=new Set;let o=()=>C(()=>{if(H)throw new V("computed");G=!0,H=!0;let B;try{B=N(J(y)?{signals:[],ok:y}:y)}catch(j){X(A(j)),H=!1;return}if(g(B))Q(),B.then((j)=>{W(j),R(x)}).catch(X);else if(B==null||K===B)Q();else W(B);H=!1},Y),D={[Symbol.toStringTag]:f,get:()=>{if(P(x),U(),$)o();if(z)throw z;return L},map:(B)=>I({signals:[D],...J(B)?{ok:B}:B}),tap:(B)=>O({signals:[D],...J(B)?{ok:B}:B})};return D},k=(y)=>q(y,f);var p="State",S=(y)=>{let x=new Set,L=y,z={[Symbol.toStringTag]:p,get:()=>{return P(x),L},set:($)=>{if(Object.is(L,$))return;if(L=$,R(x),K===L)x.clear()},update:($)=>{z.set($(L))},map:($)=>I({signals:[z],...J($)?{ok:$}:$}),tap:($)=>O({signals:[z],...J($)?{ok:$}:$})};return z},_=(y)=>q(y,p);var K=Symbol(),d=(y)=>_(y)||k(y),h=(y)=>J(y)&&!y.length,l=(y)=>d(y)?y:J(y)?I(y):S(y),N=(y)=>{let{signals:x,ok:L}=y,z=y.err??((...Q)=>{if(Q.length>1)throw new AggregateError(Q);else throw Q[0]}),$=y.nil??(()=>K),G=[],H=!1,W=x.map((Q)=>{try{let X=Q.get();if(X===K)H=!0;return X}catch(X){G.push(A(X))}});try{return H?$():G.length?z(...G):L(...W)}catch(Q){return z(A(Q))}};export{C as watch,l as toSignal,S as state,_ as isState,d as isSignal,h as isComputedCallback,k as isComputed,i as enqueue,O as effect,I as computed,v as batch,K as UNSET,V as CircularDependencyError};
