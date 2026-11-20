"""
Popula o catálogo com categorias e produtos de exemplo.

Cada produto recebe três imagens-modelo geradas localmente (placeholders
neutros). Troque-as por fotos reais pelo Django Admin quando tiver.

Uso:  python manage.py popular_catalogo
"""
import io
from decimal import Decimal

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils.text import slugify
from PIL import Image, ImageDraw, ImageFont

from loja.models import Categoria, ConfiguracaoLoja, Produto

CATEGORIAS = {
    "Performance e admissão": "Turbinas, válvulas, intercoolers, filtros e admissão direta.",
    "Escapamento": "Abafadores, ponteiras e difusores.",
    "Eletrônica e performance": "Módulos de pedal e chips de potência.",
    "Aerodinâmica e exterior": "Aerofólios, spoilers, saias, calhas e protetores.",
    "Personalização e envelopamento": "Adesivos, faixas, insulfilm e vinil.",
    "Iluminação automotiva": "LED, DRL, projetores e fitas neon.",
    "Acessórios internos": "Manoplas, capas de volante, paddle shift e pedaleiras.",
    "Conforto e acabamento": "Capas de banco, tapetes e pedaleiras de alumínio.",
    "Multimídia e som": "Centrais Android, molduras, alto-falantes e subwoofers.",
    "Segurança e assistência": "Câmeras de ré, sensores e alarmes.",
}

# (categoria, nome, preço, descrição)
PRODUTOS = [
    ("Performance e admissão", "Kit turbo GT28 (turbina completa) para motores 1.0 a 1.6",
     "1899.90", "Kit completo com turbina GT28, coletor, atuador e mangueiras de silicone. Indicado para preparações moderadas, com ganho de torque em baixa e média rotação."),
    ("Performance e admissão", "Manômetro de pressão de turbo 52 mm",
     "189.90", "Manômetro analógico de 52 mm com iluminação branca, escala de -1 a 2 kgf/cm² e mangueira de instalação inclusa."),
    ("Performance e admissão", "Válvula de alívio blow-off universal",
     "349.00", "Válvula blow-off em alumínio usinado, com mola regulável e flange de fixação. Som característico e proteção do turbo."),
    ("Performance e admissão", "Intercooler frontal 600 × 300 × 76 mm",
     "799.90", "Intercooler de alumínio de alta eficiência, com colmeia de 76 mm e tanques soldados. Reduz a temperatura do ar de admissão."),
    ("Performance e admissão", "Filtro esportivo monofluxo lavável",
     "129.90", "Filtro de ar cônico em algodão lavável, base de 60 mm. Maior fluxo de ar e fácil manutenção."),
    ("Performance e admissão", "Kit de admissão direta (intake) em alumínio",
     "589.00", "Kit com tubo de alumínio polido, filtro cônico e abraçadeiras. Instalação sem alterações permanentes."),
    ("Escapamento", "Abafador esportivo em aço inox 304",
     "459.90", "Abafador de fluxo livre em aço inox 304, com acabamento escovado. Sonoridade grave e discreta."),
    ("Escapamento", "Ponteira cromada de 4 polegadas",
     "119.90", "Ponteira cromada em aço inox, corte angular, entrada de 2,5 polegadas. Fixação por abraçadeira."),
    ("Escapamento", "Difusor de escape traseiro em fibra de carbono",
     "389.00", "Difusor traseiro com acabamento em fibra de carbono, aletas centrais e saída para escapamento duplo."),
    ("Eletrônica e performance", "Módulo de pedal de acelerador (Gas Pedal)",
     "279.90", "Módulo plug and play que ajusta a resposta do pedal em três modos de condução. Instalação em minutos."),
    ("Eletrônica e performance", "Chip de potência piggyback",
     "699.00", "Módulo piggyback com mapas pré-configurados e conectores específicos. Ganho de resposta e potência."),
    ("Aerodinâmica e exterior", "Aerofólio traseiro para hatch",
     "329.90", "Aerofólio em ABS com acabamento preto brilhante e fixação por fita dupla face automotiva."),
    ("Aerodinâmica e exterior", "Spoiler dianteiro (lip) universal",
     "219.00", "Lip dianteiro em polipropileno flexível, três peças, com acabamento texturizado."),
    ("Aerodinâmica e exterior", "Protetor de cárter em alumínio",
     "249.90", "Protetor de cárter em alumínio de 4 mm, com parafusos de fixação. Proteção contra impactos em ruas e estradas."),
    ("Personalização e envelopamento", "Vinil preto fosco para envelopamento (1,52 × 5 m)",
     "379.00", "Vinil automotivo com micro canais de ar, indicado para teto, capô e detalhes. Remoção sem danos à pintura."),
    ("Personalização e envelopamento", "Faixas esportivas centrais para capô e teto",
     "149.90", "Par de faixas adesivas em vinil, resistentes ao sol e à lavagem. Aplicação a seco."),
    ("Iluminação automotiva", "Kit de lâmpadas Super LED H7 6000K",
     "239.90", "Par de lâmpadas LED H7 com 12.000 lúmens, dissipador de calor e cooler. Luz branca de 6000K."),
    ("Iluminação automotiva", "Fita LED DRL flexível para faróis",
     "89.90", "Par de fitas LED de luz diurna com seta sequencial, flexíveis e à prova de água."),
    ("Iluminação automotiva", "Kit de fita de LED ambiente em fibra óptica",
     "169.90", "Fibra óptica com controle por aplicativo, cores RGB e instalação para painel e portas."),
    ("Acessórios internos", "Manopla de câmbio esportiva em alumínio",
     "99.90", "Manopla de alumínio usinado com acabamento anodizado e adaptadores para as principais roscas."),
    ("Acessórios internos", "Capa de volante em couro com costura",
     "119.00", "Capa de volante em couro sintético, costura dupla e superfície antiderrapante. Tamanho M (37 a 39 cm)."),
    ("Conforto e acabamento", "Jogo de tapetes de borracha sob medida",
     "199.90", "Cinco peças em borracha com bordas elevadas, fácil limpeza e fixadores antiderrapantes."),
    ("Multimídia e som", "Central multimídia Android 10\" com GPS",
     "1299.00", "Tela de 10 polegadas, Android, GPS, Bluetooth, espelhamento de celular e entrada para câmera de ré."),
    ("Multimídia e som", "Subwoofer 12\" 400 W RMS",
     "459.00", "Alto-falante de graves de 12 polegadas, bobina simples de 4 ohms, indicado para caixa selada ou dutada."),
    ("Segurança e assistência", "Câmera de ré com visão noturna e linhas guia",
     "139.90", "Câmera à prova d'água, grande angular de 170°, com linhas de guia e visão noturna."),
    ("Segurança e assistência", "Sensor de estacionamento com 4 pontos e display",
     "159.90", "Kit com quatro sensores, display LED e alerta sonoro. Cores variadas para combinar com a pintura."),
]

