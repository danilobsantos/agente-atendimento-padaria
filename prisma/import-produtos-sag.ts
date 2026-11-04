import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import Redis from "ioredis";
import "dotenv/config";

interface ProductSeed {
  name: string;
  price: number;
  un: string;
}

interface CategorySeed {
  name: string;
  products: ProductSeed[];
}

const CATEGORIES: CategorySeed[] = [
  {
    "name": "Sucos",
    "products": [
      {
        "name": "Refresco DV Frut Frutas Citricas PET 1,5L",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Tampico 250 ml",
        "price": 4.25,
        "un": "un"
      },
      {
        "name": "Tampico 450 ml",
        "price": 5.7,
        "un": "un"
      },
      {
        "name": "Tampico 1 L",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Suco Campo Largo Uva 900ml",
        "price": 17.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Balas e Doces",
    "products": [
      {
        "name": "Tic Tac Mix Frutas 49g",
        "price": 12.25,
        "un": "un"
      },
      {
        "name": "Fini Marsh Milhows Pamonha 80g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Balas Goma Gel Acido Fundipperz Minions 54g",
        "price": 12.75,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat Raio Harry Potter 70g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat Edwirges Harry Potter 70g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat Oculos Harry Potter 70g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat Chapeu Harry Potter 70g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Fini Beijos Morango e Nata 35g",
        "price": 4.75,
        "un": "un"
      },
      {
        "name": "Fini Dentadura Morango e Framboesa 35g",
        "price": 4.75,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat. Bananas 35g",
        "price": 4.75,
        "un": "un"
      },
      {
        "name": "Fini Bala Gelat. Minhocas Azedinhas 35g",
        "price": 4.7,
        "un": "un"
      },
      {
        "name": "Fini Marsh Coracao Morango e Nata 80g",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Fini Bananas 80g",
        "price": 9.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Achocolatados em Pó",
    "products": [
      {
        "name": "Nescau 370g",
        "price": 14.5,
        "un": "un"
      },
      {
        "name": "Nescau 200g",
        "price": 9.5,
        "un": "un"
      },
      {
        "name": "Toddy Achocolatado 370 g",
        "price": 15.35,
        "un": "un"
      },
      {
        "name": "Achocolatado Nescau 730g",
        "price": 18.9,
        "un": "un"
      },
      {
        "name": "Achocolatado Toddy Twix 350g",
        "price": 12.5,
        "un": "un"
      },
      {
        "name": "Achocolatado Po Nescau 550g",
        "price": 21.3,
        "un": "un"
      },
      {
        "name": "Toddy Achocolatado 200 g",
        "price": 10.99,
        "un": "un"
      },
      {
        "name": "Achocolatado Toddy Original 480g",
        "price": 17.5,
        "un": "un"
      },
      {
        "name": "Nescau Achocolatado Menos Acucares 350g",
        "price": 16.5,
        "un": "un"
      },
      {
        "name": "Toddy Light 380g",
        "price": 23.9,
        "un": "un"
      },
      {
        "name": "Achocolatado Nescau 350g",
        "price": 15.75,
        "un": "un"
      },
      {
        "name": "Toddy Original Achocolatado 750g",
        "price": 22.99,
        "un": "un"
      }
    ]
  },
  {
    "name": "Açúcares",
    "products": [
      {
        "name": "Acucar Cristal 1kg",
        "price": 6.25,
        "un": "un"
      },
      {
        "name": "Acucar Colombo 1kg",
        "price": 6.25,
        "un": "un"
      },
      {
        "name": "Acucar Refinado União 1 kg",
        "price": 6.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Água de Coco",
    "products": [
      {
        "name": "Agua de Coco Kero 1 L",
        "price": 18.9,
        "un": "un"
      },
      {
        "name": "Agua de Coco Kero 200 ml",
        "price": 5.35,
        "un": "un"
      },
      {
        "name": "Agua de Coco Kero 330 ml",
        "price": 11.9,
        "un": "un"
      },
      {
        "name": "Agua de Coco Campo Largo 900ml",
        "price": 18.9,
        "un": "un"
      },
      {
        "name": "Agua de Coco Campo Largo 250ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Agua de Coco Campo Largo TP 200ml",
        "price": 7.0,
        "un": "un"
      },
      {
        "name": "Agua Coco Integral Vitcoco 1L",
        "price": 14.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Bebidas Energéticas",
    "products": [
      {
        "name": "Tnt Original 269 ml",
        "price": 8.99,
        "un": "un"
      },
      {
        "name": "Tnt Zero 269 ml",
        "price": 8.99,
        "un": "un"
      },
      {
        "name": "Red Bull Acai 250ml",
        "price": 13.85,
        "un": "un"
      },
      {
        "name": "Red Bull 250 ml",
        "price": 13.85,
        "un": "un"
      },
      {
        "name": "Red Bull Sugar Fre 250 ml",
        "price": 13.85,
        "un": "un"
      },
      {
        "name": "Tnt Acai com Guaraná 269ml",
        "price": 8.99,
        "un": "un"
      },
      {
        "name": "Monster Energy Suco Mango Loco 473ml",
        "price": 14.9,
        "un": "un"
      },
      {
        "name": "Monster Energy sem Acucar 473ml",
        "price": 14.9,
        "un": "un"
      },
      {
        "name": "Energetico Tnt Maca Verde 269ml",
        "price": 8.99,
        "un": "un"
      },
      {
        "name": "Red Bull Melancia Edition",
        "price": 13.85,
        "un": "un"
      },
      {
        "name": "Red Bull Tropical 250ml",
        "price": 13.85,
        "un": "un"
      }
    ]
  },
  {
    "name": "Bebidas Fermentadas",
    "products": [
      {
        "name": "Chamyto 75 g",
        "price": 2.5,
        "un": "un"
      },
      {
        "name": "Yakult 80 g",
        "price": 3.3,
        "un": "un"
      },
      {
        "name": "Yakult Taff Man Ex 110ml",
        "price": 7.8,
        "un": "un"
      },
      {
        "name": "Yakult 40 Light",
        "price": 3.85,
        "un": "un"
      }
    ]
  },
  {
    "name": "Bebidas Isotônicas",
    "products": [
      {
        "name": "Gatorade Laranja 500 ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Gatorade Maracuja 500 ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Gatorade Tangerina 500 ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Gatorade Frutas Citricas 500 ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Gatorade Limao 500 ml",
        "price": 7.75,
        "un": "un"
      },
      {
        "name": "Gatorade Uva 500 ml",
        "price": 7.8,
        "un": "un"
      },
      {
        "name": "Powerade Uva Verde 500ml",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Powerade Tangerina 500ml",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Powerade Maracuja 500ml",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Powerade Mix de Frutas 500ml",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Powerademix Uva 500ml",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Power Ade Limao",
        "price": 8.6,
        "un": "un"
      },
      {
        "name": "Power Ade Laranja 500ml",
        "price": 6.65,
        "un": "un"
      },
      {
        "name": "Gatorade Morango - Maracuja 500ml",
        "price": 7.75,
        "un": "un"
      }
    ]
  },
  {
    "name": "Bebidas Lácteas",
    "products": [
      {
        "name": "Nescafé Smoovlatte 270ml",
        "price": 8.9,
        "un": "un"
      },
      {
        "name": "Achocolatado Nescau Light 200ml",
        "price": 3.9,
        "un": "un"
      },
      {
        "name": "Nescafé Chococino 270ml",
        "price": 8.9,
        "un": "un"
      },
      {
        "name": "Bebida Nescafé Cappuccino Classico 270ml",
        "price": 8.9,
        "un": "un"
      },
      {
        "name": "Whey Pro Itambe Morango 250ml",
        "price": 10.2,
        "un": "un"
      },
      {
        "name": "Bebida Lactea Starbucks Frappuc. Mocha 280ml",
        "price": 11.65,
        "un": "un"
      }
    ]
  },
  {
    "name": "Bolachas e Biscoitos",
    "products": [
      {
        "name": "Bolachinha (kg)",
        "price": 65.9,
        "un": "kg"
      },
      {
        "name": "Torrada Visconti Tradicional 120g",
        "price": 5.95,
        "un": "un"
      },
      {
        "name": "Torrada Visconti Multigraos 120g",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Torrada Visconti Integral 120g",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Bolacha Maisena Parati 370g",
        "price": 7.3,
        "un": "un"
      },
      {
        "name": "Bolacha Tortuguita Chocolate 130 g",
        "price": 4.1,
        "un": "un"
      },
      {
        "name": "Torrada Bauducco Tradicional 142g",
        "price": 6.25,
        "un": "un"
      },
      {
        "name": "Bis Original",
        "price": 8.99,
        "un": "un"
      },
      {
        "name": "Bis Branco",
        "price": 8.99,
        "un": "un"
      }
    ]
  },
  {
    "name": "Café",
    "products": [
      {
        "name": "Cafe Evolutto Extra Forte 500g",
        "price": 30.99,
        "un": "un"
      },
      {
        "name": "Cafe Montanhas do Barao Capsula 50g",
        "price": 37.35,
        "un": "un"
      },
      {
        "name": "Pringles Creme e Cebola",
        "price": 15.75,
        "un": "un"
      },
      {
        "name": "Cafe Prima Qualita 250g",
        "price": 31.95,
        "un": "un"
      },
      {
        "name": "Cafe Evolutto Tradicional 250g",
        "price": 15.5,
        "un": "un"
      },
      {
        "name": "Cafe Prima Qualita 500g",
        "price": 49.25,
        "un": "un"
      },
      {
        "name": "Cafe Evoluto Extra Forte 250g",
        "price": 15.5,
        "un": "un"
      },
      {
        "name": "Cafe Prima Qualita 100 Aribica Graos",
        "price": 68.9,
        "un": "un"
      },
      {
        "name": "Cafe Monjolo 500g",
        "price": 69.0,
        "un": "un"
      },
      {
        "name": "Cafe Monjolo Graos 500g",
        "price": 59.95,
        "un": "un"
      },
      {
        "name": "Cafe Jequitibá 500g",
        "price": 61.5,
        "un": "un"
      },
      {
        "name": "Cafe Jequitibá Graos 500g",
        "price": 61.5,
        "un": "un"
      },
      {
        "name": "Cafe Montanhas do Barao Graos 500g",
        "price": 74.9,
        "un": "un"
      },
      {
        "name": "Cafe Montanhas do Barao 250g",
        "price": 35.85,
        "un": "un"
      },
      {
        "name": "Cafe Montanhas do Barao 500g",
        "price": 59.85,
        "un": "un"
      },
      {
        "name": "Cafe Nescafé Forte Tradicao 40g",
        "price": 9.99,
        "un": "un"
      },
      {
        "name": "Cafe Evolutto Tradicional 500g",
        "price": 30.99,
        "un": "un"
      },
      {
        "name": "Cappuccino Evolutto Tradicional 200g",
        "price": 22.9,
        "un": "un"
      },
      {
        "name": "Cafe Monjolo Queimado Capsulas 50 g",
        "price": 35.5,
        "un": "un"
      },
      {
        "name": "Nescafé Tradicao Extra Forte 160 g",
        "price": 23.7,
        "un": "un"
      },
      {
        "name": "Nescafé Tradicao 100g",
        "price": 22.5,
        "un": "un"
      }
    ]
  },
  {
    "name": "Cereais",
    "products": [
      {
        "name": "Pipoca Microondas Yoki Tradicional",
        "price": 4.65,
        "un": "un"
      },
      {
        "name": "Nescau Ball",
        "price": 16.3,
        "un": "un"
      },
      {
        "name": "Sucrilhos Kelloggs 240g",
        "price": 14.85,
        "un": "un"
      },
      {
        "name": "Cereal Matinal Nescau Nestle 210g",
        "price": 14.95,
        "un": "un"
      },
      {
        "name": "Cereal Snow Flakes 230g",
        "price": 12.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Chás",
    "products": [
      {
        "name": "Cha Campo Largo Hibisco /cramberry 900ml",
        "price": 14.75,
        "un": "un"
      },
      {
        "name": "Cha Mate Leao Original",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Cha Leao Camomila",
        "price": 5.5,
        "un": "un"
      }
    ]
  },
  {
    "name": "Chocolates",
    "products": [
      {
        "name": "Bombom Ouro Branco 20 g",
        "price": 2.25,
        "un": "un"
      },
      {
        "name": "Bombom Sonho de Valsa 20 g",
        "price": 2.25,
        "un": "un"
      },
      {
        "name": "Chocolate Tortuguita Brigadeiro 18 g",
        "price": 2.5,
        "un": "un"
      },
      {
        "name": "Chocolate Kinder Bueno White 43 g",
        "price": 11.75,
        "un": "un"
      },
      {
        "name": "Chocolate Kinder Bueno 43 g",
        "price": 12.0,
        "un": "un"
      },
      {
        "name": "Chocolate Suflair 50g",
        "price": 10.15,
        "un": "un"
      },
      {
        "name": "Chocolate Kit Kat 41,5g",
        "price": 6.45,
        "un": "un"
      },
      {
        "name": "Ovo Pascoa Kinder Menina",
        "price": 116.8,
        "un": "un"
      },
      {
        "name": "Ovo Pascoa Kinder Menino",
        "price": 116.8,
        "un": "un"
      },
      {
        "name": "Ovo Pascoa Ferrero Rocher Caixa",
        "price": 80.0,
        "un": "un"
      },
      {
        "name": "Chocolate Kit Kat Branco 41,5g",
        "price": 6.45,
        "un": "un"
      },
      {
        "name": "Ovo de Pascoa Nestle Kitkat 338,5g - Tradicional",
        "price": 129.75,
        "un": "un"
      }
    ]
  },
  {
    "name": "Confeitaria",
    "products": [
      {
        "name": "Torta Holandesa",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Torta de Limao",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Torta de Morango",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Torta Suica",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pudim de Forma Pequeno",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pastel de Ninho com Nutela",
        "price": 4.9,
        "un": "un"
      },
      {
        "name": "Folheado de Doce de Leite",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Queijadinha",
        "price": 8.0,
        "un": "un"
      },
      {
        "name": "Verrine",
        "price": 18.9,
        "un": "un"
      },
      {
        "name": "Canjica de Milho",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Doces Aniversario",
        "price": 1.5,
        "un": "un"
      },
      {
        "name": "Bento Cake Medio",
        "price": 50.0,
        "un": "un"
      },
      {
        "name": "Bento Cake Bere ( Aro 15 )",
        "price": 75.0,
        "un": "un"
      },
      {
        "name": "Bolo de Banana Integral",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Bolo de Milho Pequeno",
        "price": 15.0,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Banana e Maca",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Cenoura",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Chocolate",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Gengibre",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Indiano",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Red Velvet",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Fuba",
        "price": 18.0,
        "un": "un"
      },
      {
        "name": "Bolo de Laranja sem Lactose",
        "price": 18.9,
        "un": "un"
      },
      {
        "name": "Bolo no Pote",
        "price": 9.0,
        "un": "un"
      },
      {
        "name": "Bolo de Pamonha",
        "price": 25.0,
        "un": "un"
      },
      {
        "name": "Bolo Pao de Mel",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Bolo Piscina",
        "price": 30.0,
        "un": "un"
      },
      {
        "name": "Bolo Prestigio Pedaco",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Bolo Recheado",
        "price": 20.0,
        "un": "un"
      },
      {
        "name": "Bolo sem Recheio",
        "price": 20.0,
        "un": "un"
      },
      {
        "name": "Broa de Amendoim",
        "price": 3.0,
        "un": "un"
      },
      {
        "name": "Broa de Chocolate",
        "price": 5.0,
        "un": "un"
      },
      {
        "name": "Broa de Coco",
        "price": 3.0,
        "un": "un"
      },
      {
        "name": "Brownie",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Cacarola",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Cake Tone",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Cone Trufado",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Cupcake",
        "price": 8.0,
        "un": "un"
      },
      {
        "name": "Cural de Milho",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Macarron",
        "price": 4.5,
        "un": "un"
      },
      {
        "name": "Mini Bolo Gelado",
        "price": 4.5,
        "un": "un"
      },
      {
        "name": "Pau A Pique",
        "price": 9.9,
        "un": "un"
      },
      {
        "name": "Forma Pudim de Forma Pequeno",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pudim Grande",
        "price": 65.0,
        "un": "un"
      },
      {
        "name": "Pudim Medio ( Forma )",
        "price": 55.0,
        "un": "un"
      },
      {
        "name": "Pudim Pedaco",
        "price": 8.0,
        "un": "un"
      },
      {
        "name": "Quindim Unidade",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Sonho de Creme",
        "price": 8.0,
        "un": "un"
      },
      {
        "name": "Sonho de Doce de Leite",
        "price": 8.0,
        "un": "un"
      },
      {
        "name": "Torta de Banana",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Arroz Doce",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Bolo",
        "price": 20.0,
        "un": "un"
      },
      {
        "name": "Mini Torta de Morango",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Broa Salgada (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Bolo Laranja",
        "price": 20.0,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Iogurte e Limao",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Fuba",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Bolo Bere ( Aro 20 )",
        "price": 140.0,
        "un": "un"
      },
      {
        "name": "Bolo de Amendoim",
        "price": 20.0,
        "un": "un"
      },
      {
        "name": "Croiassant de Pistache",
        "price": 28.9,
        "un": "un"
      },
      {
        "name": "Pudim Pequeno",
        "price": 30.0,
        "un": "un"
      },
      {
        "name": "Bolo de Tira Romeu e Julieta",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Pao de Lo Redondo Aro 20",
        "price": 15.0,
        "un": "un"
      },
      {
        "name": "Pao de Lo Forma de Cacarola",
        "price": 35.0,
        "un": "un"
      },
      {
        "name": "Pao de Lo Forma Bolo Gelado / Rocambole",
        "price": 45.0,
        "un": "un"
      },
      {
        "name": "Mini Torta de Limao",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Cookies do Ary C/ Nutella",
        "price": 14.0,
        "un": "un"
      },
      {
        "name": "Cookies do Ary C/ Gotas de Chocolate",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pastel de Ninho Artesanal ( Sabores )",
        "price": 10.0,
        "un": "un"
      }
    ]
  },
  {
    "name": "Destilados",
    "products": [
      {
        "name": "Refrigerante It Guaraná 2L",
        "price": 7.99,
        "un": "un"
      }
    ]
  },
  {
    "name": "Diversos",
    "products": [
      {
        "name": "Gelo (kg)",
        "price": 3.5,
        "un": "kg"
      },
      {
        "name": "Cesta Opcao 1",
        "price": 215.0,
        "un": "un"
      },
      {
        "name": "Cesta Opcao 2",
        "price": 255.0,
        "un": "un"
      },
      {
        "name": "Caixinha Decorada",
        "price": 150.0,
        "un": "un"
      }
    ]
  },
  {
    "name": "Doces",
    "products": [
      {
        "name": "Donuts",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Bandeja Canudos Doce de Leite Andreia",
        "price": 23.0,
        "un": "un"
      },
      {
        "name": "Bandeija Pe de Moleque Andreia",
        "price": 23.0,
        "un": "un"
      },
      {
        "name": "Bomba",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Maca do Amor",
        "price": 12.0,
        "un": "un"
      },
      {
        "name": "Pastel de Belem",
        "price": 4.5,
        "un": "un"
      },
      {
        "name": "Algodao Doce",
        "price": 9.0,
        "un": "un"
      },
      {
        "name": "Suspiros Canelinha",
        "price": 9.6,
        "un": "un"
      },
      {
        "name": "Pao de Mel Arabela",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Pao de Mel Dona Beca",
        "price": 6.75,
        "un": "un"
      },
      {
        "name": "Bandeija Pe de Moca Andreia",
        "price": 23.0,
        "un": "un"
      },
      {
        "name": "Mini Donuts",
        "price": 5.0,
        "un": "un"
      },
      {
        "name": "Doce Pe de Moleque Pedaço Andreia",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Palha Italiana Cubos",
        "price": 2.5,
        "un": "un"
      },
      {
        "name": "Canoli (kg)",
        "price": 45.9,
        "un": "kg"
      },
      {
        "name": "Doce Canudinho kg (kg)",
        "price": 75.0,
        "un": "kg"
      }
    ]
  },
  {
    "name": "Embutidos",
    "products": [
      {
        "name": "Mortadela Ceratti (kg)",
        "price": 72.0,
        "un": "kg"
      },
      {
        "name": "Mortadela Defumada (kg)",
        "price": 39.9,
        "un": "kg"
      },
      {
        "name": "Peito de Peru (kg)",
        "price": 72.0,
        "un": "kg"
      },
      {
        "name": "Salame Italiano (kg)",
        "price": 130.0,
        "un": "kg"
      },
      {
        "name": "Presunto (kg)",
        "price": 52.0,
        "un": "kg"
      },
      {
        "name": "Mussarela (kg)",
        "price": 63.9,
        "un": "kg"
      },
      {
        "name": "Apresuntado (kg)",
        "price": 32.0,
        "un": "kg"
      },
      {
        "name": "Mortadela Marba (kg)",
        "price": 32.0,
        "un": "kg"
      },
      {
        "name": "Salame Hamburgues (kg)",
        "price": 150.0,
        "un": "kg"
      }
    ]
  },
  {
    "name": "Energéticos",
    "products": [
      {
        "name": "Energetico Baly Tradicional Lt 473",
        "price": 8.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Goma de Mascar",
    "products": [
      {
        "name": "Trident Menta Verde 8g",
        "price": 3.25,
        "un": "un"
      },
      {
        "name": "Trident Hortela 8g",
        "price": 3.25,
        "un": "un"
      }
    ]
  },
  {
    "name": "Iogurtes",
    "products": [
      {
        "name": "Iogurte Fazenda 170g Natural",
        "price": 4.7,
        "un": "un"
      },
      {
        "name": "Iogurte Fazenda 170g Morango",
        "price": 4.7,
        "un": "un"
      },
      {
        "name": "Iogurte Yopro Morango 250g",
        "price": 13.5,
        "un": "un"
      },
      {
        "name": "Iogurte Fazenda Morango 500g",
        "price": 9.99,
        "un": "un"
      },
      {
        "name": "Iogurte Fazenda Frutas Vermelhas 500g",
        "price": 9.99,
        "un": "un"
      },
      {
        "name": "Iogurte Fazenda Frutas Vermelhas 180g",
        "price": 4.7,
        "un": "un"
      },
      {
        "name": "Iogurte Fazenda Morango 180g",
        "price": 4.7,
        "un": "un"
      }
    ]
  },
  {
    "name": "Lanches",
    "products": [
      {
        "name": "Mini Lanche Natural",
        "price": 5.0,
        "un": "un"
      },
      {
        "name": "Misto Quente na Baguetinha com Mortadela Ceratti",
        "price": 21.0,
        "un": "un"
      },
      {
        "name": "Bengala Salame",
        "price": 65.0,
        "un": "un"
      },
      {
        "name": "Bengala Pres Mussarela Lanche Natural",
        "price": 55.0,
        "un": "un"
      },
      {
        "name": "Pao na Chapa",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Mini Misto Quente",
        "price": 4.5,
        "un": "un"
      }
    ]
  },
  {
    "name": "Laticínios",
    "products": [
      {
        "name": "Leite Serrania 1 L",
        "price": 6.75,
        "un": "un"
      },
      {
        "name": "Leite Fazenda Integral 1 L",
        "price": 10.8,
        "un": "un"
      },
      {
        "name": "Leite Fazenda Semi Desnatado 1 L",
        "price": 10.8,
        "un": "un"
      },
      {
        "name": "Leite Fazenda Desnatado 1 L",
        "price": 10.8,
        "un": "un"
      },
      {
        "name": "Leite Fazenda Zero Lactose 1 L",
        "price": 10.8,
        "un": "un"
      },
      {
        "name": "Leite Ninho Caixinha 1L",
        "price": 9.3,
        "un": "un"
      },
      {
        "name": "Leite Cemil 1 Lt",
        "price": 7.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Loja",
    "products": [
      {
        "name": "Garrafa com Cafe",
        "price": 30.0,
        "un": "un"
      },
      {
        "name": "Torta Salgada Frango F Cacarola ( Media )",
        "price": 120.0,
        "un": "un"
      }
    ]
  },
  {
    "name": "Manteiga e Margarinas",
    "products": [
      {
        "name": "Margarina Qualy 500 g",
        "price": 13.75,
        "un": "un"
      },
      {
        "name": "Manteiga Serrania",
        "price": 17.0,
        "un": "un"
      },
      {
        "name": "Manteiga Aviacao S/ Sal 200g",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Manteiga Aviacao C/sal 200g",
        "price": 19.9,
        "un": "un"
      },
      {
        "name": "Manteiga Fazenda S/sal 200 g",
        "price": 20.75,
        "un": "un"
      },
      {
        "name": "Manteiga Fazenda C/sal 200g",
        "price": 20.75,
        "un": "un"
      },
      {
        "name": "Manteiga Minas 400g",
        "price": 28.9,
        "un": "un"
      },
      {
        "name": "Manteiga Minas 200g",
        "price": 16.9,
        "un": "un"
      }
    ]
  },
  {
    "name": "Mercearia",
    "products": [
      {
        "name": "Pipoca de Microondas Mant. Cinema 100 g",
        "price": 4.35,
        "un": "un"
      },
      {
        "name": "Bisnaguinha",
        "price": 1.0,
        "un": "un"
      },
      {
        "name": "Pipoca Doce Colorida un",
        "price": 7.5,
        "un": "un"
      },
      {
        "name": "Copo Descartavel",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pipoca Gourmet da Gabi",
        "price": 13.99,
        "un": "un"
      }
    ]
  },
  {
    "name": "Panificação",
    "products": [
      {
        "name": "Pao Frances (kg)",
        "price": 16.9,
        "un": "kg"
      },
      {
        "name": "Rocambole (kg)",
        "price": 35.0,
        "un": "kg"
      },
      {
        "name": "Forrozinho (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Biscoito Natural (kg)",
        "price": 45.0,
        "un": "kg"
      },
      {
        "name": "Biscoito Queijo (kg)",
        "price": 45.0,
        "un": "kg"
      },
      {
        "name": "Pao de Torresmo (kg)",
        "price": 39.9,
        "un": "kg"
      },
      {
        "name": "Pao Frances Integral (kg)",
        "price": 35.0,
        "un": "kg"
      },
      {
        "name": "Biscoito Gergelim (kg)",
        "price": 45.0,
        "un": "kg"
      },
      {
        "name": "Bolo Confeitado (kg)",
        "price": 70.0,
        "un": "kg"
      },
      {
        "name": "Mini Pao (kg)",
        "price": 16.9,
        "un": "kg"
      },
      {
        "name": "Mini Pao Gergilim (kg)",
        "price": 23.9,
        "un": "kg"
      },
      {
        "name": "Palito de Queijo (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Pao de Queijo Sabores (kg)",
        "price": 79.9,
        "un": "kg"
      },
      {
        "name": "Rosca (kg)",
        "price": 25.0,
        "un": "kg"
      },
      {
        "name": "Pao Amanteigado (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Cocadinha (kg)",
        "price": 35.0,
        "un": "kg"
      },
      {
        "name": "Croiassant (kg)",
        "price": 59.99,
        "un": "kg"
      },
      {
        "name": "Rosca Brioche (kg)",
        "price": 45.0,
        "un": "kg"
      },
      {
        "name": "Pao de Queijo da Canastra (kg)",
        "price": 55.0,
        "un": "kg"
      },
      {
        "name": "Doces Diversos (kg)",
        "price": 55.0,
        "un": "kg"
      },
      {
        "name": "Australiano (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Pao Italiano (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Pao Portugues (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Baguete Recheada ( Sabores )",
        "price": 15.0,
        "un": "un"
      },
      {
        "name": "Mini Chocotone",
        "price": 4.5,
        "un": "un"
      },
      {
        "name": "Pao de Milho",
        "price": 11.5,
        "un": "un"
      },
      {
        "name": "Pao de Quinua",
        "price": 11.5,
        "un": "un"
      },
      {
        "name": "Pao 12 Graos",
        "price": 11.5,
        "un": "un"
      },
      {
        "name": "Bengala",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Bolo Gelado",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Rosca Brioche Nutella (kg)",
        "price": 55.0,
        "un": "kg"
      },
      {
        "name": "Brusqueta",
        "price": 18.0,
        "un": "un"
      },
      {
        "name": "Chocotone",
        "price": 15.5,
        "un": "un"
      },
      {
        "name": "Mini Panetone",
        "price": 4.5,
        "un": "un"
      },
      {
        "name": "Panetone",
        "price": 12.5,
        "un": "un"
      },
      {
        "name": "Pao Brioche un com Gergilim",
        "price": 2.8,
        "un": "un"
      },
      {
        "name": "Pao Brioche un",
        "price": 2.5,
        "un": "un"
      },
      {
        "name": "Pao de Cachorro Quente",
        "price": 1.4,
        "un": "un"
      },
      {
        "name": "Pao de Forma",
        "price": 8.5,
        "un": "un"
      },
      {
        "name": "Pao de Forma Integral",
        "price": 8.5,
        "un": "un"
      },
      {
        "name": "Pao de Leite Condensado",
        "price": 1.0,
        "un": "un"
      },
      {
        "name": "Pao Hamburguer",
        "price": 1.6,
        "un": "un"
      },
      {
        "name": "Pao Sirio",
        "price": 3.0,
        "un": "un"
      },
      {
        "name": "Baguetinha",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Chocolate Quente Garrafa 1,8 Lt",
        "price": 50.0,
        "un": "un"
      },
      {
        "name": "Pao de Bauru",
        "price": 1.5,
        "un": "un"
      },
      {
        "name": "Pao de Queijo Sabor de Minas 1 kg",
        "price": 29.99,
        "un": "un"
      },
      {
        "name": "Torta Salgada Frango F Bolo Gelado (grande)",
        "price": 140.0,
        "un": "un"
      },
      {
        "name": "Panetone Salgado",
        "price": 25.0,
        "un": "un"
      },
      {
        "name": "Torta Salgada Pao de Forma F Rocambole",
        "price": 80.0,
        "un": "un"
      },
      {
        "name": "Torta Salgada Pao de Forma",
        "price": 10.0,
        "un": "un"
      },
      {
        "name": "Pao de Queijo Parmesao (kg)",
        "price": 60.0,
        "un": "kg"
      },
      {
        "name": "Colomba Pascoal",
        "price": 15.0,
        "un": "un"
      },
      {
        "name": "Suspiro (kg)",
        "price": 39.99,
        "un": "kg"
      },
      {
        "name": "Biscoito sem Lactose (kg)",
        "price": 40.0,
        "un": "kg"
      },
      {
        "name": "Biscoito Doce (kg)",
        "price": 46.99,
        "un": "kg"
      },
      {
        "name": "Biscoito Cebola e Salsa (kg)",
        "price": 47.99,
        "un": "kg"
      },
      {
        "name": "Pao de Cachorro Quente Prensadão",
        "price": 2.0,
        "un": "un"
      },
      {
        "name": "Mini Brusqueta",
        "price": 5.0,
        "un": "un"
      },
      {
        "name": "Palito Temperado (kg)",
        "price": 35.0,
        "un": "kg"
      },
      {
        "name": "Bolo Matilda Cake",
        "price": 40.0,
        "un": "un"
      },
      {
        "name": "Bolo Pudim - Fatia",
        "price": 29.0,
        "un": "un"
      }
    ]
  },
  {
    "name": "Queijos e Derivados",
    "products": [
      {
        "name": "Queijo Fazenda Frescal (kg)",
        "price": 71.9,
        "un": "kg"
      },
      {
        "name": "Queijo Prato (kg)",
        "price": 62.9,
        "un": "kg"
      },
      {
        "name": "Requeijao Tradicional Fazenda 200g",
        "price": 13.5,
        "un": "un"
      },
      {
        "name": "Requeijao Fazenda Light 200g",
        "price": 14.25,
        "un": "un"
      },
      {
        "name": "Requeijao Crioulo Light 220g",
        "price": 19.95,
        "un": "un"
      },
      {
        "name": "Queijo Canastra (kg)",
        "price": 58.0,
        "un": "kg"
      }
    ]
  },
  {
    "name": "Refresco",
    "products": [
      {
        "name": "Del Valle Lata Uva 290ml",
        "price": 6.9,
        "un": "un"
      },
      {
        "name": "Del Valle Caixinha Maracuja 1L",
        "price": 11.5,
        "un": "un"
      },
      {
        "name": "Del Valle Caixinha Manga 1L",
        "price": 11.5,
        "un": "un"
      }
    ]
  },
  {
    "name": "Refrigerantes",
    "products": [
      {
        "name": "Ref Guaraná Pequetito 2 L",
        "price": 10.99,
        "un": "un"
      },
      {
        "name": "Ref Guaraná Pequetito 250 ml",
        "price": 3.5,
        "un": "un"
      },
      {
        "name": "Ref Pequetito Maca 600ml",
        "price": 6.25,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola 600ml",
        "price": 8.9,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola Zero 200ml",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Guaraná Antarctica Zero 600ml",
        "price": 6.8,
        "un": "un"
      },
      {
        "name": "Refrigerante Pepsi 2L",
        "price": 13.6,
        "un": "un"
      },
      {
        "name": "Refrigerante Pepsi Twist 2L",
        "price": 12.5,
        "un": "un"
      },
      {
        "name": "Refrigerante Sprite 2L",
        "price": 12.25,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola Zero 600ml",
        "price": 8.9,
        "un": "un"
      },
      {
        "name": "Ref Guaraná Pequetito 600 ml",
        "price": 6.25,
        "un": "un"
      },
      {
        "name": "Refri Pequetito Maca 2L",
        "price": 10.99,
        "un": "un"
      },
      {
        "name": "Refrigerante Pepsi 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola Zero 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Antarctica Zero 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Pepsi Zero 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Sprite 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Schweppes Citrus Lata 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Fanta Guaraná 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Fanta Uva 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Antarctica 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Fanta Laranja 350ml",
        "price": 6.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Pepsi Zero 2L",
        "price": 13.6,
        "un": "un"
      },
      {
        "name": "Refrigerante Sprite Zero 2L",
        "price": 12.25,
        "un": "un"
      },
      {
        "name": "Refrigerante Coca-Cola PET 200ml",
        "price": 4.0,
        "un": "un"
      },
      {
        "name": "Refrigerante Fanta Laranja 2L",
        "price": 12.25,
        "un": "un"
      },
      {
        "name": "Refrigerante Fanta 200ml",
        "price": 3.5,
        "un": "un"
      }
    ]
  },
  {
    "name": "Utensílios Domésticos",
    "products": [
      {
        "name": "Isqueiro Bic Grande",
        "price": 8.5,
        "un": "un"
      },
      {
        "name": "Isqueiro Bic Pequeno",
        "price": 6.35,
        "un": "un"
      },
      {
        "name": "Filtro Evolutto Reutilizavel 30n",
        "price": 8.25,
        "un": "un"
      },
      {
        "name": "Filtro Evolutto Permanente 1un",
        "price": 6.6,
        "un": "un"
      }
    ]
  }
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter }) as unknown as InstanceType<typeof PrismaClient>;

  // Resolve target tenant: padaria-do-ze or first active
  let tenant = await prisma.tenant.findUnique({ where: { slug: "padaria-do-ze" } });
  if (!tenant) {
    tenant = await prisma.tenant.findFirst({ where: { active: true } });
  }

  if (!tenant) {
    console.error("❌ Nenhum tenant ativo encontrado.");
    process.exit(1);
  }

  console.log(`🚀 Iniciando importação UPSERT para Tenant: ${tenant.name} (${tenant.slug}) [${tenant.id}]`);

  // 1. Process Categories (UPSERT)
  const categoryIdByName = new Map<string, string>();
  let categoriesCreated = 0;
  let categoriesExisting = 0;

  for (let i = 0; i < CATEGORIES.length; i++) {
    const catData = CATEGORIES[i];
    const existingCat = await prisma.category.findFirst({
      where: { tenantId: tenant.id, name: catData.name },
    });

    if (existingCat) {
      categoryIdByName.set(existingCat.name, existingCat.id);
      categoriesExisting++;
    } else {
      const created = await prisma.category.create({
        data: {
          tenantId: tenant.id,
          name: catData.name,
          sortOrder: i + 1,
          isActive: true,
        },
      });
      categoryIdByName.set(created.name, created.id);
      categoriesCreated++;
    }
  }

  console.log(`📁 Categorias: ${categoriesCreated} criadas, ${categoriesExisting} já existentes.`);

  // 2. Process Products (UPSERT)
  let productsCreated = 0;
  let productsUpdated = 0;

  for (const catData of CATEGORIES) {
    const categoryId = categoryIdByName.get(catData.name)!;

    for (let i = 0; i < catData.products.length; i++) {
      const p = catData.products[i];
      const existingProduct = await prisma.product.findFirst({
        where: { tenantId: tenant.id, name: p.name },
      });

      if (existingProduct) {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            price: p.price,
            categoryId,
            isAvailable: true,
          },
        });
        productsUpdated++;
      } else {
        await prisma.product.create({
          data: {
            tenantId: tenant.id,
            categoryId,
            name: p.name,
            price: p.price,
            isAvailable: true,
            sortOrder: i + 1,
          },
        });
        productsCreated++;
      }
    }
  }

  console.log(`📦 Produtos: ${productsCreated} inseridos, ${productsUpdated} atualizados.`);

  // 3. Clear Redis products cache
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redisPrefix = (process.env.REDIS_PREFIX || "ag_delivery").replace(/:+$/, "");
  const redis = new Redis(redisUrl);
  try {
    const deleted = await redis.del(`${redisPrefix}:cache:products:${tenant.id}`);
    console.log(`🗑️  Cache Redis de produtos limpo (${deleted} chave(s) removida(s)).`);
  } catch (err) {
    console.warn("⚠️  Aviso: Não foi possível limpar o cache Redis:", err);
  } finally {
    redis.quit();
  }

  await pool.end();
  console.log("✨ Importação UPSERT concluída com sucesso!");
}

main().catch((e) => {
  console.error("❌ Falha na importação:", e);
  process.exit(1);
});
