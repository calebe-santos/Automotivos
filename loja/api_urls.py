from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .api_views import CategoriaViewSet, ConfiguracaoView, PedidoViewSet, ProdutoViewSet

router = DefaultRouter()
router.register("produtos", ProdutoViewSet, basename="produto")
router.register("categorias", CategoriaViewSet, basename="categoria")
router.register("pedidos", PedidoViewSet, basename="pedido")

urlpatterns = [
    path("configuracao/", ConfiguracaoView.as_view(), name="configuracao"),
    path("", include(router.urls)),
]
