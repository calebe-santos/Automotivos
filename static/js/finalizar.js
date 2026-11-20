(function () {
  "use strict";
  const { el, brl, centavos, brlCentavos, Carrinho } = RPM;
  const raiz = document.getElementById("finalizar");

  const mascaraCpf = (v) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };
  const mascaraCep = (v) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

  function campo(id, rotulo, atributos = {}, ajuda) {
    const entrada = atributos.tag === "select"
      ? el("select", { id, name: id, required: true, "aria-describedby": `${id}-erro` }, atributos.opcoes)
      : el("input", { id, name: id, required: true, "aria-describedby": `${id}-erro`, ...atributos });
    return el("div", { class: "campo" },
      el("label", { for: id }, rotulo, " ", el("span", { class: "obrig", "aria-hidden": "true", text: "*" })),
      entrada,
      ajuda ? el("p", { class: "campo__ajuda", text: ajuda }) : null,
      el("p", { class: "campo__erro", id: `${id}-erro`, hidden: true }));
  }

  /** Transforma erros aninhados da API (listas/objetos) em uma lista de frases. */
  function achatar(valor) {
    if (typeof valor === "string") return [valor];
    if (Array.isArray(valor)) return valor.flatMap(achatar);
    if (valor && typeof valor === "object") return Object.values(valor).flatMap(achatar);
    return [];
  }

  async function iniciar() {
    let dados, config;
    try {
      [dados, config] = await Promise.all([Carrinho.carregarProdutos(), RPM.api("/api/configuracao/")]);
    } catch (err) {
      raiz.setAttribute("aria-busy", "false");
      raiz.replaceChildren(el("div", { class: "estado-vazio" },
        el("h2", { text: "Não foi possível carregar a finalização" }),
        el("p", { text: RPM.mensagemErro(err) }),
        el("button", { class: "btn", type: "button", onclick: () => location.reload(), text: "Tentar novamente" })));
      return;
    }

    dados.itens.filter((i) => !dados.mapa.has(i.id)).forEach((i) => Carrinho.remover(i.id));
    const itens = Carrinho.ler();
    if (!itens.length) {
      raiz.setAttribute("aria-busy", "false");
      raiz.replaceChildren(el("div", { class: "estado-vazio" },
        el("h2", { text: "Seu carrinho está vazio" }),
        el("p", { text: "Adicione produtos antes de finalizar a compra." }),
        el("a", { class: "btn", href: "/", text: "Ver o catálogo" })));
      return;
    }

    const subtotal = itens.reduce((s, i) => s + centavos(dados.mapa.get(i.id).preco) * i.qtd, 0);
    const freteFixo = centavos(config.valor_frete_fixo);
    const minimoGratis = centavos(config.frete_gratis_minimo);
    const gratisDisponivel = subtotal >= minimoGratis;

    // ---- campos ----
    const nome = campo("nome_cliente", "Nome completo", { type: "text", autocomplete: "name", maxlength: "160" });
    const cpf = campo("cpf", "CPF", { type: "text", inputmode: "numeric", autocomplete: "off", maxlength: "14", placeholder: "000.000.000-00" });
    const cep = campo("cep", "CEP", { type: "text", inputmode: "numeric", autocomplete: "postal-code", maxlength: "9", placeholder: "00000-000" });
    const endereco = campo("endereco", "Endereço (rua, número, complemento)", { type: "text", autocomplete: "street-address", maxlength: "200" });
    const cidade = campo("cidade", "Cidade", { type: "text", autocomplete: "address-level2", maxlength: "100" });
    const estado = campo("estado", "Estado", {
      tag: "select",
      opcoes: [el("option", { value: "", text: "Selecione" }), ...RPM.estados.map((uf) => el("option", { value: uf, text: uf }))],
    });
    cpf.querySelector("input").addEventListener("input", (e) => { e.target.value = mascaraCpf(e.target.value); });
    cep.querySelector("input").addEventListener("input", (e) => { e.target.value = mascaraCep(e.target.value); });

    function opcao(nomeCampo, valor, titulo, detalhe, extra = {}) {
      return el("label", { class: "opcao" },
        el("input", { type: "radio", name: nomeCampo, value: valor, ...extra }),
        el("span", { class: "opcao__texto" },
          el("span", { class: "opcao__titulo", text: titulo }),
          el("span", { class: "opcao__detalhe", text: detalhe })));
    }

    const opcoesFrete = el("div", { class: "opcoes", id: "frete-opcoes" },
      opcao("frete", "fixo", `Frete fixo — ${brlCentavos(freteFixo)}`, "Entrega padrão para todo o Brasil.", { checked: true }),
      opcao("frete", "gratis", "Frete grátis — R$ 0,00",
        gratisDisponivel ? "Sem custo de envio." : `Disponível a partir de ${brlCentavos(minimoGratis)} em produtos.`,
        gratisDisponivel ? {} : { disabled: true }));

    const opcoesPagamento = el("div", { class: "opcoes", id: "pagamento-opcoes" },
      opcao("forma_pagamento", "pix", "Pix", "Pagamento simulado.", { checked: true }),
      opcao("forma_pagamento", "cartao", "Cartão de crédito", "Pagamento simulado. Nenhum dado de cartão é solicitado."),
      opcao("forma_pagamento", "boleto", "Boleto", "Pagamento simulado."));

    // ---- resumo ----
    const freteResumo = el("dd");
    const totalResumo = el("dd");
    const freteEscolhido = () => (raiz.querySelector('input[name="frete"]:checked') || {}).value || "fixo";
    function atualizarResumo() {
      const frete = freteEscolhido() === "gratis" ? 0 : freteFixo;
      freteResumo.textContent = frete === 0 ? "Grátis" : brlCentavos(frete);
      totalResumo.textContent = brlCentavos(subtotal + frete);
    }

    const erroGeral = el("p", { class: "erro-geral", role: "alert", id: "erro-geral", hidden: true, tabindex: "-1" });
    const botao = el("button", { class: "btn btn--bloco", type: "submit", text: "Confirmar pedido" });

    const form = el("form", { class: "form", novalidate: true },
      el("fieldset", {}, el("legend", { text: "Seus dados" }), nome, cpf),
      el("fieldset", {}, el("legend", { text: "Entrega" }),
        el("div", { class: "grade-2 grade-2--cep" }, cep, el("div")),
        endereco,
        el("div", { class: "grade-2 grade-2--cidade" }, cidade, estado)),
      el("fieldset", {}, el("legend", { text: "Frete" }), opcoesFrete),
      el("fieldset", {}, el("legend", { text: "Pagamento" }), opcoesPagamento,
        el("p", { class: "nota", style: "margin:0", text: "Este é um ambiente de demonstração: o pagamento é simulado e nenhuma cobrança real é feita." })),
      erroGeral);

    const resumo = el("aside", { class: "cartao resumo", "aria-label": "Resumo do pedido" },
      el("h2", { text: "Resumo do pedido" }),
      el("ul", { class: "resumo__itens" }, itens.map((i) => {
        const p = dados.mapa.get(i.id);
        return el("li", {}, el("span", { text: `${i.qtd} × ${p.nome}` }), el("span", { text: brlCentavos(centavos(p.preco) * i.qtd) }));
      })),
      el("dl", {},
        el("div", { class: "resumo__linha" }, el("dt", { text: "Subtotal" }), el("dd", { text: brlCentavos(subtotal) })),
        el("div", { class: "resumo__linha" }, el("dt", { text: "Frete" }), freteResumo),
        el("div", { class: "resumo__linha resumo__total" }, el("dt", { text: "Total" }), totalResumo)),
      botao,
      el("a", { class: "btn btn--texto btn--bloco", style: "margin-top:8px", href: "/carrinho/", text: "Voltar ao carrinho" }));
    botao.setAttribute("form", "form-finalizar");
    form.id = "form-finalizar";

    opcoesFrete.addEventListener("change", atualizarResumo);
    atualizarResumo();

    raiz.setAttribute("aria-busy", "false");
    raiz.replaceChildren(el("div", { class: "layout-compra" }, form, resumo));

    // ---- validação e envio ----
    const entradaDe = (id) => document.getElementById(id);
    function marcarErro(id, msg) {
      const e = entradaDe(id), p = document.getElementById(`${id}-erro`);
      if (!e || !p) return false;
      e.setAttribute("aria-invalid", "true");
      p.textContent = msg; p.hidden = false;
      return true;
    }
    function limparErros() {
      form.querySelectorAll("[aria-invalid]").forEach((e) => e.removeAttribute("aria-invalid"));
      form.querySelectorAll(".campo__erro").forEach((p) => { p.hidden = true; p.textContent = ""; });
      erroGeral.hidden = true;
    }
    function validarLocal(v) {
      const erros = {};
      if (v.nome_cliente.trim().split(/\s+/).filter(Boolean).length < 2) erros.nome_cliente = "Informe nome e sobrenome.";
      if (!RPM.cpfValido(v.cpf)) erros.cpf = "Informe um CPF válido.";
      if (v.cep.replace(/\D/g, "").length !== 8) erros.cep = "Informe um CEP com 8 dígitos.";
      if (!v.endereco.trim()) erros.endereco = "Informe o endereço.";
      if (!v.cidade.trim()) erros.cidade = "Informe a cidade.";
      if (!v.estado) erros.estado = "Selecione o estado.";
      return erros;
    }

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      limparErros();
      const v = Object.fromEntries(new FormData(form).entries());
      const locais = validarLocal(v);
      const campos = Object.keys(locais);
      if (campos.length) {
        campos.forEach((c) => marcarErro(c, locais[c]));
        entradaDe(campos[0]).focus();
        return;
      }

      botao.disabled = true; botao.textContent = "Enviando pedido…";
      try {
        const pedido = await RPM.api("/api/pedidos/", {
          method: "POST",
          body: {
            nome_cliente: v.nome_cliente, cpf: v.cpf, cep: v.cep, endereco: v.endereco,
            cidade: v.cidade, estado: v.estado, forma_pagamento: v.forma_pagamento, frete: v.frete,
            itens: Carrinho.ler().map((i) => ({ produto: i.id, quantidade: i.qtd })),
          },
        });
        try { sessionStorage.setItem("rpm_ultimo_pedido", JSON.stringify(pedido)); } catch (_) { /* sem sessionStorage */ }
        Carrinho.limpar();
        location.href = "/pedido/confirmado/";
      } catch (err) {
        botao.disabled = false; botao.textContent = "Confirmar pedido";
        const d = err.dados;
        let primeiro = null;
        const gerais = [];
        if (err.status === 400 && d && typeof d === "object") {
          for (const [chave, valor] of Object.entries(d)) {
            const texto = achatar(valor).join(" ");
            const alvo = chave === "frete" ? null : chave;
            if (alvo && marcarErro(alvo, texto)) { primeiro = primeiro || entradaDe(alvo); }
            else gerais.push(chave === "itens" ? `Itens do carrinho: ${texto}` : texto);
          }
        } else {
          gerais.push(RPM.mensagemErro(err));
        }
        if (gerais.length) {
          erroGeral.textContent = gerais.join(" ");
          erroGeral.hidden = false;
          (primeiro || erroGeral).focus();
        } else if (primeiro) primeiro.focus();
      }
    });
  }

  iniciar();
})();
