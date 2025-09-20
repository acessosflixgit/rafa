document.addEventListener('DOMContentLoaded', () => {
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function parsePrecoBR(v){ if(typeof v==='number')return v; let s=String(v??'').trim().replace(/[R$\s]/g,''); if(!s)return 0; const hasComma=s.includes(','); const hasDot=s.includes('.'); if(hasComma&&hasDot){const lastComma=s.lastIndexOf(','); const lastDot=s.lastIndexOf('.'); if(lastComma>lastDot){s=s.replace(/\./g,'').replace(',','.')}else{s=s.replace(/,/g,'')}}else if(hasComma){s=s.replace(/\./g,'').replace(',','.')}else{s=s.replace(/,/g,'')} return parseFloat(s)||0}
  function round2(n){ return Math.round((Number(n)+Number.EPSILON)*100)/100 }
  async function copyToClipboard(text){ try{ if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text)}else{ const ta=document.createElement('textarea'); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)} return true }catch{ return false }}
  function onlyDigits(v){ return String(v||'').replace(/\D/g,'') }
  function getCookie(name){ const m=document.cookie.match(new RegExp('(^| )'+name+'=([^;]+)')); return m?decodeURIComponent(m[2]):null }
  function getParamValue(key){ const url=new URLSearchParams(window.location.search); return url.get(key)||localStorage.getItem(key)||getCookie(key)||null }

  const checkoutForm=document.getElementById('checkout-form');
  const btnOferta=document.getElementById('btn-oferta');
  const cartExtra=document.getElementById('cart-extra');
  const valorTotalDisplay=document.getElementById('valor-total');
  const btnGenerate=document.querySelector('.btn-generate');
  const btnSecure=document.querySelector('.secure-btn');
  const formWrapper=document.getElementById('form-wrapper');
  const pixWrapper=document.getElementById('pix-wrapper');
  const pixQrCodeImg=document.getElementById('pix-qr-code');
  const pixCopyPasteInput=document.getElementById('pix-copy-paste');
  const copyPixBtn=document.getElementById('copy-pix-btn');
  const paymentStatusDiv=document.getElementById('payment-status');

  const precoBase=(()=>{ const baseEl=document.querySelector('.cart-summary .cart-item .item-price'); return baseEl?parsePrecoBR(baseEl.textContent):24.90 })();
  let valorFinal=precoBase;
  let transactionId=null;
  let verificationInterval=null;

  function renderTotal(){ if(valorTotalDisplay) valorTotalDisplay.textContent=brl.format(round2(valorFinal)) }
  renderTotal();

  if(btnOferta){
    const precoOferta=parsePrecoBR(btnOferta.dataset.preco ?? btnOferta.getAttribute('data-preco'));
    const offerName=document.querySelector('.offer-card .offer-info .name')?.textContent.trim()||'Entrega Expressa';
    const offerSub=document.querySelector('.offer-card .offer-info .sub')?.textContent.trim()||'Correios';
    const offerLogo='images/minis.png';
    btnOferta.addEventListener('click',()=>{
      if(!Number.isFinite(precoOferta)||precoOferta<=0){ return }
      const ativou=btnOferta.classList.toggle('is-selected');
      if(ativou){
        valorFinal=round2(valorFinal+precoOferta);
        if(cartExtra){ cartExtra.innerHTML=`<div class="cart-item" id="extra-oferta"><div class="item-left"><img src="${offerLogo}" alt="${offerSub}" class="item-logo"><div class="item-info"><div class="label">${offerName}</div><div class="sub">${offerSub}</div></div></div><div class="item-price">${brl.format(precoOferta)}</div></div>`}
        btnOferta.textContent='Selecionado';
        btnOferta.setAttribute('aria-pressed','true');
      }else{
        valorFinal=round2(Math.max(0,valorFinal-precoOferta));
        const extra=document.getElementById('extra-oferta');
        if(extra) extra.remove(); else if(cartExtra) cartExtra.innerHTML='';
        btnOferta.textContent='Selecionar';
        btnOferta.setAttribute('aria-pressed','false');
      }
      renderTotal();
    });
  }

  if(btnSecure&&checkoutForm){
    btnSecure.addEventListener('click',(e)=>{
      e.preventDefault();
      if(typeof checkoutForm.requestSubmit==='function'){ checkoutForm.requestSubmit() }
      else{ const tmp=document.createElement('button'); tmp.type='submit'; tmp.style.display='none'; checkoutForm.appendChild(tmp); tmp.click(); tmp.remove() }
    });
  }

  if(checkoutForm){
    checkoutForm.addEventListener('submit',async(event)=>{
      event.preventDefault();
      if(btnGenerate){ btnGenerate.disabled=true; btnGenerate.textContent='Gerando...' }
      const customerName=document.getElementById('nome')?.value||'';
      const customerCpf=document.getElementById('cpf')?.value||'';
      const customerEmail=document.getElementById('email')?.value||localStorage.getItem('email')||'lead@email.com';
      const productName=document.querySelector('.cart-summary .cart-item .label')?.textContent.trim()||'Produto';
      const productId=(productName||'produto').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'')||'produto-principal';
      try{
        const ipResponse=await fetch('https://api.ipify.org?format=json');
        const ipData=await ipResponse.json();
        const clientIp=ipData.ip;
        const payload={ amount: round2(valorFinal), customer_name: customerName, customer_cpf: customerCpf, ip: clientIp };
        const response=await fetch('getPayment.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        const result=await response.json();
        if(result && result.pix && result.pix.qrcode){
          const pixCode=result.pix.qrcode;
          transactionId=result.id;
          if(pixQrCodeImg){ pixQrCodeImg.src=`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixCode)}` }
          if(pixCopyPasteInput) pixCopyPasteInput.value=pixCode;
          if(formWrapper) formWrapper.classList.add('hidden');
          if(pixWrapper) pixWrapper.classList.remove('hidden');

          const cents=Math.round(round2(valorFinal)*100);
          const payloadPendente={
            orderId: transactionId,
            customer:{ name: customerName, email: customerEmail, document: onlyDigits(customerCpf) },
            products:[{ id: productId, name: productName, quantity:1, priceInCents: cents }],
            trackingParameters:{
              src:getParamValue('src'), sck:getParamValue('sck'),
              utm_source:getParamValue('utm_source'), utm_campaign:getParamValue('utm_campaign'),
              utm_medium:getParamValue('utm_medium'), utm_content:getParamValue('utm_content'),
              utm_term:getParamValue('utm_term'), xcod:getParamValue('xcod'),
              fbclid:getParamValue('fbclid'), gclid:getParamValue('gclid'), ttclid:getParamValue('ttclid')
            },
            commission:{ totalPriceInCents:cents, gatewayFeeInCents:0, userCommissionInCents:cents }
          };
          try{ fetch('/utmify-pendente.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payloadPendente) }).catch(()=>{}) }catch(_){}

          startPaymentVerification();
        }else{
          alert(`Erro ao gerar PIX: ${result?.message||'Tente novamente.'}`);
          if(btnGenerate){ btnGenerate.disabled=false; btnGenerate.textContent='Gerar PIX' }
        }
      }catch(error){
        alert('Ocorreu um erro de comunicação. Tente novamente.');
        if(btnGenerate){ btnGenerate.disabled=false; btnGenerate.textContent='Gerar PIX' }
      }
    });
  }

  if(copyPixBtn){
    copyPixBtn.addEventListener('click',async()=>{
      const ok=await copyToClipboard(pixCopyPasteInput?.value||'');
      copyPixBtn.textContent=ok?'Copiado!':'Falhou :(';
      setTimeout(()=>{ copyPixBtn.textContent='Copiar Código' },2000);
    });
  }

  function startPaymentVerification(){
    if(verificationInterval) clearInterval(verificationInterval);
    verificationInterval=setInterval(async()=>{
      if(!transactionId) return;
      try{
        const response=await fetch(`verifyPayment.php?id=${transactionId}`);
        const result=await response.json();
        if(result.paid===true){
          clearInterval(verificationInterval);
          if(paymentStatusDiv){ paymentStatusDiv.textContent='Pagamento Aprovado!'; paymentStatusDiv.style.color='green' }

          const customerName=document.getElementById('nome')?.value||'';
          const customerCpf=document.getElementById('cpf')?.value||'';
          const customerEmail=document.getElementById('email')?.value||localStorage.getItem('email')||'lead@email.com';
          const productName=document.querySelector('.cart-summary .cart-item .label')?.textContent.trim()||'Produto';
          const productId=(productName||'produto').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,'')||'produto-principal';
          const cents=Math.round(round2(valorFinal)*100);

          const payloadPago={
            status:'paid',
            orderId: transactionId,
            customer:{ name: customerName, email: customerEmail, document: onlyDigits(customerCpf) },
            products:[{ id: productId, name: productName, quantity:1, priceInCents: cents }],
            trackingParameters:{
              src:getParamValue('src'), sck:getParamValue('sck'),
              utm_source:getParamValue('utm_source'), utm_campaign:getParamValue('utm_campaign'),
              utm_medium:getParamValue('utm_medium'), utm_content:getParamValue('utm_content'),
              utm_term:getParamValue('utm_term'), xcod:getParamValue('xcod'),
              fbclid:getParamValue('fbclid'), gclid:getParamValue('gclid'), ttclid:getParamValue('ttclid')
            },
            commission:{ totalPriceInCents:cents, gatewayFeeInCents:0, userCommissionInCents:cents }
          };
          try{ fetch('/utmify.php',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payloadPago) }).catch(()=>{}) }catch(_){}

          setTimeout(()=>{ window.location.href='/obrigado' },2000);
        }
      }catch(error){}
    },5000);
  }
});