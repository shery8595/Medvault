import{dn as a,dw as C,f2 as E,d3 as I,d5 as h,d2 as e,d6 as v,d7 as k,dZ as b,f3 as L}from"./index-BVRIVDa-.js";import{a as P,c as x}from"./TodoList-CgrU7uwu-DZFw5OHw.js";import{n as S}from"./ScreenLayout-DuL-17Ts-YZiz1QA2.js";import{C as N}from"./circle-check-big-CaIMZrix.js";import{F as w}from"./fingerprint-pattern-CRXrirPw.js";import{c as A}from"./createLucideIcon-DSpYPgnX.js";import"./d3-vendor-DZmnY0jj.js";import"./check-CA126qK8.js";import"./ModalHeader-BZvDE1Dr-C9GI8sgo.js";import"./Screen-qXNc802H-CrM6s9cM.js";import"./index-Dq_xe9dz-CPmJYUFp.js";/**
 * @license lucide-react v0.554.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const M=[["path",{d:"M10 11v6",key:"nco0om"}],["path",{d:"M14 11v6",key:"outv1u"}],["path",{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",key:"miytrc"}],["path",{d:"M3 6h18",key:"d0wm0j"}],["path",{d:"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",key:"e791ji"}]],B=A("trash-2",M),T=({passkeys:o,isLoading:d,errorReason:u,success:y,expanded:n,onLinkPasskey:l,onUnlinkPasskey:s,onExpand:r,onBack:t,onClose:i})=>e.jsx(S,y?{title:"Passkeys updated",icon:N,iconVariant:"success",primaryCta:{label:"Done",onClick:i},onClose:i,watermark:!0}:n?{icon:w,title:"Your passkeys",onBack:t,onClose:i,watermark:!0,children:e.jsx(j,{passkeys:o,expanded:n,onUnlink:s,onExpand:r})}:{icon:w,title:"Set up passkey verification",subtitle:"Verify with passkey",primaryCta:{label:"Add new passkey",onClick:l,loading:d},onClose:i,watermark:!0,helpText:u||void 0,children:o.length===0?e.jsx(W,{}):e.jsx(U,{children:e.jsx(j,{passkeys:o,expanded:n,onUnlink:s,onExpand:r})})});let U=a.div`
  margin-bottom: 12px;
`,j=({passkeys:o,expanded:d,onUnlink:u,onExpand:y})=>{let[n,l]=h.useState([]),s=d?o.length:2;return e.jsxs("div",{children:[e.jsx(z,{children:"Your passkeys"}),e.jsxs(V,{children:[o.slice(0,s).map((r=>{return e.jsxs(F,{children:[e.jsxs("div",{children:[e.jsx(O,{children:(t=r,t.authenticatorName?t.createdWithBrowser?`${t.authenticatorName} on ${t.createdWithBrowser}`:t.authenticatorName:t.createdWithBrowser?t.createdWithOs?`${t.createdWithBrowser} on ${t.createdWithOs}`:`${t.createdWithBrowser}`:"Unknown device")}),e.jsxs(D,{children:["Last used:"," ",(r.latestVerifiedAt??r.firstVerifiedAt)?.toLocaleString()??"N/A"]})]}),e.jsx(Y,{disabled:n.includes(r.credentialId),onClick:()=>(async i=>{l((p=>p.concat([i]))),await u(i),l((p=>p.filter((f=>f!==i))))})(r.credentialId),children:n.includes(r.credentialId)?e.jsx(L,{}):e.jsx(B,{size:16})})]},r.credentialId);var t})),o.length>2&&!d&&e.jsx($,{onClick:y,children:"View all"})]})]})},W=()=>e.jsxs(P,{style:{color:"var(--privy-color-foreground)"},children:[e.jsx(x,{children:"Verify with Touch ID, Face ID, PIN, or hardware key"}),e.jsx(x,{children:"Takes seconds to set up and use"}),e.jsx(x,{children:"Use your passkey to verify transactions and login to your account"})]});const ne={component:()=>{let{user:o}=C(),{unlink:d}=E(),{linkWithPasskey:u,closePrivyModal:y}=I(),n=o?.linkedAccounts.filter((c=>c.type==="passkey")),[l,s]=h.useState(!1),[r,t]=h.useState(""),[i,p]=h.useState(!1),[f,m]=h.useState(!1);return h.useEffect((()=>{n.length===0&&m(!1)}),[n.length]),e.jsx(T,{passkeys:n,isLoading:l,errorReason:r,success:i,expanded:f,onLinkPasskey:()=>{s(!0),u().then((()=>p(!0))).catch((c=>{if(c instanceof v){if(c.privyErrorCode===k.CANNOT_LINK_MORE_OF_TYPE)return void t("Cannot link more passkeys to account.");if(c.privyErrorCode===k.PASSKEY_NOT_ALLOWED)return void t("Passkey request timed out or rejected by user.")}t("Unknown error occurred.")})).finally((()=>{s(!1)}))},onUnlinkPasskey:async c=>(s(!0),await d({credentialId:c}).then((()=>p(!0))).catch((g=>{g instanceof v&&g.privyErrorCode===k.MISSING_MFA_CREDENTIALS?t("Cannot unlink a passkey enrolled in MFA"):t("Unknown error occurred.")})).finally((()=>{s(!1)}))),onExpand:()=>m(!0),onBack:()=>m(!1),onClose:()=>y()})}},ie=a.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 180px;
  height: 90px;
  border-radius: 50%;
  svg + svg {
    margin-left: 12px;
  }
  > svg {
    z-index: 2;
    color: var(--privy-color-accent) !important;
    stroke: var(--privy-color-accent) !important;
    fill: var(--privy-color-accent) !important;
  }
`;let _=b`
  && {
    width: 100%;
    font-size: 0.875rem;
    line-height: 1rem;

    /* Tablet and Up */
    @media (min-width: 440px) {
      font-size: 14px;
    }

    display: flex;
    gap: 12px;
    justify-content: center;

    padding: 6px 8px;
    background-color: var(--privy-color-background);
    transition: background-color 200ms ease;
    color: var(--privy-color-accent) !important;

    :focus {
      outline: none;
      box-shadow: none;
    }
  }
`;const $=a.button`
  ${_}
`;let V=a.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.8rem;
  padding: 0.5rem 0rem 0rem;
  flex-grow: 1;
  width: 100%;
`,z=a.div`
  line-height: 20px;
  height: 20px;
  font-size: 1em;
  font-weight: 450;
  display: flex;
  justify-content: flex-beginning;
  width: 100%;
`,O=a.div`
  font-size: 1em;
  line-height: 1.3em;
  font-weight: 500;
  color: var(--privy-color-foreground-2);
  padding: 0.2em 0;
`,D=a.div`
  font-size: 0.875rem;
  line-height: 1rem;
  color: #64668b;
  padding: 0.2em 0;
`,F=a.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1em;
  gap: 10px;
  font-size: 0.875rem;
  line-height: 1rem;
  text-align: left;
  border-radius: 8px;
  border: 1px solid #e2e3f0 !important;
  width: 100%;
  height: 5em;
`,R=b`
  :focus,
  :hover,
  :active {
    outline: none;
  }
  display: flex;
  width: 2em;
  height: 2em;
  justify-content: center;
  align-items: center;
  svg {
    color: var(--privy-color-error);
  }
  svg:hover {
    color: var(--privy-color-foreground-3);
  }
`,Y=a.button`
  ${R}
`;export{ie as DoubleIconWrapper,$ as LinkButton,ne as LinkPasskeyScreen,T as LinkPasskeyView,ne as default};
