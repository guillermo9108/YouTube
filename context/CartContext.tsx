
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MarketplaceItem, CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (item: MarketplaceItem) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, delta: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartOriginalTotal: number;
  totalSaved: number;
  totalSavedPercent: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
};

export const CartProvider = ({ children }: { children?: React.ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
      try {
          const saved = localStorage.getItem('sp_cart');
          return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  useEffect(() => {
      localStorage.setItem('sp_cart', JSON.stringify(items));
  }, [items]);

  const addToCart = (product: MarketplaceItem) => {
      setItems(prev => {
          const existing = prev.find(i => i.id === product.id);
          if (existing) {
              // Check stock limit
              if (existing.cartQuantity >= product.stock) {
                  alert("Stock máximo alcanzado para este artículo");
                  return prev;
              }
              return prev.map(i => i.id === product.id ? { ...i, cartQuantity: i.cartQuantity + 1 } : i);
          }
          return [...prev, { ...product, cartQuantity: 1 }];
      });
  };

  const removeFromCart = (itemId: string) => {
      setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
      setItems(prev => {
          return prev.map(i => {
              if (i.id === itemId) {
                  const newQty = i.cartQuantity + delta;
                  if (newQty < 1) return i;
                  if (newQty > i.stock) {
                      alert("Stock máximo alcanzado");
                      return i;
                  }
                  return { ...i, cartQuantity: newQty };
              }
              return i;
          });
      });
  };

  const clearCart = () => setItems([]);

  // Calculations
  const cartTotal = items.reduce((acc, item) => {
      // Apply discount
      const finalPrice = item.price * (1 - (item.discountPercent / 100));
      return acc + (finalPrice * item.cartQuantity);
  }, 0);

  const cartOriginalTotal = items.reduce((acc, item) => {
      // Original list price
      return acc + (item.price * item.cartQuantity);
  }, 0);

  const totalSaved = cartOriginalTotal - cartTotal;
  const totalSavedPercent = cartOriginalTotal > 0 ? (totalSaved / cartOriginalTotal) * 100 : 0;

  const cartCount = items.reduce((acc, item) => acc + item.cartQuantity, 0);

  return (
    <CartContext.Provider value={{ 
        items, 
        addToCart, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        cartTotal, 
        cartOriginalTotal,
        totalSaved,
        totalSavedPercent,
        cartCount 
    }}>
      {children}
    </CartContext.Provider>
  );
};
