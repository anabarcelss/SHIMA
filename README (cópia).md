# SHIMA Oriental — Mobile First (4 Telas)

Projeto web mobile-first (`390px`) do restaurante **SHIMA Oriental (和食)**, contendo as 4 telas integradas, identidade visual oficial em SVG e tipografia alinhada à marca.

## 📱 As 4 Telas do Projeto

1. **Tela 1 — O que vendemos (`#screen-1`)**
   - Apresentação dos produtos da casa: **Combinados**, **Temaki**, **Yakissoba**, **Bolinha de Salmão** e **Monte seu Combo**.
   - Paleta oficial (`#950606`, `#141414`, `#F5F1E9`, `#ECE7DC`) e fotos reais dos produtos.
   - Botão **Pedir agora** integrado com o fluxo de cadastro.

2. **Tela 2 — Cadastro (`#screen-2`)**
   - Formulário completo de cadastro para novos clientes realizarem o pedido (nome, WhatsApp, e-mail, endereço de entrega e senha).

3. **Tela 3 — Login (`#screen-3`)**
   - Acesso rápido para clientes que já possuem conta cadastrada.

4. **Tela 4 — Cardápio com Carrinho (`#screen-4`)**
   - Cardápio completo filtrado por categorias (*Todos*, *Combinados*, *Temaki*, *Yakissoba*, *Bolinha de Salmão*, *Monte seu Combo*).
   - Construtor interativo **Monte seu Combo** com seleção de peças.
   - Gaveta (drawer) e barra flutuante de **Carrinho de Compras** com cálculo automático de subtotal, entrega e finalização de pedido.

---

## 🗂️ Estrutura da Pasta

```text
shima-mobile/
├── index.html                  # Estrutura das 4 telas + barra superior de navegação/comparação
├── styles.css                  # Estilos Mobile-First, variáveis de cor SHIMA e tipografia
├── app.js                      # Lógica de navegação entre telas, filtros, Monte seu Combo e Carrinho
├── README.md                   # Documentação do projeto
└── assets/
    ├── logo-shima-pos.svg      # Logo oficial SHIMA Oriental em SVG (versão positiva p/ fundos claros)
    ├── logo-shima-neg.svg      # Logo oficial SHIMA Oriental em SVG (versão negativa p/ fundos escuros)
    ├── simbolo-solar.svg       # Símbolo do sol japonês com hashis em SVG
    ├── hero-niguiris.png       # Foto principal de capa (Niguiris maçaricados)
    ├── combinados.png          # Foto categoria Combinados
    ├── combo-sashimi.png       # Foto Combinado Sashimi & Sushi
    ├── temaki.jpg              # Foto categoria Temaki
    ├── yakissoba.jpg           # Foto categoria Yakissoba
    ├── bolinha-salmao.jpg      # Foto categoria Bolinha de Salmão
    ├── monte-seu-combo.png     # Foto destaque Monte seu Combo
    ├── niguiri.png             # Peça avulsa: Niguiri
    ├── sashimi.png             # Peça avulsa: Sashimi
    ├── joy.png                 # Peça avulsa: Joy
    ├── hossomaki.png           # Peça avulsa: Hossomaki
    ├── uramaki.png             # Peça avulsa: Uramaki
    └── hot.png                 # Peça avulsa: Hot Roll
```

## 🚀 Como Executar

Basta abrir o arquivo `index.html` diretamente no navegador, ou iniciar um servidor local na pasta:

```bash
npx serve .
# ou
python3 -m http.server 8080
```
