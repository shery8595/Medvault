import{d5 as n,d0 as B,d1 as O,d3 as q,dw as V,ds as F,d2 as r,dI as h,d7 as x,dF as K,du as z,dn as b}from"./index-BVRIVDa-.js";import{F as X}from"./EnvelopeIcon-DdsG2Yu5.js";import{F as Y}from"./PhoneIcon-D86z2cfg.js";import{o as H}from"./Layouts-BlFm53ED-pn_JZIy9.js";import{n as Q}from"./Link-DJ5gq9Di-Bwbsg0iQ.js";import{a as Z}from"./shouldProceedtoEmbeddedWalletCreationFlow-D4zUq_7a-BaZjXJq8.js";import{n as G}from"./ScreenLayout-DuL-17Ts-YZiz1QA2.js";import"./d3-vendor-DZmnY0jj.js";import"./ModalHeader-BZvDE1Dr-C9GI8sgo.js";import"./Screen-qXNc802H-CrM6s9cM.js";import"./index-Dq_xe9dz-CPmJYUFp.js";function J({title:o,titleId:d,...w},u){return n.createElement("svg",Object.assign({xmlns:"http://www.w3.org/2000/svg",viewBox:"0 0 20 20",fill:"currentColor","aria-hidden":"true","data-slot":"icon",ref:u,"aria-labelledby":d},w),o?n.createElement("title",{id:d},o):null,n.createElement("path",{fillRule:"evenodd",d:"M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z",clipRule:"evenodd"}))}const ee=n.forwardRef(J),re=({contactMethod:o,authFlow:d,emailDomain:w,appName:u="Privy",whatsAppEnabled:R=!1,onBack:y,onCodeSubmit:k,onResend:I,errorMessage:p,success:f=!1,resendCountdown:j=0,onInvalidInput:M,onClearError:T})=>{let[c,S]=n.useState(U);n.useEffect((()=>{p||S(U)}),[p]);let g=async v=>{v.preventDefault();let a=v.currentTarget.value.replace(" ","");if(a==="")return;if(isNaN(Number(a)))return void M?.("Code should be numeric");T?.();let m=Number(v.currentTarget.name?.charAt(5)),i=[...a||[""]].slice(0,P-m),s=[...c.slice(0,m),...i,...c.slice(m+i.length)];S(s);let E=Math.min(Math.max(m+i.length,0),P-1);isNaN(Number(v.currentTarget.value))||document.querySelector(`input[name=code-${E}]`)?.focus(),s.every((l=>l&&!isNaN(+l)))&&(document.querySelector(`input[name=code-${E}]`)?.blur(),await k?.(s.join("")))};return r.jsx(G,{title:"Enter confirmation code",subtitle:r.jsxs("span",d==="email"?{children:["Please check ",r.jsx(W,{children:o})," for an email from"," ",w??"privy.io"," and enter your code below."]}:{children:["Please check ",r.jsx(W,{children:o})," for a",R?" WhatsApp":""," message from ",u," and enter your code below."]}),icon:d==="email"?X:Y,onBack:y,showBack:!0,helpText:r.jsxs(se,{children:[r.jsxs("span",{children:["Didn't get ",d==="email"?"an email":"a message","?"]}),j?r.jsxs(le,{children:[r.jsx(ee,{color:"var(--privy-color-foreground)",strokeWidth:1.33,height:"12px",width:"12px"}),r.jsx("span",{children:"Code sent"})]}):r.jsx(Q,{as:"button",size:"sm",onClick:I,children:"Resend code"})]}),children:r.jsx(te,{children:r.jsx(H,{children:r.jsxs(ne,{children:[r.jsx("div",{children:c.map(((v,a)=>r.jsx("input",{name:`code-${a}`,type:"text",value:c[a],onChange:g,onKeyUp:m=>{m.key==="Backspace"&&(i=>{T?.(),S([...c.slice(0,i),"",...c.slice(i+1)]),i>0&&document.querySelector(`input[name=code-${i-1}]`)?.focus()})(a)},inputMode:"numeric",autoFocus:a===0,pattern:"[0-9]",className:`${f?"success":""} ${p?"fail":""}`,autoComplete:z.isMobile?"one-time-code":"off"},a)))}),r.jsx(ie,{$fail:!!p,$success:f,children:r.jsx("span",{children:p==="Invalid or expired verification code"?"Incorrect code":p||(f?"Success!":"")})})]})})})})};let P=6,U=Array(6).fill("");var C,A,oe=((C=oe||{})[C.RESET_AFTER_DELAY=0]="RESET_AFTER_DELAY",C[C.CLEAR_ON_NEXT_VALID_INPUT=1]="CLEAR_ON_NEXT_VALID_INPUT",C),ae=((A=ae||{})[A.EMAIL=0]="EMAIL",A[A.SMS=1]="SMS",A);const Ee={component:()=>{let{navigate:o,lastScreen:d,navigateBack:w,setModalData:u,onUserCloseViaDialogOrKeybindRef:R}=B(),y=O(),{closePrivyModal:k,resendEmailCode:I,resendSmsCode:p,getAuthMeta:f,loginWithCode:j,updateWallets:M,createAnalyticsEvent:T}=q(),{authenticated:c,logout:S,user:g}=V(),{whatsAppEnabled:v}=O(),[a,m]=n.useState(!1),[i,s]=n.useState(null),[E,l]=n.useState(null),[N,D]=n.useState(0);R.current=()=>null;let _=f()?.email?0:1,L=_===0?f()?.email||"":f()?.phoneNumber||"",$=F-500;return n.useEffect((()=>{if(N){let t=setTimeout((()=>{D(N-1)}),1e3);return()=>clearTimeout(t)}}),[N]),n.useEffect((()=>{if(c&&a&&g){if(y?.legal.requireUsersAcceptTerms&&!g.hasAcceptedTerms){let t=setTimeout((()=>{o("AffirmativeConsentScreen")}),$);return()=>clearTimeout(t)}if(Z(g,y.embeddedWallets)){let t=setTimeout((()=>{u({createWallet:{onSuccess:()=>{},onFailure:e=>{console.error(e),T({eventName:"embedded_wallet_creation_failure_logout",payload:{error:e,screen:"AwaitingPasswordlessCodeScreen"}}),S()},callAuthOnSuccessOnClose:!0}}),o("EmbeddedWalletOnAccountCreateScreen")}),$);return()=>clearTimeout(t)}{M();let t=setTimeout((()=>k({shouldCallAuthOnSuccess:!0,isSuccess:!0})),F);return()=>clearTimeout(t)}}}),[c,a,g]),n.useEffect((()=>{if(i&&E===0){let t=setTimeout((()=>{s(null),l(null),document.querySelector("input[name=code-0]")?.focus()}),1400);return()=>clearTimeout(t)}}),[i,E]),r.jsx(re,{contactMethod:L,authFlow:_===0?"email":"sms",emailDomain:y?.appearance.emailDomain,appName:y?.name,whatsAppEnabled:v,onBack:()=>w(),onCodeSubmit:async t=>{try{await j(t),m(!0)}catch(e){if(e instanceof h&&e.privyErrorCode===x.INVALID_CREDENTIALS)s("Invalid or expired verification code"),l(0);else if(e instanceof h&&e.privyErrorCode===x.CANNOT_LINK_MORE_OF_TYPE)s(e.message);else{if(e instanceof h&&e.privyErrorCode===x.USER_LIMIT_REACHED)return console.error(new K(e).toString()),void o("UserLimitReachedScreen");if(e instanceof h&&e.privyErrorCode===x.USER_DOES_NOT_EXIST)return void o("AccountNotFoundScreen");if(e instanceof h&&e.privyErrorCode===x.LINKED_TO_ANOTHER_USER)return u({errorModalData:{error:e,previousScreen:d??"AwaitingPasswordlessCodeScreen"}}),void o("ErrorScreen",!1);if(e instanceof h&&e.privyErrorCode===x.DISALLOWED_PLUS_EMAIL)return u({inlineError:{error:e}}),void o("ConnectOrCreateScreen",!1);if(e instanceof h&&e.privyErrorCode===x.ACCOUNT_TRANSFER_REQUIRED&&e.data?.data?.nonce)return u({accountTransfer:{nonce:e.data?.data?.nonce,account:L,displayName:e.data?.data?.account?.displayName,linkMethod:_===0?"email":"sms",embeddedWalletAddress:e.data?.data?.otherUser?.embeddedWalletAddress}}),void o("LinkConflictScreen");s("Issue verifying code"),l(0)}}},onResend:async()=>{D(30),_===0?await I():await p()},errorMessage:i||void 0,success:a,resendCountdown:N,onInvalidInput:t=>{s(t),l(1)},onClearError:()=>{E===1&&(s(null),l(null))}})}};let te=b.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: auto;
  gap: 16px;
  flex-grow: 1;
  width: 100%;
