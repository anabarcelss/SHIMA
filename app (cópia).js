// ============================================================================
// SHIMA Oriental (和食) — Aplicação Mobile-First (4 Telas)
// ============================================================================

const STORAGE_KEYS = {
  USER: 'shima_oriental_user_v1',
  CART: 'shima_oriental_cart_v1',
};

const SCREEN_HASH_MAP = {
  'screen-1': '#inicio',
  'screen-2': '#cadastro',
  'screen-3': '#login',
  'screen-4': '#cardapio',
};

const HASH_SCREEN_MAP = {
  '#inicio': 'screen-1',
  '#apresentacao': 'screen-1',
  '#cadastro': 'screen-2',
  '#login': 'screen-3',
  '#cardapio': 'screen-4',
};

const state = {
  currentScreen: 'screen-1',
  allScreensMode: false,
  pendingCategory: 'all',
  deliveryMode: 'delivery', // 'delivery' | 'pickup'
  deliveryFee: 9,
  lastOrderSummaryText: '',
  user: {
    loggedIn: false,
    name: 'Cliente SHIMA',
    phone: '',
    email: '',
    cep: '',
    street: 'Rua Harmonia',
    number: '531',
    comp: '',
    bairro: 'Vitoria-ES',
  },
  customCombo: {
    niguiri: { label: 'Niguiri (dupla)', price: 14, qty: 2 },
    sashimi: { label: 'Sashimi (3 fatias)', price: 18, qty: 1 },
    joy: { label: 'Joy (dupla)', price: 16, qty: 0 },
    hossomaki: { label: 'Hossomaki (4 pçs)', price: 15, qty: 0 },
    uramaki: { label: 'Uramaki (4 pçs)', price: 18, qty: 0 },
    hot: { label: 'Hot Roll (4 pçs)', price: 19, qty: 0 },
  },
  cart: [
    { id: 'combo-classico', name: 'Combo Clássico SHIMA (24 pçs)', price: 148, qty: 1 },
    { id: 'bolinha-6', name: 'Bolinha de Salmão Crocante (6 un.)', price: 34, qty: 1 },
  ],
};

// ----------------------------------------------------------------------------
// Persistência Local (localStorage)
// ----------------------------------------------------------------------------
function loadPersistedState() {
  try {
    const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      state.user = { ...state.user, ...parsedUser };
    }
    const savedCart = localStorage.getItem(STORAGE_KEYS.CART);
    if (savedCart) {
      const parsedCart = JSON.parse(savedCart);
      if (Array.isArray(parsedCart)) {
        state.cart = parsedCart;
      }
    }
  } catch (err) {
    console.warn('Aviso ao carregar estado local:', err);
  }
}

function saveUserState() {
  try {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
  } catch (err) {
    console.warn('Aviso ao salvar usuário:', err);
  }
}

function saveCartState() {
  try {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
  } catch (err) {
    console.warn('Aviso ao salvar carrinho:', err);
  }
}

