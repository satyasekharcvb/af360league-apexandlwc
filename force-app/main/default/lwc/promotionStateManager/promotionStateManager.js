import { LightningElement, track } from 'lwc';

export default class PromotionStateManager extends LightningElement {
    @track promotionName = '';
    @track chosenProducts = [];
    @track chosenStores = [];
    
    // Add or update a product with discount
    setProduct(product) {
        let chosenProductsTemp = [...this.chosenProducts];
        const existingIndex = chosenProductsTemp.findIndex(p => p.productId === product.productId);
        if (existingIndex >= 0) {
            chosenProductsTemp[existingIndex] = { ...chosenProductsTemp[existingIndex], ...product };
        } else {
            chosenProductsTemp.push(product);
        }
        this.chosenProducts = chosenProductsTemp;
    };

    // Remove a product by ID
    removeProduct(productId) {
        let chosenProductsTemp = this.chosenProducts.filter(p => p.productId !== productId);
        this.chosenProducts = chosenProductsTemp;
    };

    // Bulk update products (replaces entire selection)
    updateProducts(products) {
        this.chosenProducts = [...products];
    };

    // Check if a product is selected
    isProductSelected(productId) {
        return this.chosenProducts.some(p => p.productId === productId);
    };

    // Get discount for a product
    getProductDiscount(productId) {
        const product = this.chosenProducts.find(p => p.productId === productId);
        return product ? product.discountPercent : 0;
    };

    get productCount() {
        return this.chosenProducts.length;
    }

    updateStores(stores) {
        this.chosenStores = [...stores];
    };

    updatePromotionName(name) {
        this.promotionName = name;
    };
}