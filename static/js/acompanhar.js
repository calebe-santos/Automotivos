(function () {
  "use strict";
  const { el, brl } = RPM;
  const form = document.getElementById("form-consulta");
  const numero = document.getElementById("c-numero");
  const codigo = document.getElementById("c-codigo");
  const erro = document.getElementById("erro-consulta");
  const botao = document.getElementById("botao-consulta");
  const resultado = document.getElementById("resultado");

  const prefixo = new URLSearchParams(location.search).get("numero");
  if (prefixo && /^\d+$/.test(prefixo)) { numero.value = prefixo; codigo.focus(); }

  const ICONE_OK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  const ICONE_X = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

  function etapa(e) {
    const marca = el("span", { class: "etapa__marca", "aria-hidden": "true" });
    if (e.concluida) marca.innerHTML = e.status === "cancelado" ? ICONE_X : ICONE_OK;
    const classes = ["etapa"];
    if (e.concluida) classes.push("etapa--concluida");
    if (e.atual) classes.push("etapa--atual");
    if (e.status === "cancelado") classes.push("etapa--cancelada");
    return el("li", { class: classes.join(" "), "aria-current": e.atual ? "step" : false },
      marca,
      el("span", { class: "etapa__rotulo", text: e.rotulo }),
      el("span", { class: "etapa__data", text: e.concluida && e.data ? RPM.dataHora(e.data) : (e.concluida ? "" : "Pendente") }));
  }

  function mostrar(p) {
    resultado.replaceChildren(
      el("section", { class: "cartao pilha", "aria-label": `Pedido ${p.numero}` },
        el("div", { class: "pedido-topo" },
          el("div", {}, el("h2", { text: `Pedido nº ${p.numero}` }),
            el("p", { class: "muted", style: "margin:0", text: `Feito em ${RPM.dataHora(p.data_criacao)}` })),
          el("span", { class: `estado estado--${p.status}`, text: p.status_display })),
        el("div", {}, el("h3", { text: "Andamento" }), el("ol", { class: "linha-tempo" }, p.etapas.map(etapa))),
        el("div", {}, el("h3", { text: "Itens" }),
          el("table", { class: "tabela" },
            el("thead", {}, el("tr", {}, el("th", { scope: "col", text: "Produto" }), el("th", { scope: "col", class: "num", text: "Qtd." }), el("th", { scope: "col", class: "num", text: "Subtotal" }))),
            el("tbody", {}, p.itens.map((i) => el("tr", {},
              el("td", { text: i.nome_produto }), el("td", { class: "num", text: String(i.quantidade) }), el("td", { class: "num", text: brl(i.subtotal) })))))),
        el("dl", { style: "margin:0" },
          linha("Pagamento", `${p.forma_pagamento_display} — ${p.pagamento.descricao}`),
          linha("Subtotal", brl(p.subtotal)),
          linha(p.frete_display, Number(p.valor_frete) === 0 ? "Grátis" : brl(p.valor_frete)),
          linha("Total", el("strong", { text: brl(p.total) }), true))));
    resultado.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }

  function linha(rotulo, valor, total) {
    return el("div", { class: "resumo__linha" + (total ? " resumo__total" : "") }, el("dt", { text: rotulo }), el("dd", {}, valor));
  }

  function falha(msg) { erro.textContent = msg; erro.hidden = false; resultado.replaceChildren(); }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.hidden = true;
    const n = numero.value.trim().replace(/^#/, "");
    const c = codigo.value.trim();
    if (!/^\d+$/.test(n)) { falha("Informe o número do pedido (somente dígitos)."); numero.focus(); return; }
    if (!c) { falha("Informe o código de consulta."); codigo.focus(); return; }

    botao.disabled = true; botao.textContent = "Consultando…";
    try {
      // o código vai em um cabeçalho, para não ficar registrado na URL
      const dados = await RPM.api(`/api/pedidos/consultar/?numero=${encodeURIComponent(n)}`, { headers: { "X-Codigo-Consulta": c } });
      mostrar(dados);
    } catch (err) {
      falha(err.status === 404 ? "Pedido não encontrado. Confira o número e o código de consulta." : RPM.mensagemErro(err));
    } finally {
      botao.disabled = false; botao.textContent = "Consultar pedido";
    }
  });
})();