TONS = [(232, 234, 237), (222, 225, 229), (240, 241, 243)]


def _fonte(tamanho):
    for caminho in ("DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(caminho, tamanho)
        except OSError:
            continue
    return ImageFont.load_default(tamanho)


def gerar_imagem(titulo, numero):
    largura, altura = 900, 675
    img = Image.new("RGB", (largura, altura), TONS[(numero - 1) % 3])
    d = ImageDraw.Draw(img)
    cx, cy = (largura // 2 + (numero - 2) * 90, altura // 2 - 70)
    for i, raio in enumerate((200, 150, 100, 50)):
        tom = 200 - i * 12
        d.ellipse([cx - raio, cy - raio, cx + raio, cy + raio], outline=(tom, tom + 2, tom + 6), width=6)
    d.line([(0, altura - 190), (largura, altura - 190)], fill=(205, 208, 213), width=2)
    palavras, linhas, atual = titulo.split(), [], ""
    for p in palavras:
        if len(atual + " " + p) > 24 and atual:
            linhas.append(atual)
            atual = p
        else:
            atual = (atual + " " + p).strip()
    linhas.append(atual)
    y = altura - 170
    for linha in linhas[:3]:
        d.text((40, y), linha, fill=(60, 64, 70), font=_fonte(40))
        y += 50
    d.text((largura - 230, 30), f"Imagem {numero}/3", fill=(120, 126, 134), font=_fonte(30))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=85)
    return ContentFile(buf.getvalue())


class Command(BaseCommand):
    help = "Cria categorias e produtos de exemplo (com três imagens-modelo cada)."

    def handle(self, *args, **opts):
        ConfiguracaoLoja.obter()
        categorias = {}
        for nome, descricao in CATEGORIAS.items():
            categorias[nome], _ = Categoria.objects.get_or_create(nome=nome, defaults={"descricao": descricao})

        criados = 0
        for cat, nome, preco, descricao in PRODUTOS:
            if Produto.objects.filter(nome=nome).exists():
                continue
            produto = Produto(nome=nome, descricao=descricao, preco=Decimal(preco), categoria=categorias[cat])
            base = slugify(nome)[:40]
            for n in (1, 2, 3):
                getattr(produto, f"imagem{n}").save(f"{base}-{n}.jpg", gerar_imagem(nome, n), save=False)
            produto.save()
            criados += 1
        self.stdout.write(self.style.SUCCESS(f"{criados} produto(s) criado(s). Total: {Produto.objects.count()}."))
