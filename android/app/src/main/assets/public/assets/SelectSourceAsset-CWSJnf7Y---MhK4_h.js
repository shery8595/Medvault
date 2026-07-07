import{dz as y,d2 as e,f5 as g,d5 as m,dn as o}from"./index-BVRIVDa-.js";import{n as j}from"./ScreenLayout-DuL-17Ts-YZiz1QA2.js";import{c as k}from"./createLucideIcon-DSpYPgnX.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const C=[["path",{d:"m6 9 6 6 6-6",key:"qrunsl"}]],A=k("chevron-down",C),H=async({operation:n,until:a,delay:i,interval:l,attempts:d,signal:f})=>{let c,u,t=0;for(;t<d;){if(f?.aborted)return{status:"aborted",result:c,attempts:t,error:u};t++;try{if(u=void 0,c=await n(),a(c))return{status:"success",result:c,attempts:t};t<d&&await y(l)}catch(h){h instanceof Error&&(u=h),t<d&&await y(l)}}return{status:"max_attempts",result:c,attempts:t,error:u}},I=({currency:n="usd",value:a,onChange:i,inputMode:l="decimal",autoFocus:d})=>{let[f,c]=m.useState("0"),u=m.useRef(null),t=a??f,h=g[n]?.symbol??"$",b=m.useCallback((s=>{let r=s.target.value,p=(r=r.replace(/[^\d.]/g,"")).split(".");p.length>2&&(r=p[0]+"."+p.slice(1).join("")),p.length===2&&p[1].length>2&&(r=`${p[0]}.${p[1].slice(0,2)}`),r.length>1&&r[0]==="0"&&r[1]!=="."&&(r=r.slice(1)),(r===""||r===".")&&(r="0"),i?i(r):c(r)}),[i]),w=m.useCallback((s=>{!(["Delete","Backspace","Tab","Escape","Enter",".","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Home","End"].includes(s.key)||(s.ctrlKey||s.metaKey)&&["a","c","v","x"].includes(s.key.toLowerCase()))&&(s.key>="0"&&s.key<="9"||s.preventDefault())}),[]),v=m.useMemo((()=>(t.includes("."),t)),[t]);return e.jsxs(S,{onClick:()=>u.current?.focus(),children:[e.jsx(x,{children:h}),v,e.jsx("input",{ref:u,type:"text",inputMode:l,value:v,onChange:b,onKeyDown:w,autoFocus:d,placeholder:"0",style:{width:1,height:"1rem",opacity:0,alignSelf:"center",fontSize:"1rem"}}),e.jsx(x,{style:{opacity:0},children:h})]})},N=({selectedAsset:n,onEditSourceAsset:a})=>{let{icon:i}=g[n];return e.jsxs(z,{onClick:a,children:[e.jsx(E,{children:i}),e.jsx(L,{children:n.toLocaleUpperCase()}),e.jsx(D,{children:e.jsx(A,{})})]})};let S=o.span`
  background-color: var(--privy-color-background);
  width: 100%;
  text-align: center;
  border: none;
  font-kerning: none;
  font-feature-settings: 'calt' off;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  cursor: pointer;

  &:focus {
    outline: none !important;
    border: none !important;
    box-shadow: none !important;
  }

  && {
    color: var(--privy-color-foreground);
    font-size: 3.75rem;
    font-style: normal;
    font-weight: 600;
    line-height: 5.375rem;
  }
`,x=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 1rem;
  font-style: normal;
  font-weight: 600;
  line-height: 1.5rem;
  margin-top: 0.75rem;
`,z=o.button`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: auto;
  gap: 0.5rem;
  border: 1px solid var(--privy-color-border-default);
  border-radius: var(--privy-border-radius-full);

  && {
    margin: auto;
    padding: 0.5rem 1rem;
  }
`,E=o.div`
  svg {
    width: 1rem;
    height: 1rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,L=o.span`
  color: var(--privy-color-foreground);
  font-kerning: none;
  font-feature-settings: 'calt' off;
  font-size: 0.875rem;
  font-style: normal;
  font-weight: 500;
  line-height: 1.375rem;
`,D=o.div`
  color: var(--privy-color-foreground);

  svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;const Z=({opts:n,isLoading:a,onSelectSource:i})=>e.jsx(j,{showClose:!1,showBack:!0,onBack:()=>i(n.source.selectedAsset),title:"Select currency",children:e.jsx(B,{children:n.source.assets.map((l=>{let{icon:d,name:f}=g[l];return e.jsx(K,{onClick:()=>i(l),disabled:a,children:e.jsxs(M,{children:[e.jsx(R,{children:d}),e.jsxs(U,{children:[e.jsx(_,{children:f}),e.jsx(F,{children:l.toLocaleUpperCase()})]})]})},l)}))})});let B=o.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  max-height: 20.875rem;
  overflow-y: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`,K=o.button`
  border-color: var(--privy-color-border-default);
  border-width: 1px;
  border-radius: var(--privy-border-radius-mdlg);
  border-style: solid;
  display: flex;

  && {
    padding: 0.75rem 1rem;
  }
`,M=o.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
`,R=o.div`
  svg {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: var(--privy-border-radius-full);
    overflow: hidden;
    border: solid 0.1px var(--privy-color-border-default);
  }
`,U=o.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`,_=o.span`
  color: var(--privy-color-foreground);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25rem;
`,F=o.span`
  color: var(--privy-color-foreground-3);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.125rem;
`;export{N as m,I as p,H as u,Z as w};
