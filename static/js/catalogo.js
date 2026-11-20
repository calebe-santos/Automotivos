(function () {
  "use strict";
  const { el, limpar, brl } = RPM;
  const grade = document.getElementById("grade");
  const area = document.getElementById("area-catalogo");
  const resumo = document.getElementById("resumo-catalogo");
  const titulo = document.getElementById("titulo-catalogo");
  const paginacao = document.getElementById("paginacao");
  const TAMANHO = 12;

  const p = new URLSearchParams(location.search);
  const filtros = {
    busca: (p.get("busca") || "").trim(),
    categoria: (p.get("categoria") || "").trim(),
    preco_min: (p.get("preco_min") || "").trim(),
    preco_max: (p.get("preco_max") || "").trim(),
    ordem: p.get("ordem") || "",
  };
  const pagina = Math.max(1, parseInt(p.get("page"), 10) || 1);

  // preenche o formulário com o estado atual
  document.getElementById("f-busca").value = filtros.busca;
  document.getElementById("f-categoria").value = filtros.categoria;
  document.getElementById("f-min").value = filtros.preco_min;
  document.getElementById("f-max").value = filtros.preco_max;
  document.getElementById("f-ordem").value = filtros.ordem;
  const temFiltro = Object.values(filtros).some(Boolean);
  document.getElementById("limpar-filtros").hidden = !temFiltro;

  function esqueletos() {
    area.replaceChildren(grade);
    limpar(grade);
    for (let i = 0; i < 8; i++) grade.append(el("li", { class: "esqueleto esqueleto--card", "aria-hidden": "true" }));
  }

  function card(prod) {
    return el("li", {},
      el("a", { class: "card", href: `/produto/${prod.id}/` },
        el("div", { class: "card__imagem" },
          el("img", { src: prod.imagem1, alt: prod.nome, loading: "lazy", width: "900", height: "675" })),
        el("div", { class: "card__corpo" },
          el("span", { class: "card__categoria", text: prod.categoria_nome }),
          el("span", { class: "card__nome", text: prod.nome }),
          el("span", { class: "preco", text: brl(prod.preco) }))));
  }

  function vazio(titulo, texto) {
    const caixa = el("div", { class: "estado-vazio" },
      el("h2", { text: titulo }), el("p", { text: texto }),
      el("a", { class: "btn", href: "/", text: "Ver todo o catálogo" }));
    area.replaceChildren(caixa);
    paginacao.hidden = true;
  }

  function linkPagina(n) {
    const q = new URLSearchParams(location.search);
    q.set("page", String(n));
    return "/?" + q.toString();
  }

  function desenharPaginacao(total) {
    const paginas = Math.ceil(total / TAMANHO);
    if (paginas <= 1) { paginacao.hidden = true; return; }
    limpar(paginacao);
    paginacao.append(
      pagina > 1 ? el("a", { class: "btn btn--contorno", href: linkPagina(pagina - 1), text: "Anterior" }) : el("span"),
      el("span", { class: "muted", text: `Página ${pagina} de ${paginas}` }),
      pagina < paginas ? el("a", { class: "btn btn--contorno", href: linkPagina(pagina + 1), text: "Próxima" }) : el("span"));
    paginacao.hidden = false;
  }

  async function carregar() {
    esqueletos();
    area.setAttribute("aria-busy", "true");

    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v) q.set(k, v);
    q.set("page", String(pagina));
    q.set("tamanho", String(TAMANHO));

    // título da página
    if (filtros.busca) titulo.textContent = `Resultados para “${filtros.busca}”`;
    else if (filtros.categoria) {
      RPM.categorias().then((lista) => {
        const c = lista.find((x) => x.slug === filtros.categoria);
        if (c) { titulo.textContent = c.nome; document.title = `${c.nome} · RPM Automotive`; }
      });
    }

    try {
      const dados = await RPM.api(`/api/produtos/?${q}`);
      area.setAttribute("aria-busy", "false");
      if (!dados.results.length) {
        resumo.textContent = "";
        return vazio("Nenhum produto encontrado",
          temFiltro ? "Tente outro termo, remova algum filtro ou navegue pelas categorias." : "O catálogo ainda não tem produtos cadastrados.");
      }
      resumo.textContent = dados.count === 1 ? "1 produto" : `${dados.count} produtos`;
      limpar(grade);
      dados.results.forEach((prod) => grade.append(card(prod)));
      desenharPaginacao(dados.count);
    } catch (err) {
      area.setAttribute("aria-busy", "false");
      if (err.status === 404 && pagina > 1) {
        const q = new URLSearchParams(location.search);
        q.delete("page");
        location.replace("/?" + q.toString());
        return;
      }
      area.replaceChildren(el("div", { class: "estado-vazio" },
        el("h2", { text: "Não foi possível carregar os produtos" }),
        el("p", { text: RPM.mensagemErro(err) }),
        el("button", { class: "btn", type: "button", onclick: carregar, text: "Tentar novamente" })));
      paginacao.hidden = true;
    }
  }

  carregar();
})();