// ----------------------------------------------------------------------------
// Navegação entre as 4 Telas e Roteamento por Hash
// ----------------------------------------------------------------------------
function goToScreen(screenId, updateHistory = true) {
  state.currentScreen = screenId;
  const stage = document.getElementById('screensStage');
  const toggleBtn = document.getElementById('toggleAllBtn');

  if (state.allScreensMode && stage) {
    state.allScreensMode = false;
    stage.classList.remove('all-screens-mode');
    if (toggleBtn) {
      toggleBtn.classList.remove('active');
      toggleBtn.textContent = 'Ver 4 telas lado a lado';
    }
  }

  document.querySelectorAll('.screen-wrapper').forEach((el) => {
    el.classList.toggle('active-screen', el.id === screenId);
  });

  document.querySelectorAll('.proto-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === screenId);
  });

  if (updateHistory) {
    const targetHash = SCREEN_HASH_MAP[screenId] || '#inicio';
    if (window.location.hash !== targetHash) {
      history.pushState({ screenId }, '', targetHash);
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Fluxo inteligente ao clicar em "Pedir agora" ou em um produto na Tela 1
function startOrderFlow(category = 'all') {
  state.pendingCategory = category || 'all';
  // Vai para a Tela 2 (Cadastro) conforme fluxo principal, ou se já logado vai ao Cardápio
  if (state.user.loggedIn) {
    goToScreen('screen-4');
    applyCategorySelection(state.pendingCategory);
  } else {
    goToScreen('screen-2');
  }
}

function applyCategorySelection(category) {
  const chip = document.querySelector(`.filter-chip[data-cat="${category}"]`);
  if (chip) {
    filterMenuCategory(category, chip);
  }
}

function toggleAllScreensMode() {
  state.allScreensMode = !state.allScreensMode;
  const stage = document.getElementById('screensStage');
  const btn = document.getElementById('toggleAllBtn');

  if (stage) stage.classList.toggle('all-screens-mode', state.allScreensMode);
  if (btn) {
    btn.classList.toggle('active', state.allScreensMode);
    btn.textContent = state.allScreensMode
      ? 'Voltar para visualização de 1 tela'
      : 'Ver 4 telas lado a lado';
  }
}

// ----------------------------------------------------------------------------
// Máscaras de Formulário e Busca Automática de CEP (ViaCEP)
// ----------------------------------------------------------------------------
function maskPhone(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 6) {
    v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
  } else if (v.length > 2) {
    v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
  } else if (v.length > 0) {
    v = `(${v}`;
  }
  input.value = v;
}

function maskCpf(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 11);
  if (v.length > 9) {
    v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
  } else if (v.length > 6) {
    v = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
  } else if (v.length > 3) {
    v = `${v.slice(0, 3)}.${v.slice(3)}`;
  }
  input.value = v;
}

async function handleCepInput(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) {
    input.value = `${digits.slice(0, 5)}-${digits.slice(5)}`;
  } else {
    input.value = digits;
  }

  const statusEl = document.getElementById('cepStatus');
  if (digits.length === 8) {
    if (statusEl) statusEl.textContent = 'Buscando...';
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (!data.erro) {
        const streetInput = document.getElementById('regStreet');
        const bairroInput = document.getElementById('regBairro');
        const numInput = document.getElementById('regNumber');
        if (streetInput && data.logradouro) streetInput.value = data.logradouro;
        if (bairroInput && data.bairro) bairroInput.value = data.bairro;
        if (statusEl) statusEl.textContent = '✓';
        if (numInput) numInput.focus();
      } else {
        if (statusEl) statusEl.textContent = '';
      }
    } catch {
      if (statusEl) statusEl.textContent = '';
    }
  } else if (statusEl) {
    statusEl.textContent = '';
  }
}

// ----------------------------------------------------------------------------
// Cadastro (Tela 2) e Login (Tela 3)
// ----------------------------------------------------------------------------
function syncUserHeaderUI() {
  const greetingEl = document.getElementById('customerGreetingName');
  const addressEl = document.getElementById('customerAddressText');
  const navLoginBtn = document.getElementById('navLoginBtn');

  const shortName = (state.user.name || 'Cliente').trim().split(' ').slice(0, 2).join(' ');
  if (greetingEl) greetingEl.textContent = shortName;

  const streetPart = state.user.street
    ? `${state.user.street}${state.user.number ? ', ' + state.user.number : ''}`
    : 'Vila Madalena, SP';
  if (addressEl) addressEl.textContent = streetPart;

  if (navLoginBtn) {
    navLoginBtn.textContent = state.user.loggedIn ? `Olá, ${shortName.split(' ')[0]}` : 'Entrar';
  }

  // Preenche campos caso o usuário edite seus dados
  const fields = {
    regName: state.user.name !== 'Cliente SHIMA' ? state.user.name : '',
    regPhone: state.user.phone,
    regEmail: state.user.email,
    regCep: state.user.cep,
    regBairro: state.user.bairro !== 'Vila Madalena' ? state.user.bairro : '',
    regStreet: state.user.street !== 'Rua Harmonia' ? state.user.street : '',
    regNumber: state.user.number !== '531' ? state.user.number : '',
    regComp: state.user.comp,
    loginIdentity: state.user.email || state.user.phone,
  };

  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && val && !el.value) {
      el.value = val;
    }
  });
}

function handleRegisterSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('regName')?.value.trim() || 'Cliente SHIMA';
  const phone = document.getElementById('regPhone')?.value.trim() || '';
  const email = document.getElementById('regEmail')?.value.trim() || '';
  const cep = document.getElementById('regCep')?.value.trim() || '';
  const bairro = document.getElementById('regBairro')?.value.trim() || 'Vila Madalena';
  const street = document.getElementById('regStreet')?.value.trim() || 'Rua Harmonia';
  const number = document.getElementById('regNumber')?.value.trim() || '';
  const comp = document.getElementById('regComp')?.value.trim() || '';

  state.user = {
    loggedIn: true,
    name,
    phone,
    email,
    cep,
    bairro,
    street,
    number,
    comp,
  };

  saveUserState();
  syncUserHeaderUI();
  showToast(`Bem-vindo(a), ${name.split(' ')[0]}! Cardápio liberado.`);
  goToScreen('screen-4');
  applyCategorySelection(state.pendingCategory);
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const identity = document.getElementById('loginIdentity')?.value.trim() || '';

  if (identity) {
    if (identity.includes('@')) {
      state.user.email = identity;
      if (state.user.name === 'Cliente SHIMA') {
        const prefix = identity.split('@')[0].replace(/[._-]/g, ' ');
        state.user.name = prefix.charAt(0).toUpperCase() + prefix.slice(1);
      }
    } else {
      state.user.phone = identity;
    }
  }

  state.user.loggedIn = true;
  saveUserState();
  syncUserHeaderUI();
  showToast('Login realizado com sucesso! Bom apetite.');
  goToScreen('screen-4');
  applyCategorySelection(state.pendingCategory);
}

function handleForgotPassword() {
  const identity = document.getElementById('loginIdentity')?.value.trim();
  if (!identity) {
    showToast('Digite seu e-mail ou WhatsApp acima para recuperar sua senha.');
    document.getElementById('loginIdentity')?.focus();
    return;
  }
  showToast(`Instruções de recuperação enviadas para ${identity}!`);
}

// ----------------------------------------------------------------------------
// Cardápio, Monte seu Combo e Carrinho (Tela 4)
// ----------------------------------------------------------------------------
function filterMenuCategory(category, btnEl) {
  document.querySelectorAll('.filter-chip').forEach((chip) => {
    chip.classList.toggle('active', chip === btnEl);
  });

  document.querySelectorAll('[data-category-section]').forEach((sec) => {
    const secCat = sec.getAttribute('data-category-section');
    if (category === 'all' || secCat === category) {
      sec.style.display = 'flex';
    } else {
      sec.style.display = 'none';
    }
  });
}

function changeComboPiece(key, delta) {
  const item = state.customCombo[key];
  if (!item) return;
  item.qty = Math.max(0, item.qty + delta);
  const el = document.getElementById(`qty-${key}`);
  if (el) el.textContent = String(item.qty);
  updateCustomComboSummary();
}

function updateCustomComboSummary() {
  let totalPortions = 0;
  let totalPrice = 0;

  Object.values(state.customCombo).forEach((item) => {
    totalPortions += item.qty;
    totalPrice += item.qty * item.price;
  });

  const descEl = document.getElementById('customComboDesc');
  const priceEl = document.getElementById('customComboPrice');
  if (descEl) {
    descEl.textContent =
      totalPortions === 1 ? '1 porção selecionada' : `${totalPortions} porções selecionadas`;
  }
  if (priceEl) {
    priceEl.textContent = `R$ ${totalPrice}`;
  }
}

function addCustomComboToCart() {
  const parts = [];
  let totalPrice = 0;

  Object.values(state.customCombo).forEach((item) => {
    if (item.qty > 0) {
      parts.push(`${item.qty}x ${item.label.split(' ')[0]}`);
      totalPrice += item.qty * item.price;
    }
  });

  if (totalPrice === 0) {
    showToast('Selecione pelo menos 1 porção para montar seu combo.');
    return;
  }

  const comboId = 'monte-combo-' + parts.join('-').toLowerCase();
  const comboName = `Monte seu Combo (${parts.join(', ')})`;
  addToCart(comboId, comboName, totalPrice);
}

function addToCart(id, name, price) {
  const existing = state.cart.find((item) => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ id, name, price, qty: 1 });
  }
  saveCartState();
  renderCart();
  showToast(`"${name}" adicionado ao carrinho!`);
}