`,ne=b.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 12px;

  > div:first-child {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    border-radius: var(--privy-border-radius-sm);

    > input {
      border: 1px solid var(--privy-color-foreground-4);
      background: var(--privy-color-background);
      border-radius: var(--privy-border-radius-sm);
      padding: 8px 10px;
      height: 48px;
      width: 40px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: var(--privy-color-foreground);
      transition: all 0.2s ease;
    }

    > input:focus {
      border: 1px solid var(--privy-color-foreground);
      box-shadow: 0 0 0 1px var(--privy-color-foreground);
    }

    > input:invalid {
      border: 1px solid var(--privy-color-error);
    }

    > input.success {
      border: 1px solid var(--privy-color-border-success);
      background: var(--privy-color-success-bg);
    }

    > input.fail {
      border: 1px solid var(--privy-color-border-error);
      background: var(--privy-color-error-bg);
      animation: shake 180ms;
      animation-iteration-count: 2;
    }
  }

  @keyframes shake {
    0% {
      transform: translate(1px, 0px);
    }
    33% {
      transform: translate(-1px, 0px);
    }
    67% {
      transform: translate(-1px, 0px);
    }
    100% {
      transform: translate(1px, 0px);
    }
  }
`,ie=b.div`
  line-height: 20px;
  min-height: 20px;
  font-size: 14px;
  font-weight: 400;
  color: ${o=>o.$success?"var(--privy-color-success-dark)":o.$fail?"var(--privy-color-error-dark)":"transparent"};
  display: flex;
  justify-content: center;
  width: 100%;
  text-align: center;
`,se=b.div`
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: var(--privy-color-foreground-2);
`,le=b.div`
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--privy-border-radius-sm);
  padding: 2px 8px;
  gap: 4px;
  background: var(--privy-color-background-2);
  color: var(--privy-color-foreground-2);
`,W=b.span`
  font-weight: 500;
  word-break: break-all;
  color: var(--privy-color-foreground);
`;export{Ee as AwaitingPasswordlessCodeScreen,re as AwaitingPasswordlessCodeScreenView,Ee as default};
