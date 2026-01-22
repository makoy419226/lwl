import abaya from '@/assets/products/abaya.png';
import babycloth from '@/assets/products/baby-cloth.png';
import babydress from '@/assets/products/baby-dress.png';
import babypant from '@/assets/products/baby-pant.png';
import babytshirt from '@/assets/products/baby-tshirt.png';
import bedsheet from '@/assets/products/bed-sheet.png';
import blanket from '@/assets/products/blanket.png';
import bra from '@/assets/products/bra.png';
import cap from '@/assets/products/cap.png';
import carpet from '@/assets/products/carpet.png';
import comforter from '@/assets/products/comforter.png';
import coverall from '@/assets/products/coverall.png';
import curtain from '@/assets/products/curtain.png';
import duvetcover from '@/assets/products/duvet-cover.png';
import ghutra from '@/assets/products/ghutra.png';
import jacket from '@/assets/products/jacket.png';
import jeans from '@/assets/products/jeans.png';
import kandoora from '@/assets/products/kandoora.png';
import ladiessuit from '@/assets/products/ladies-suit.png';
import militarydress from '@/assets/products/military-dress.png';
import partydress from '@/assets/products/party-dress.png';
import pillow from '@/assets/products/pillow.png';
import pillowcover from '@/assets/products/pillow-cover.png';
import salawarqamees from '@/assets/products/salawar-qamees.png';
import saree from '@/assets/products/saree.png';
import shela from '@/assets/products/shela.png';
import shirt from '@/assets/products/shirt.png';
import shoes from '@/assets/products/shoes.png';
import shorts from '@/assets/products/shorts.png';
import skirt from '@/assets/products/skirt.png';
import socks from '@/assets/products/socks.png';
import suit from '@/assets/products/suit.png';
import sweater from '@/assets/products/sweater.png';
import tablecloth from '@/assets/products/table-cloth.png';
import towel from '@/assets/products/towel.png';
import trackpant from '@/assets/products/track-pant.png';
import tshirt from '@/assets/products/tshirt.png';
import underwear from '@/assets/products/underwear.png';
import vest from '@/assets/products/vest.png';
import wezarlungi from '@/assets/products/wezar-lungi.png';

const productImageMap: Record<string, string> = {
  'Abaya': abaya,
  'Baby Cloth': babycloth,
  'Baby Dress': babydress,
  'Baby Pant': babypant,
  'Baby T-Shirt': babytshirt,
  'Bed Sheet': bedsheet,
  'Blanket': blanket,
  'Ladies Bras': bra,
  'Cap': cap,
  'Carpet (per SQ MTR)': carpet,
  'Comfort (Large)': comforter,
  'Comfort (Small)': comforter,
  'Coveral': coverall,
  'Curtain/Window Screen': curtain,
  'Duvet Cover': duvetcover,
  'Ghutra': ghutra,
  'Jacket': jacket,
  'Jeans Pant/Trouser': jeans,
  'Kandoora/Thob': kandoora,
  'Ladies Suit': ladiessuit,
  'Ladies Pusthan': ladiessuit,
  'Military Dress': militarydress,
  'Party Dress (Female)': partydress,
  'Party Dress (Male)': suit,
  'Pillow': pillow,
  'Pillow Cover': pillowcover,
  'Salawar Qamees': salawarqamees,
  'Saree': saree,
  'Shela': shela,
  'Shirt/Blouse': shirt,
  'Shoes': shoes,
  'Short': shorts,
  'Skirt': skirt,
  'Socks': socks,
  'Suit/Coat (Dry Clean)': suit,
  'Suit/Coat (Normal)': suit,
  'Sweater': sweater,
  'Table Cloth (Large)': tablecloth,
  'Table Cloth (Small)': tablecloth,
  'Towel': towel,
  'Track Pant (Dry Clean)': trackpant,
  'Track Pant (Normal)': trackpant,
  'T-Shirt (Dry Clean)': tshirt,
  'T-Shirt (Normal)': tshirt,
  'Underwear': underwear,
  'Fanela/Vest': vest,
  'Wezar/Lungi': wezarlungi,
};

export function getProductImage(productName: string): string | null {
  const normalizedName = productName.split(' (')[0].trim();
  
  if (productImageMap[productName]) {
    return productImageMap[productName];
  }
  
  if (productImageMap[normalizedName]) {
    return productImageMap[normalizedName];
  }
  
  for (const key of Object.keys(productImageMap)) {
    if (productName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(productName.toLowerCase())) {
      return productImageMap[key];
    }
  }
  
  return null;
}

export default productImageMap;
