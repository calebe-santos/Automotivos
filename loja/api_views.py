from django.db.models import Q
from django.http import Http404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import SAFE_METHODS, AllowAny, BasePermission, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Categoria, ConfiguracaoLoja, Pedido, Produto
from .serializers import (
    CategoriaSerializer,
    ConfiguracaoPublicaSerializer,
    PedidoAdminSerializer,
    PedidoCriadoSerializer,
    PedidoEntradaSerializer,
    PedidoSerializer,
    StatusSerializer,
)
from .services import criar_pedido


class LeituraPublicaEscritaAdmin(BasePermission):
    """GET/HEAD/OPTIONS para todos; criar, editar e excluir só para administradores."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)


class Paginacao(PageNumberPagination):
    page_size = 12
    page_size_query_param = "tamanho"
    max_page_size = 100


class ProdutoViewSet(viewsets.ModelViewSet):
    """
    Catálogo de produtos.

    Filtros (GET): ?busca=, ?categoria=<slug ou id>, ?preco_min=, ?preco_max=,
    ?ids=1,2,3 e ?ordem=preco|-preco|nome|recentes.
    """

    permission_classes = [LeituraPublicaEscritaAdmin]
    pagination_class = Paginacao
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_class(self):
        from .serializers import ProdutoSerializer
        return ProdutoSerializer

    def get_queryset(self):
        qs = Produto.objects.select_related("categoria")
        usuario = self.request.user
        if not (usuario and usuario.is_staff):
            qs = qs.filter(ativo=True)

        params = self.request.query_params
        busca = params.get("busca", "").strip()
        if busca:
            qs = qs.filter(nome__icontains=busca)

        categoria = params.get("categoria", "").strip()
        if categoria:
            filtro = Q(categoria__slug=categoria)
            if categoria.isdigit():
                filtro |= Q(categoria_id=int(categoria))
            qs = qs.filter(filtro)

        for nome, lookup in (("preco_min", "preco__gte"), ("preco_max", "preco__lte")):
            valor = params.get(nome, "").strip().replace(",", ".")
            if valor:
                try:
                    qs = qs.filter(**{lookup: valor})
                except Exception:
                    raise ValidationError({nome: "Informe um valor numérico."})

        ids = params.get("ids", "").strip()
        if ids:
            lista = [int(i) for i in ids.split(",") if i.strip().isdigit()][:100]
            qs = qs.filter(id__in=lista)

        ordens = {"preco": "preco", "-preco": "-preco", "nome": "nome", "recentes": "-data_criacao"}
        return qs.order_by(ordens.get(params.get("ordem"), "-data_criacao"), "-id")

    def get_object(self):
        try:
            return super().get_object()
        except Http404:
            raise NotFound("Produto não encontrado.")


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [LeituraPublicaEscritaAdmin]
    pagination_class = None  # poucas categorias: devolve a lista completa

    def destroy(self, request, *args, **kwargs):
        from django.db.models import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            raise ValidationError({"detail": "Esta categoria tem produtos e não pode ser excluída. Mova ou exclua os produtos antes."})


class ConfiguracaoView(APIView):
    """Valores públicos usados na finalização (frete fixo e mínimo para frete grátis)."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response(ConfiguracaoPublicaSerializer(ConfiguracaoLoja.obter()).data)


NAO_ENCONTRADO = "Pedido não encontrado. Confira o número e o código de consulta."


def _codigo_da_requisicao(request):
    return (
        request.headers.get("X-Codigo-Consulta")
        or request.query_params.get("codigo")
        or ""
    )


class PedidoViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    """
    Pedidos de visitantes (sem conta).

    * POST /api/pedidos/                 cria o pedido (público)
    * GET  /api/pedidos/consultar/       número + código de consulta (público)
    * GET  /api/pedidos/{id}/            administrador, ou número + código
    * GET  /api/pedidos/{id}/status/     administrador, ou número + código
    * PATCH /api/pedidos/{id}/status/    somente administrador
    * GET  /api/pedidos/                 somente administrador
    """

    queryset = Pedido.objects.prefetch_related("itens", "historico")

    def get_authenticators(self):
        # A criação é anônima: sem autenticação por sessão, evita erro de CSRF
        # quando um administrador logado testa a loja no mesmo navegador.
        if self.request.method == "POST" and self.request.path.rstrip("/").endswith("/pedidos"):
            return []
        return super().get_authenticators()

    def get_permissions(self):
        if self.action in ("create", "consultar"):
            return [AllowAny()]
        if self.action in ("retrieve", "status") and self.request.method in SAFE_METHODS:
            return [AllowAny()]  # autorização feita em _autorizar()
        return [IsAdminUser()]

    def get_throttles(self):
        from rest_framework.throttling import ScopedRateThrottle
        escopo = {"create": "pedido", "consultar": "consulta", "retrieve": "consulta", "status": "consulta"}.get(self.action)
        if escopo and not (self.request.user and self.request.user.is_staff):
            self.throttle_scope = escopo
            return [ScopedRateThrottle()]
        return []

    def _eh_admin(self, request):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff)

    def _autorizar(self, request, pedido):
        """Administrador vê tudo; os demais precisam do código de consulta."""
        if self._eh_admin(request):
            return
        if not pedido.codigo_confere(_codigo_da_requisicao(request)):
            raise NotFound(NAO_ENCONTRADO)  # mesma resposta para número ou código errado

    def _pedido(self, pk):
        try:
            return self.get_queryset().get(pk=int(pk))
        except (Pedido.DoesNotExist, ValueError):
            raise NotFound(NAO_ENCONTRADO)

    def _serializar(self, request, pedido):
        classe = PedidoAdminSerializer if self._eh_admin(request) else PedidoSerializer
        return classe(pedido, context={"request": request}).data

    # --- ações --------------------------------------------------------------
    def create(self, request, *args, **kwargs):
        entrada = PedidoEntradaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        pedido, codigo = criar_pedido(entrada.validated_data)
        dados = PedidoCriadoSerializer(pedido, context={"request": request, "codigo": codigo}).data
        return Response(dados, status=status.HTTP_201_CREATED)

    def list(self, request, *args, **kwargs):
        pagina = self.paginate_queryset(self.get_queryset())
        dados = PedidoAdminSerializer(pagina, many=True, context={"request": request}).data
        return self.get_paginated_response(dados)

    def retrieve(self, request, *args, **kwargs):
        pedido = self._pedido(kwargs["pk"])
        self._autorizar(request, pedido)
        return Response(self._serializar(request, pedido))

    @action(detail=False, methods=["get"], url_path="consultar")
    def consultar(self, request):
        numero = request.query_params.get("numero", "").strip()
        if not numero or not _codigo_da_requisicao(request):
            raise ValidationError({"detail": "Informe o número do pedido e o código de consulta."})
        pedido = self._pedido(numero)
        self._autorizar(request, pedido)
        return Response(self._serializar(request, pedido))

    @action(detail=True, methods=["get", "patch"], url_path="status")
    def status(self, request, pk=None):
        pedido = self._pedido(pk)
        if request.method == "GET":
            self._autorizar(request, pedido)
            dados = self._serializar(request, pedido)
            return Response({k: dados[k] for k in ("numero", "status", "status_display", "pagamento", "etapas")})

        entrada = StatusSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        from django.core.exceptions import ValidationError as DjangoValidationError
        try:
            pedido.alterar_status(entrada.validated_data["status"])
        except DjangoValidationError as e:
            raise ValidationError(e.message_dict)
        pedido = self._pedido(pk)
        return Response(self._serializar(request, pedido))
