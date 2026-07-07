import{d5 as a,dw as I,d3 as T,d0 as _,d2 as e,ei as E,ej as F,dQ as U,dn as u,dZ as W}from"./index-BVRIVDa-.js";import{F as N}from"./ShieldCheckIcon-CBUdfLBm.js";import{m as O}from"./ModalHeader-BZvDE1Dr-C9GI8sgo.js";import{l as V}from"./Layouts-BlFm53ED-pn_JZIy9.js";import{g as H,h as M,u as z,b as B,k as D}from"./shared-DtdK1RfM-xle5J_LS.js";import{w as s}from"./Screen-qXNc802H-CrM6s9cM.js";import"./d3-vendor-DZmnY0jj.js";import"./index-Dq_xe9dz-CPmJYUFp.js";const te={component:()=>{let[o,h]=a.useState(!0),{authenticated:p,user:j}=I(),{walletProxy:y,closePrivyModal:m,createAnalyticsEvent:v,client:b}=T(),{navigate:g,data:k,onUserCloseViaDialogOrKeybindRef:A}=_(),[n,C]=a.useState(void 0),[x,l]=a.useState(""),[d,f]=a.useState(!1),{entropyId:c,entropyIdVerifier:$,onCompleteNavigateTo:w,onSuccess:P,onFailure:S}=k.recoverWallet,i=(r="User exited before their wallet could be recovered")=>{m({shouldCallAuthOnSuccess:!1}),S(typeof r=="string"?new U(r):r)};return A.current=i,a.useEffect((()=>{if(!p)return i("User must be authenticated and have a Privy wallet before it can be recovered")}),[p]),e.jsxs(s,{children:[e.jsx(s.Header,{icon:N,title:"Enter your password",subtitle:"Please provision your account on this new device. To continue, enter your recovery password.",showClose:!0,onClose:i}),e.jsx(s.Body,{children:e.jsx(K,{children:e.jsxs("div",{children:[e.jsxs(H,{children:[e.jsx(M,{type:o?"password":"text",onChange:r=>(t=>{t&&C(t)})(r.target.value),disabled:d,style:{paddingRight:"2.3rem"}}),e.jsx(z,{style:{right:"0.75rem"},children:o?e.jsx(B,{onClick:()=>h(!1)}):e.jsx(D,{onClick:()=>h(!0)})})]}),!!x&&e.jsx(L,{children:x})]})})}),e.jsxs(s.Footer,{children:[e.jsx(s.HelpText,{children:e.jsxs(V,{children:[e.jsx("h4",{children:"Why is this necessary?"}),e.jsx("p",{children:"You previously set a password for this wallet. This helps ensure only you can access it"})]})}),e.jsx(s.Actions,{children:e.jsx(Q,{loading:d||!y,disabled:!n,onClick:async()=>{f(!0);let r=await b.getAccessToken(),t=E(j,c);if(!r||!t||n===null)return i("User must be authenticated and have a Privy wallet before it can be recovered");try{v({eventName:"embedded_wallet_recovery_started",payload:{walletAddress:t.address}}),await y?.recover({accessToken:r,entropyId:c,entropyIdVerifier:$,recoveryPassword:n}),l(""),w?g(w):m({shouldCallAuthOnSuccess:!1}),P?.(t),v({eventName:"embedded_wallet_recovery_completed",payload:{walletAddress:t.address}})}catch(R){F(R)?l("Invalid recovery password, please try again."):l("An error has occurred, please try again.")}finally{f(!1)}},$hideAnimations:!c&&d,children:"Recover your account"})}),e.jsx(s.Watermark,{})]})]})}};let K=u.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`,L=u.div`
  line-height: 20px;
  height: 20px;
  font-size: 13px;
  color: var(--privy-color-error);
  text-align: left;
  margin-top: 0.5rem;
`,Q=u(O)`
  ${({$hideAnimations:o})=>o&&W`
      && {
        // Remove animations because the recoverWallet task on the iframe partially
        // blocks the renderer, so the animation stutters and doesn't look good
        transition: none;
      }
    `}
`;export{te as PasswordRecoveryScreen,te as default};
