var K=(y)=>typeof y==="function",Y=(y)=>K(y)&&/^async\s+/.test(y.toString()),q=(y)=>(x)=>x instanceof y,z=q(Error),C=q(Promise);var D="Computed",A=(y,x)=>{x=x??Y(y);let B=new Set,Z,L=null,j=!0,O=()=>{if(j=!0,x)H(B)},S=()=>{try{return y()}catch(k){return z(k)?k:new Error(`Error during reactive computation: ${k}`)}},P=(k)=>{j=!1,Z=k,L=null},$=(k)=>{j=!0,L=k},M=(k)=>z(k)?$(k):P(k),V={[Symbol.toStringTag]:D,get:()=>{if(G(B),!x||j)I(()=>{let k=S();C(k)?k.then(M).catch($):M(k)},O);if(z(L))throw L;return Z},map:(k)=>A(()=>k(V.get()))};return V},N=(y)=>!!y&&typeof y==="object"&&y[Symbol.toStringTag]===D;var F,Q=!1,W=new Set,R=(y)=>X(y)||N(y),G=(y)=>{if(F)y.add(F)},H=(y)=>y.forEach((x)=>Q?W.add(x):x()),I=(y,x)=>{let B=F;F=x,y(),F=B},U=(y)=>{Q=!0,y(),Q=!1,W.forEach((x)=>x()),W.clear()};class J{y;watchers=new Set;constructor(y){this.value=y}get(){return G(this.watchers),this.value}set(y){let x=K(y)?y(this.value):y;if(Object.is(this.value,x))return;this.value=x,H(this.watchers)}map(y){return A(()=>y(this.get()))}}var T=(y)=>new J(y),X=q(J);var E=(y)=>{let x=()=>I(()=>{try{y()}catch(B){console.error(B)}},x);x()};export{T as state,X as isState,R as isSignal,N as isComputed,E as effect,A as computed,U as batch,J as State};
