import { LightningElement, api, track } from 'lwc';
import promotionStateManager from 'c/promotionStateManager';

import getProducts from '@salesforce/apex/PromotionCreatorCtrl.getProducts';

export default class PromotionWizardStep2 extends LightningElement {
    promotionState = promotionStateManager;

    @track products = [];
    @track selectedProductsMap = new Map();
    
    pageNumber = 1;
    pageSize = 5;
    totalItemCount = 0;
    locator = null;
    isLoading = true;
    error = null;

    connectedCallback() {
        // Restore previously selected products from state
        this.restoreSelectionsFromState();
        this.loadProducts();
    }

    restoreSelectionsFromState() {
        const stateProducts = this.promotionState?.value?.chosenProducts || [];
        stateProducts.forEach(product => {
            this.selectedProductsMap.set(product.productId, {
                productId: product.productId,
                productName: product.productName,
                category: product.category,
                discountPercent: product.discountPercent || 0
            });
        });
    }

    async loadProducts() {
        this.isLoading = true;
        this.error = null;
        
        try {
            const result = await getProducts({
                type: null,
                pageNumber: this.pageNumber,
                locatorParam: this.locator
            });

            this.pageSize = result.pageSize;
            this.totalItemCount = result.totalItemCount;
            this.locator = result.locator;

            // Map products with selection status and discount from our map
            this.products = result.records.map(record => {
                const savedProduct = this.selectedProductsMap.get(record.Id);
                const isSelected = this.selectedProductsMap.has(record.Id);
                return {
                    id: record.Id,
                    name: record.Name,
                    category: 'N/A', // No category field available in Product2
                    isSelected: isSelected,
                    isDisabled: !isSelected, // For disabled attribute in template
                    discountPercent: savedProduct ? savedProduct.discountPercent : 0
                };
            });
        } catch (err) {
            this.error = err.body?.message || err.message || 'Failed to load products';
            console.error('Error loading products:', err);
        } finally {
            this.isLoading = false;
        }
    }

    handleCheckboxChange(event) {
        const productId = event.target.dataset.id;
        const isChecked = event.target.checked;
        const product = this.products.find(p => p.id === productId);

        if (isChecked) {
            // Add to selection map
            this.selectedProductsMap.set(productId, {
                productId: productId,
                productName: product.name,
                category: product.category,
                discountPercent: product.discountPercent || 0
            });
        } else {
            // Remove from selection map
            this.selectedProductsMap.delete(productId);
        }

        // Update the products array to reflect selection change
        this.products = this.products.map(p => {
            if (p.id === productId) {
                return { ...p, isSelected: isChecked, isDisabled: !isChecked };
            }
            return p;
        });
    }

    handleDiscountChange(event) {
        const productId = event.target.dataset.id;
        let discountValue = parseFloat(event.target.value) || 0;
        
        // Clamp between 0 and 100
        discountValue = Math.max(0, Math.min(100, discountValue));

        // Update in products array
        this.products = this.products.map(p => {
            if (p.id === productId) {
                return { ...p, discountPercent: discountValue };
            }
            return p;
        });

        // Update in selection map if selected
        if (this.selectedProductsMap.has(productId)) {
            const existing = this.selectedProductsMap.get(productId);
            this.selectedProductsMap.set(productId, {
                ...existing,
                discountPercent: discountValue
            });
        }
    }

    handlePreviousPage() {
        if (this.pageNumber > 1) {
            this.pageNumber--;
            this.loadProducts();
        }
    }

    handleNextPage() {
        if (this.pageNumber < this.totalPages) {
            this.pageNumber++;
            this.loadProducts();
        }
    }

    handleFirstPage() {
        if (this.pageNumber !== 1) {
            this.pageNumber = 1;
            this.locator = null; // Reset locator for first page
            this.loadProducts();
        }
    }

    handleLastPage() {
        if (this.pageNumber !== this.totalPages) {
            this.pageNumber = this.totalPages;
            this.loadProducts();
        }
    }

    get totalPages() {
        return this.totalItemCount > 0 ? Math.ceil(this.totalItemCount / this.pageSize) : 1;
    }

    get hasPreviousPage() {
        return this.pageNumber > 1;
    }

    get hasNextPage() {
        return this.pageNumber < this.totalPages;
    }

    get pageInfo() {
        const startItem = (this.pageNumber - 1) * this.pageSize + 1;
        const endItem = Math.min(this.pageNumber * this.pageSize, this.totalItemCount);
        return `${startItem}-${endItem} of ${this.totalItemCount}`;
    }

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    get noProducts() {
        return !this.hasProducts;
    }

    get notLoading() {
        return !this.isLoading;
    }

    get noPreviousPage() {
        return !this.hasPreviousPage;
    }

    get noNextPage() {
        return !this.hasNextPage;
    }

    get selectedCount() {
        return this.selectedProductsMap.size;
    }

    get hasSelectedProducts() {
        return this.selectedCount > 0;
    }

    get selectedProductsList() {
        return Array.from(this.selectedProductsMap.values());
    }

    @api
    allValid() {
        // Debug logging
        console.log('Step 2 validation called');
        console.log('Selected products count:', this.selectedProductsMap.size);
        console.log('promotionState:', this.promotionState);
        console.log('promotionState.value:', this.promotionState?.value);
        console.log('updateProducts function:', this.promotionState?.value?.updateProducts);
        
        // Check if at least one product is selected
        if (this.selectedProductsMap.size === 0) {
            this.error = 'Please select at least one product.';
            console.log('Validation failed: no products selected');
            return false;
        }

        // Check if all selected products have a discount value
        let allHaveDiscount = true;
        this.selectedProductsMap.forEach((product) => {
            console.log('Checking product:', product.productId, 'discount:', product.discountPercent);
            if (!product.discountPercent || product.discountPercent <= 0) {
                allHaveDiscount = false;
            }
        });

        if (!allHaveDiscount) {
            this.error = 'Please enter a discount percentage (greater than 0) for all selected products.';
            console.log('Validation failed: invalid discount');
            return false;
        }

        // Save selections to state
        const productsArray = Array.from(this.selectedProductsMap.values());
        console.log('About to update state with products:', productsArray);
        
        if (this.promotionState && this.promotionState.value && typeof this.promotionState.value.updateProducts === 'function') {
            this.promotionState.value.updateProducts(productsArray);
            console.log('State updated successfully');
        } else {
            console.error('State manager not properly initialized or updateProducts not available');
            console.log('promotionState:', this.promotionState);
            console.log('promotionState.value:', this.promotionState?.value);
        }
        
        this.error = null;
        console.log('Validation passed');
        return true;
    }
}