function changeCartQty(id, delta) {
  const idx = state.cart.findIndex((item) => item.id === id);
  if (idx === -1) return;
  state.cart[idx].qty += delta;
  if (state.cart[idx].qty <= 0) {
    state.cart.splice(idx, 1);
  }
  saveCartState();
  renderCart();
}

function clearCart() {
  if (state.cart.length === 0) return;
  state.cart = [];
  saveCartState();
  renderCart();
  showToast('Carrinho esvaziado.');
}

function handleDeliveryModeChange(mode) {
  state.deliveryMode = mode === 'pickup' ? 'pickup' : 'delivery';
  renderCart();
}

function renderCart() {
  const container = document.getElementById('cartItemsContainer');
  if (!container) return;

  let totalItems = 0;
  let subtotal = 0;

  if (state.cart.length === 0) {
    container.innerHTML =
      '<p style="font-size:12px; color:#66645e; padding:8px 0;">Seu carrinho está vazio. Adicione combinados, temaki, yakissoba ou bolinha de salmão acima!</p>';
  } else {
    container.innerHTML = state.cart
      .map((item) => {
        totalItems += item.qty;
        const lineTotal = item.qty * item.price;
        subtotal += lineTotal;
        return `
          <div class="cart-line-item">
            <div class="cart-line-info">
              <h5>${item.name}</h5>
              <span>R$ ${item.price} cada · Total R$ ${lineTotal}</span>
            </div>
            <div class="cart-line-controls">
              <button type="button" class="cart-mini-btn" aria-label="Diminuir quantidade" onclick="changeCartQty('${item.id}', -1)">−</button>
              <strong style="font-size:12px; min-width:16px; text-align:center;">${item.qty}</strong>
              <button type="button" class="cart-mini-btn" aria-label="Aumentar quantidade" onclick="changeCartQty('${item.id}', 1)">+</button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  const isPickup = state.deliveryMode === 'pickup';
  const delivery = subtotal > 0 && !isPickup ? state.deliveryFee : 0;
  const grandTotal = subtotal + delivery;

  const navCount = document.getElementById('navCartCount');
  const headerSub = document.getElementById('cartHeaderSubtitle');
  const subText = document.getElementById('cartSubtotalText');
  const delLabel = document.getElementById('cartDeliveryLabel');
  const delText = document.getElementById('cartDeliveryText');
  const grandText = document.getElementById('cartGrandTotalText');
  const stickyCount = document.getElementById('stickyCartCount');
  const stickyTotal = document.getElementById('stickyCartTotal');
  const clearBtn = document.getElementById('clearCartBtn');

  if (navCount) navCount.textContent = String(totalItems);
  if (headerSub) {
    headerSub.textContent = `${totalItems} ${totalItems === 1 ? 'item adicionado' : 'itens adicionados'}`;
  }
  if (subText) subText.textContent = `R$ ${subtotal}`;
  if (delLabel) {
    delLabel.textContent = isPickup
      ? 'Retirada no balcão (Rua Harmonia, 531)'
      : `Taxa de entrega (${state.user.bairro || 'Vila Madalena'})`;
  }
  if (delText) delText.textContent = isPickup ? 'Grátis' : `R$ ${delivery}`;
  if (grandText) grandText.textContent = `R$ ${grandTotal}`;
  if (stickyCount) {
    stickyCount.textContent = `${totalItems} ${totalItems === 1 ? 'ITEM NO CARRINHO' : 'ITENS NO CARRINHO'}`;
  }
  if (stickyTotal) stickyTotal.textContent = `R$ ${grandTotal},00`;
  if (clearBtn) clearBtn.style.display = state.cart.length > 0 ? 'inline-block' : 'none';
}

function scrollToCart() {
  const cartEl = document.getElementById('cartSection');
  if (cartEl) {
    cartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ----------------------------------------------------------------------------
// Finalização do Pedido e Modal de Confirmação
// ----------------------------------------------------------------------------
function finalizeOrder() {
  if (state.cart.length === 0) {
    showToast('Adicione pelo menos 1 produto ao carrinho antes de finalizar!');
    return;
  }

  const orderCode = `#SHIMA-${Math.floor(1000 + Math.random() * 9000)}`;
  const paymentMethod = document.getElementById('paymentMethodSelect')?.value || 'PIX';
  const notes = document.getElementById('orderNotes')?.value.trim() || '';
  const isPickup = state.deliveryMode === 'pickup';

  let subtotal = 0;
  const itemLines = state.cart.map((item) => {
    const lineTotal = item.qty * item.price;
    subtotal += lineTotal;
    return `• ${item.qty}x ${item.name} — R$ ${lineTotal}`;
  });

  const delivery = isPickup ? 0 : state.deliveryFee;
  const grandTotal = subtotal + delivery;

  const addressLine = isPickup
    ? 'Retirada no balcão (Rua Harmonia, 531 - Vila Madalena)'
    : `${state.user.street}, ${state.user.number}${state.user.comp ? ' (' + state.user.comp + ')' : ''} - ${state.user.bairro}`;

  // Preenche o Modal
  const codeEl = document.getElementById('modalOrderCode');
  const subEl = document.getElementById('modalCustomerSummary');
  const listEl = document.getElementById('modalItemsList');
  const modalOverlay = document.getElementById('orderModalOverlay');

  if (codeEl) codeEl.textContent = orderCode;
  if (subEl) {
    subEl.innerHTML = isPickup
      ? `Obrigado, <strong>${state.user.name.split(' ')[0]}</strong>! Seu pedido estará pronto para retirada em <strong>25–30 min</strong>.`
      : `Obrigado, <strong>${state.user.name.split(' ')[0]}</strong>! Entrega estimada em <strong>35–45 min</strong> em ${addressLine}.`;
  }
  if (listEl) {
    listEl.innerHTML = `
      <div style="margin-bottom:8px;"><strong>Itens do pedido:</strong><br/>${itemLines.join('<br/>')}</div>
      <div style="border-top:1px solid #cfc8bd; padding-top:6px;">
        <strong>Pagamento:</strong> ${paymentMethod}<br/>
        ${notes ? `<strong>Obs.:</strong> ${notes}<br/>` : ''}
        <strong>Total: R$ ${grandTotal},00</strong>
      </div>
    `;
  }

  // Monta mensagem formatada para WhatsApp
  state.lastOrderSummaryText = [
    `*Novo Pedido ${orderCode} — SHIMA Oriental* 🍣`,
    `*Cliente:* ${state.user.name}`,
    state.user.phone ? `*WhatsApp:* ${state.user.phone}` : '',
    `*Modalidade:* ${isPickup ? 'Retirada no Balcão' : 'Delivery'}`,
    `*Endereço:* ${addressLine}`,
    '',
    '*Itens:*',
    ...itemLines,
    '',
    notes ? `*Observações:* ${notes}` : '',
    `*Pagamento:* ${paymentMethod}`,
    `*Total:* R$ ${grandTotal},00`,
  ]
    .filter(Boolean)
    .join('\n');

  if (modalOverlay) {
    modalOverlay.hidden = false;
  }
}

function sendOrderToWhatsApp() {
  const phone = '5511995310531';
  const text = encodeURIComponent(state.lastOrderSummaryText || 'Olá! Gostaria de acompanhar meu pedido no SHIMA Oriental.');
  window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
}

function closeOrderModal() {
  const modalOverlay = document.getElementById('orderModalOverlay');
  if (modalOverlay) {
    modalOverlay.hidden = true;
  }
}

// ----------------------------------------------------------------------------
// Toast de Feedback
// ----------------------------------------------------------------------------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastFeedback');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
  }, 3200);
}

// ----------------------------------------------------------------------------
// Inicialização da Aplicação
// ----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  loadPersistedState();
  syncUserHeaderUI();
  updateCustomComboSummary();
  renderCart();

  // Ativa barra de 4 telas apenas se ?preview=4telas ou ?figma=1 estiver na URL
  const params = new URLSearchParams(window.location.search);
  if (params.has('preview') || params.has('figma')) {
    const switcher = document.getElementById('protoSwitcher');
    if (switcher) switcher.hidden = false;
  }

  // Lê hash inicial da URL (#inicio, #cadastro, #login, #cardapio)
  const initialScreen = HASH_SCREEN_MAP[window.location.hash] || 'screen-1';
  goToScreen(initialScreen, false);

  window.addEventListener('hashchange', () => {
    const target = HASH_SCREEN_MAP[window.location.hash];
    if (target && target !== state.currentScreen) {
      goToScreen(target, false);
    }
  });
});
