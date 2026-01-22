import abaya from '@/assets/products/abaya.jpg';
import babycloth from '@/assets/products/baby-cloth.jpg';
import babydress from '@/assets/products/baby-dress.jpg';
import babypant from '@/assets/products/baby-pant.jpg';
import babytshirt from '@/assets/products/baby-tshirt.jpg';
import bedsheet from '@/assets/products/bed-sheet.jpg';
import blanket from '@/assets/products/blanket.jpg';
import bra from '@/assets/products/bra.jpg';
import cap from '@/assets/products/cap.jpg';
import carpet from '@/assets/products/carpet.jpg';
import comforter from '@/assets/products/comforter.jpg';
import coverall from '@/assets/products/coverall.jpg';
import curtain from '@/assets/products/curtain.jpg';
import duvetcover from '@/assets/products/duvet-cover.jpg';
import ghutra from '@/assets/products/ghutra.jpg';
import jacket from '@/assets/products/jacket.jpg';
import jeans from '@/assets/products/jeans.jpg';
import kandoora from '@/assets/products/kandoora.jpg';
import ladiessuit from '@/assets/products/ladies-suit.jpg';
import militarydress from '@/assets/products/military-dress.jpg';
import partydress from '@/assets/products/party-dress.jpg';
import pillow from '@/assets/products/pillow.jpg';
import pillowcover from '@/assets/products/pillow-cover.jpg';
import salawarqamees from '@/assets/products/salawar-qamees.jpg';
import saree from '@/assets/products/saree.jpg';
import shela from '@/assets/products/shela.jpg';
import shirt from '@/assets/products/shirt.jpg';
import shoes from '@/assets/products/shoes.jpg';
import shorts from '@/assets/products/shorts.jpg';
import skirt from '@/assets/products/skirt.jpg';
import socks from '@/assets/products/socks.jpg';
import suit from '@/assets/products/suit.jpg';
import sweater from '@/assets/products/sweater.jpg';
import tablecloth from '@/assets/products/table-cloth.jpg';
import towel from '@/assets/products/towel.jpg';
import trackpant from '@/assets/products/track-pant.jpg';
import tshirt from '@/assets/products/tshirt.jpg';
import underwear from '@/assets/products/underwear.jpg';
import vest from '@/assets/products/vest.jpg';
import wezarlungi from '@/assets/products/wezar-lungi.jpg';

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
