import { defineState, atom, setAtom, computed } from 'c/sfState';

const promotionStateManager = defineState(
  ({
    atom,
    computed,
    setAtom
  }) => {

    // TODO FOR THE CHALLENGE: Create a state property of type string to store promotion name
    const promotionName = atom('');
    

    // TODO FOR THE CHALLENGE: Create a state property of type array to store products
    const chosenProducts = atom([]);

    const chosenStores = atom([]);

    // Add or update a product with discount
    const setProduct = (product) => {
        let chosenProductsTemp = [...chosenProducts.value];
        const existingIndex = chosenProductsTemp.findIndex(p => p.productId === product.productId);
        if (existingIndex >= 0) {
            chosenProductsTemp[existingIndex] = { ...chosenProductsTemp[existingIndex], ...product };
        } else {
            chosenProductsTemp.push(product);
        }
        
        // TODO FOR THE CHALLENGE: set the value of chosenProducts with the chosenProductsTemp
        setAtom(chosenProducts, chosenProductsTemp);
        
    };

    // Remove a product by ID
    const removeProduct = (productId) => {
        let chosenProductsTemp = chosenProducts.value.filter(p => p.productId !== productId);
        setAtom(chosenProducts, chosenProductsTemp);
    };

    // Bulk update products (replaces entire selection)
    const updateProducts = (products) => {
        setAtom(chosenProducts, [...products]);
    };

    // Check if a product is selected
    const isProductSelected = (productId) => {
        return chosenProducts.value.some(p => p.productId === productId);
    };

    // Get discount for a product
    const getProductDiscount = (productId) => {
        const product = chosenProducts.value.find(p => p.productId === productId);
        return product ? product.discountPercent : 0;
    };

    // TODO FOR THE CHALLENGE: Implement the computation logic for the productCount
    const productCount = computed(() => chosenProducts.value.length);

    const updateStores = (stores) => {
        setAtom(chosenStores, [...stores]);
    };

    const updatePromotionName = (name) => {
        // TODO FOR THE CHALLENGE: Implement a state change function for updating the product name
    };

    // Return an object that defines the public API of promotionStateManager
    return {
      promotionName,
      chosenProducts,
      setProduct,
      removeProduct,
      updateProducts,
      isProductSelected,
      getProductDiscount,
      productCount,
      chosenStores,
      updateStores,
      updatePromotionName
    };
  },
);

export default promotionStateManager;
