from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.utils.html import format_html

from .models import Categoria, ConfiguracaoLoja, HistoricoStatus, ItemPedido, Pedido, Produto
from .validators import mascarar_cpf


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nome", "slug"]
    search_fields = ["nome"]
    prepopulated_fields = {"slug": ("nome",)}


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ["miniatura", "nome", "categoria", "preco", "ativo", "data_criacao"]
    list_display_links = ["miniatura", "nome"]
    list_filter = ["categoria", "ativo"]
    list_editable = ["ativo"]
    search_fields = ["nome", "descricao"]
    fields = ["nome", "categoria", "preco", "descricao", "imagem1", "imagem2", "imagem3", "ativo"]

    @admin.display(description="Foto")
    def miniatura(self, obj):
        if obj.imagem1:
            return format_html('<img src="{}" style="height:40px;border-radius:4px">', obj.imagem1.url)
        return "—"


@admin.register(ConfiguracaoLoja)
class ConfiguracaoLojaAdmin(admin.ModelAdmin):
    list_display = ["__str__", "valor_frete_fixo", "frete_gratis_minimo"]

    def has_add_permission(self, request):
        return not ConfiguracaoLoja.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    can_delete = False
    fields = ["nome_produto", "quantidade", "preco_unitario"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


class HistoricoInline(admin.TabularInline):
    model = HistoricoStatus
    extra = 0
    can_delete = False
    fields = ["status", "data"]
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False


def _acao_status(novo, rotulo):
    @admin.action(description=f"Marcar como: {rotulo}")
    def acao(modeladmin, request, queryset):
        feitos = 0
        for pedido in queryset:
            try:
                pedido.alterar_status(novo)
                feitos += 1
            except ValidationError as e:
                modeladmin.message_user(
                    request, f"Pedido #{pedido.pk}: {' '.join(e.messages)}", messages.WARNING
                )
        if feitos:
            modeladmin.message_user(request, f"{feitos} pedido(s) atualizado(s).", messages.SUCCESS)
    acao.__name__ = f"marcar_{novo}"
    return acao


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ["id", "data_criacao", "nome_cliente", "total", "forma_pagamento", "status"]
    list_filter = ["status", "forma_pagamento", "tipo_frete"]
    search_fields = ["id", "nome_cliente"]
    date_hierarchy = "data_criacao"
    inlines = [ItemPedidoInline, HistoricoInline]
    actions = [_acao_status(s, r) for s, r in Pedido.STATUS_CHOICES if s != Pedido.AGUARDANDO_PAGAMENTO]
    fieldsets = [
        ("Andamento", {"fields": ["status", "data_criacao"]}),
        ("Cliente", {"fields": ["nome_cliente", "cpf_mascarado", "endereco", "cidade", "estado", "cep"]}),
        ("Pagamento e entrega", {"fields": ["forma_pagamento", "tipo_frete", "subtotal", "valor_frete", "total"]}),
    ]
    # Só o status pode ser editado: dados e valores do pedido são imutáveis.
    readonly_fields = [
        "data_criacao", "cpf_mascarado", "nome_cliente", "endereco", "cidade", "estado", "cep",
        "forma_pagamento", "tipo_frete", "subtotal", "valor_frete", "total",
    ]

    @admin.display(description="CPF")
    def cpf_mascarado(self, obj):
        return mascarar_cpf(obj.cpf)

    def has_add_permission(self, request):
        return False  # pedidos nascem apenas pela loja

    def has_delete_permission(self, request, obj=None):
        return False  # preserva o histórico de vendas (cancele em vez de excluir)
