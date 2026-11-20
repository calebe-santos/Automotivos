(function () {
  "use strict";
  const { el, brl } = RPM;
  const raiz = document.getElementById("produto");
  const id = parseInt(raiz.dataset.produtoId, 10);

  function erro(titulo, texto, tentar) {
    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(el("div", { class: "estado-vazio" },
      el("h2", { text: titulo }), el("p", { text: texto }),
      tentar ? el("button", { class: "btn", type: "button", onclick: carregar, text: "Tentar novamente" })
             : el("a", { class: "btn", href: "/", text: "Ver o catálogo" })));
  }

  function desenhar(prod) {
    document.title = `${prod.nome} · RPM Automotive`;
    const imagens = prod.imagens;

    const principal = el("img", { src: imagens[0], alt: `${prod.nome} — imagem 1 de ${imagens.length}`, width: "900", height: "675" });
    const miniaturas = imagens.map((url, i) => {
      const b = el("button", { type: "button", class: "miniatura", "aria-label": `Ver imagem ${i + 1}`, "aria-pressed": String(i === 0) },
        el("img", { src: url, alt: "", loading: "lazy" }));
      b.addEventListener("click", () => {
        principal.src = url;
        principal.alt = `${prod.nome} — imagem ${i + 1} de ${imagens.length}`;
        miniaturas.forEach((m) => m.setAttribute("aria-pressed", String(m === b)));
      });
      return b;
    });

    const seletor = RPM.seletorQuantidade(1);
    const botao = el("button", { class: "btn", type: "button", text: "Adicionar ao carrinho" });
    botao.addEventListener("click", () => {
      RPM.Carrinho.adicionar(prod.id, seletor.valor());
      RPM.aviso(`${prod.nome} foi adicionado ao carrinho.`, { link: { href: "/carrinho/", texto: "Ver carrinho" } });
    });

    const descricao = prod.descricao.split(/\n+/).filter(Boolean).map((t) => el("p", { text: t }));

    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(
      el("p", { class: "trilha" },
        el("a", { href: "/", text: "Catálogo" }), " / ",
        el("a", { href: `/?categoria=${encodeURIComponent(prod.categoria_slug)}`, text: prod.categoria_nome })),
      el("div", { class: "produto" },
        el("div", { class: "galeria" },
          el("div", { class: "galeria__principal" }, principal),
          el("div", { class: "galeria__miniaturas" }, miniaturas)),
        el("div", { class: "produto__info" },
          el("h1", { text: prod.nome }),
          el("p", { class: "preco", text: brl(prod.preco) }),
          el("div", { class: "produto__compra" },
            el("div", { class: "campo" }, el("span", { class: "rotulo", text: "Quantidade" }), seletor),
            botao),
          el("div", { class: "produto__descricao" }, el("h2", { text: "Descrição" }), descricao))));
  }

  async function carregar() {
    raiz.setAttribute("aria-busy", "true");
    try {
      desenhar(await RPM.api(`/api/produtos/${id}/`));
    } catch (err) {
      if (err.status === 404) erro("Produto não encontrado", "Ele pode ter sido removido do catálogo.");
      else erro("Não foi possível carregar o produto", RPM.mensagemErro(err), true);
    }
  }
  carregar();
})();
