/* RPM — utilitários compartilhados: API, carrinho (localStorage), avisos e cabeçalho. */
(function () {
  "use strict";
  const RPM = (window.RPM = {});

  // ---------- formatação ----------
  RPM.brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  RPM.centavos = (v) => Math.round(parseFloat(v) * 100);
  RPM.brlCentavos = (c) => RPM.brl(c / 100);
  RPM.dataHora = (iso) =>
    new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  // ---------- DOM seguro (nada de innerHTML com dados vindos da API) ----------
  RPM.el = function (tag, attrs, ...filhos) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const f of filhos.flat()) {
      if (f == null || f === false) continue;
      e.append(f.nodeType ? f : document.createTextNode(String(f)));
    }
    return e;
  };
  RPM.limpar = (no) => { while (no.firstChild) no.removeChild(no.firstChild); return no; };
  const el = RPM.el;

  // ---------- API ----------
  class ErroApi extends Error {
    constructor(status, dados) { super("Erro na API"); this.status = status; this.dados = dados; }
  }
  RPM.ErroApi = ErroApi;

  RPM.api = async function (caminho, opcoes = {}) {
    const cfg = { method: opcoes.method || "GET", headers: { Accept: "application/json", ...(opcoes.headers || {}) } };
    if (opcoes.body !== undefined) {
      cfg.headers["Content-Type"] = "application/json";
      cfg.body = JSON.stringify(opcoes.body);
    }
    let resp;
    try {
      resp = await fetch(caminho, cfg);
    } catch (_) {
      throw new ErroApi(0, null);
    }
    let dados = null;
    try { dados = await resp.json(); } catch (_) { /* resposta sem corpo */ }
    if (!resp.ok) throw new ErroApi(resp.status, dados);
    return dados;
  };

  /** Texto amigável para um erro de API (mensagens de campo ficam em err.dados). */
  RPM.mensagemErro = function (err) {
    if (!(err instanceof ErroApi)) return "Algo deu errado. Tente novamente.";
    if (err.status === 0) return "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.";
    if (err.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.";
    if (err.status >= 500) return "O servidor encontrou um problema. Tente novamente em instantes.";
    const d = err.dados;
    if (d && typeof d.detail === "string") return d.detail;
    return "Não foi possível concluir a solicitação.";
  };

  // ---------- avisos ----------
  RPM.aviso = function (texto, opcoes = {}) {
    const caixa = document.getElementById("avisos");
    const no = el("div", { class: "aviso" + (opcoes.erro ? " aviso--erro" : "") },
      el("span", { text: texto }),
      opcoes.link ? el("a", { href: opcoes.link.href, text: opcoes.link.texto }) : null);
    caixa.append(no);
    setTimeout(() => no.remove(), opcoes.duracao || 4500);
  };

  // ---------- carrinho ----------
  const CHAVE = "rpm_carrinho_v1";
  const Carrinho = (RPM.Carrinho = {
    ler() {
      try {
        const bruto = JSON.parse(localStorage.getItem(CHAVE) || "[]");
        if (!Array.isArray(bruto)) return [];
        return bruto
          .map((i) => ({ id: Number(i.id), qtd: Number(i.qtd) }))
          .filter((i) => Number.isInteger(i.id) && i.id > 0 && Number.isInteger(i.qtd) && i.qtd > 0)
          .map((i) => ({ id: i.id, qtd: Math.min(i.qtd, 99) }));
      } catch (_) { return []; }
    },
    gravar(itens) {
      try { localStorage.setItem(CHAVE, JSON.stringify(itens)); } catch (_) { /* armazenamento indisponível */ }
      Carrinho.atualizarSelo();
    },
    adicionar(id, qtd = 1) {
      const itens = Carrinho.ler();
      const existente = itens.find((i) => i.id === id);
      if (existente) existente.qtd = Math.min(existente.qtd + qtd, 99);
      else itens.push({ id, qtd: Math.min(qtd, 99) });
      Carrinho.gravar(itens);
    },
    definir(id, qtd) {
      const q = Math.max(1, Math.min(99, Math.floor(Number(qtd)) || 1));
      Carrinho.gravar(Carrinho.ler().map((i) => (i.id === id ? { id, qtd: q } : i)));
      return q;
    },
    remover(id) { Carrinho.gravar(Carrinho.ler().filter((i) => i.id !== id)); },
    limpar() { Carrinho.gravar([]); },
    total() { return Carrinho.ler().reduce((s, i) => s + i.qtd, 0); },
    atualizarSelo() {
      const selo = document.getElementById("selo-carrinho");
      if (!selo) return;
      const n = Carrinho.total();
      selo.textContent = n > 99 ? "99+" : String(n);
      selo.hidden = n === 0;
    },
    /** Busca no servidor os dados atuais (nome, preço, imagens) dos itens do carrinho. */
    async carregarProdutos() {
      const itens = Carrinho.ler();
      if (!itens.length) return { itens: [], mapa: new Map() };
      const ids = itens.map((i) => i.id).join(",");
      const dados = await RPM.api(`/api/produtos/?ids=${ids}&tamanho=100`);
      const mapa = new Map(dados.results.map((p) => [p.id, p]));
      return { itens, mapa };
    },
  });

  // ---------- seletor de quantidade ----------
  RPM.seletorQuantidade = function (inicial, aoMudar, rotulo = "Quantidade") {
    const entrada = el("input", { type: "number", min: "1", max: "99", value: String(inicial), inputmode: "numeric", "aria-label": rotulo });
    const aplicar = (v) => {
      const n = Math.max(1, Math.min(99, Math.floor(Number(v)) || 1));
      entrada.value = String(n);
      aoMudar && aoMudar(n);
    };
    entrada.addEventListener("change", () => aplicar(entrada.value));
    const menos = el("button", { type: "button", "aria-label": "Diminuir quantidade", text: "−", onclick: () => aplicar(Number(entrada.value) - 1) });
    const mais = el("button", { type: "button", "aria-label": "Aumentar quantidade", text: "+", onclick: () => aplicar(Number(entrada.value) + 1) });
    const raiz = el("div", { class: "quantidade" }, menos, entrada, mais);
    raiz.valor = () => Math.max(1, Math.min(99, Math.floor(Number(entrada.value)) || 1));
    return raiz;
  };

  // ---------- categorias (menu e filtros) ----------
  let promessaCategorias = null;
  RPM.categorias = function () {
    if (!promessaCategorias) promessaCategorias = RPM.api("/api/categorias/").catch(() => []);
    return promessaCategorias;
  };

  RPM.estados = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  // ---------- validação de CPF (a validação oficial é a do servidor) ----------
  RPM.cpfValido = function (valor) {
    const c = String(valor).replace(/\D/g, "");
    if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
    for (const t of [9, 10]) {
      let soma = 0;
      for (let i = 0; i < t; i++) soma += Number(c[i]) * (t + 1 - i);
      if (((soma * 10) % 11) % 10 !== Number(c[t])) return false;
    }
    return true;
  };

  // ---------- inicialização do cabeçalho ----------
  document.addEventListener("DOMContentLoaded", () => {
    Carrinho.atualizarSelo();
    window.addEventListener("storage", (e) => { if (e.key === CHAVE) Carrinho.atualizarSelo(); });

    const ano = document.getElementById("ano");
    if (ano) ano.textContent = new Date().getFullYear();

    const params = new URLSearchParams(location.search);
    const busca = document.getElementById("campo-busca");
    if (busca && location.pathname === "/") busca.value = params.get("busca") || "";

    const menu = document.getElementById("menu-categorias");
    const atual = location.pathname === "/" ? params.get("categoria") : null;
    if (menu) {
      const todos = menu.querySelector("a");
      if (todos && location.pathname === "/" && !atual) todos.setAttribute("aria-current", "page");
      RPM.categorias().then((lista) => {
        lista.forEach((c) => {
          const a = el("a", { href: `/?categoria=${encodeURIComponent(c.slug)}`, text: c.nome });
          if (atual === c.slug) a.setAttribute("aria-current", "page");
          menu.append(el("li", {}, a));
        });
      });
    }
  });
})();
