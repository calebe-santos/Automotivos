(function () {
  "use strict";
  const { el, brl, centavos, brlCentavos, Carrinho } = RPM;
  const raiz = document.getElementById("carrinho");

  function vazio(extra) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(...[
      extra,
      el("div", { class: "estado-vazio" },
        el("h2", { text: "Seu carrinho está vazio" }),
        el("p", { text: "Escolha uma peça no catálogo para começar." }),
        el("a", { class: "btn", href: "/", text: "Ver o catálogo" })),
    ].filter(Boolean));
  }

  async function iniciar() {
    raiz.setAttribute("aria-busy", "true");
    let dados;
    try {
      dados = await Carrinho.carregarProdutos();
    } catch (err) {
      raiz.setAttribute("aria-busy", "false");
      raiz.replaceChildren(el("div", { class: "estado-vazio" },
        el("h2", { text: "Não foi possível carregar o carrinho" }),
        el("p", { text: RPM.mensagemErro(err) }),
        el("button", { class: "btn", type: "button", onclick: iniciar, text: "Tentar novamente" })));
      return;
    }

    // remove produtos que não estão mais à venda
    const indisponiveis = dados.itens.filter((i) => !dados.mapa.has(i.id));
    indisponiveis.forEach((i) => Carrinho.remover(i.id));
    const aviso = indisponiveis.length
      ? el("div", { class: "aviso-caixa aviso-caixa--atencao", role: "status", style: "margin-bottom:16px" },
          `${indisponiveis.length === 1 ? "Um item não está mais disponível e foi removido" : indisponiveis.length + " itens não estão mais disponíveis e foram removidos"} do carrinho.`)
      : null;

    let itens = Carrinho.ler();
    if (!itens.length) return vazio(aviso);

    const subtotalEl = el("dd");
    const quantidadeEl = el("dd");
    const lista = el("ul", { class: "linhas" });

    function totais() {
      itens = Carrinho.ler();
      const sub = itens.reduce((s, i) => s + centavos(dados.mapa.get(i.id).preco) * i.qtd, 0);
      subtotalEl.textContent = brlCentavos(sub);
      const n = itens.reduce((s, i) => s + i.qtd, 0);
      quantidadeEl.textContent = n === 1 ? "1 item" : `${n} itens`;
    }

    function linha(item) {
      const prod = dados.mapa.get(item.id);
      const totalEl = el("span", { class: "linha__total" });
      const li = el("li", { class: "linha" });
      const atualizarTotal = (q) => { totalEl.textContent = brlCentavos(centavos(prod.preco) * q); };
      atualizarTotal(item.qtd);

      const seletor = RPM.seletorQuantidade(item.qtd, (q) => {
        Carrinho.definir(item.id, q);
        atualizarTotal(q);
        totais();
      }, `Quantidade de ${prod.nome}`);

      li.append(
        el("a", { class: "linha__imagem", href: `/produto/${prod.id}/`, tabindex: "-1", "aria-hidden": "true" },
          el("img", { src: prod.imagem1, alt: "", loading: "lazy" })),
        el("div", {},
          el("a", { class: "linha__nome", href: `/produto/${prod.id}/`, text: prod.nome }),
          el("div", { class: "linha__unit", text: `${brl(prod.preco)} cada` })),
        el("div", { class: "linha__controles" },
          seletor, totalEl,
          el("button", {
            class: "remover", type: "button", "aria-label": `Remover ${prod.nome}`, text: "Remover",
            onclick: () => {
              Carrinho.remover(item.id);
              li.remove();
              RPM.aviso("Item removido do carrinho.");
              if (!Carrinho.ler().length) vazio(); else totais();
            },
          })));
      return li;
    }

    itens.forEach((i) => lista.append(linha(i)));
    totais();

    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(...[
      aviso,
      el("div", { class: "layout-compra" },
        el("section", { "aria-label": "Itens do carrinho" }, lista),
        el("aside", { class: "cartao resumo", "aria-label": "Resumo do pedido" },
          el("h2", { text: "Resumo" }),
          el("dl", {},
            el("div", { class: "resumo__linha" }, el("dt", { text: "Quantidade" }), quantidadeEl),
            el("div", { class: "resumo__linha" }, el("dt", { text: "Subtotal" }), subtotalEl),
            el("div", { class: "resumo__linha" }, el("dt", { text: "Frete" }), el("dd", { text: "Escolhido na finalização" }))),
          el("a", { class: "btn btn--bloco", href: "/finalizar/", text: "Finalizar compra" }),
          el("p", { class: "nota", style: "margin:12px 0 0", text: "O total final é calculado pelo servidor ao confirmar o pedido." }),
          el("a", { class: "btn btn--texto btn--bloco", style: "margin-top:8px", href: "/", text: "Continuar comprando" }))),
    ].filter(Boolean));
  }

  iniciar();
})();
