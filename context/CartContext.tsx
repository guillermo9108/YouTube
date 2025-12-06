import React, { createContext, useContext, useState, useEffect } from 'react';
import { CartItem } from '../types';

interface CartContextType {
    cart: CartItem[];
    addToCart: (item: CartItem) => void;
    removeFromCart: (cartId: string) => void;
    clearCart: () => void;
    total: number;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) throw new Error("useCart must be used within CartProvider");
    return context;
};

export const CartProvider = ({ children }: { children?: React.ReactNode }) => {
    const [cart, setCart] = useState<CartItem[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('sp_cart');
        if (saved) {
            try { setCart(JSON.parse(saved)); } catch (e) {}
        }
        
        // Listen for logout event to clear cart for privacy
        const handleLogout = () => {
            setCart([]);
            localStorage.removeItem('sp_cart');
        };
        window.addEventListener('sp_logout', handleLogout);
        return () => window.removeEventListener('sp_logout', handleLogout);
    }, []);

    const saveCart = (newCart: CartItem[]) => {
        setCart(newCart);
        localStorage.setItem('sp_cart', JSON.stringify(newCart));
    };

    const addToCart = (item: CartItem) => {
        const newItem = { ...item, cartId: `c_${Date.now()}_${Math.random()}` };
        saveCart([...cart, newItem]);
    };

    const removeFromCart = (cartId: string) => {
        saveCart(cart.filter(i => i.cartId !== cartId));
    };

    const clearCart = () => saveCart([]);

    const total = cart.reduce((acc, curr) => acc + Number(curr.price), 0);

    return (
        <CartContext.Provider value={{ cart, addToCart, removeFromCart, clearCart, total }}>
            {children}
        </CartContext.Provider>
    );
};