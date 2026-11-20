(function () {
  "use strict";
  const { el, brl } = RPM;
  const raiz = document.getElementById("confirmacao");

  let pedido = null;
  try { pedido = JSON.parse(sessionStorage.getItem("rpm_ultimo_pedido") || "null"); } catch (_) { /* ignora */ }

  if (!pedido || !pedido.numero) {
    raiz.append(el("div", { class: "estado-vazio" },
      el("h2", { text: "Nenhum pedido recente neste navegador" }),
      el("p", { text: "Se você acabou de comprar, use o número e o código de consulta para acompanhar o pedido." }),
      el("a", { class: "btn", href: "/acompanhar/", text: "Acompanhar pedido" })));
    return;
  }
  document.title = `Pedido ${pedido.numero} confirmado · RPM Automotive`;

  const copiar = el("button", { class: "btn btn--contorno", type: "button", text: "Copiar código" });
  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pedido.codigo_consulta);
      RPM.aviso("Código copiado.");
    } catch (_) {
      RPM.aviso("Não foi possível copiar. Selecione o código e copie manualmente.", { erro: true });
    }
  });

  const icone = el("div", { class: "confirmacao__icone", "aria-hidden": "true" });
  icone.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

  raiz.append(
    icone,
    el("h1", { text: "Pedido recebido" }),
    el("p", { class: "muted", text: `Obrigado, o pedido nº ${pedido.numero} foi registrado.` }),
    el("div", { class: "pilha" },
      el("div", { class: "cartao pilha" },
        el("div", {}, el("p", { class: "rotulo", style: "margin-bottom:6px", text: "Código de consulta" }),
          el("div", { class: "codigo", text: pedido.codigo_consulta })),
        el("div", { class: "aviso-caixa aviso-caixa--atencao", text: "Anote este código. Ele aparece apenas agora e é necessário, junto com o número do pedido, para acompanhar a entrega." }),
        el("div", { class: "acoes-linha" }, copiar)),
      el("div", { class: "cartao" },
        el("dl", { class: "resumo", style: "position:static;margin:0" },
          linha("Número do pedido", String(pedido.numero)),
          linha("Status", el("span", { class: `estado estado--${pedido.status}`, text: pedido.status_display })),
          linha("Pagamento", `${pedido.forma_pagamento_display} (simulado)`),
          linha("Subtotal", brl(pedido.subtotal)),
          linha("Frete", Number(pedido.valor_frete) === 0 ? "Grátis" : brl(pedido.valor_frete)),
          linha("Total", el("strong", { text: brl(pedido.total) }), true))),
      el("div", { class: "acoes-linha" },
        el("a", { class: "btn", href: `/acompanhar/?numero=${encodeURIComponent(pedido.numero)}`, text: "Acompanhar pedido" }),
        el("a", { class: "btn btn--contorno", href: "/", text: "Voltar ao catálogo" }))));

  function linha(rotulo, valor, total) {
    return el("div", { class: "resumo__linha" + (total ? " resumo__total" : "") }, el("dt", { text: rotulo }), el("dd", {}, valor));
  }
})();
