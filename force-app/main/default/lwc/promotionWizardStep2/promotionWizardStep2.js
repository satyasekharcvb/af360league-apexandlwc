import { LightningElement, api, track } from 'lwc';
import promotionStateManager from 'c/promotionStateManager';
import { atom, setAtom, computed, defineState } from 'c/sfState';

/** TODO FOR THE CHALLENGE: import the state manager, and the context modules */

import getProducts from '@salesforce/apex/PromotionCreatorCtrl.getProducts';

export default class PromotionWizardStep2 extends LightningElement {

    /** TODO FOR THE CHALLENGE: initialize/inherit the state from the parent */

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
                    category: record.cgcloud__Category__c || 'N/A',
                    isSelected: isSelected,
                    isDisabled: !isSelected, // For disabled attribute in template
                    discountPercent: savedProduct ? savedProduct.discountPercent : 0
                };
            });
        } catch (err) {
            this.error = err.body?.message || 'Failed to load products';
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
        return Math.ceil(this.totalItemCount / this.pageSize);
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
        // Check if at least one product is selected
        if (this.selectedProductsMap.size === 0) {
            this.error = 'Please select at least one product.';
            return false;
        }

        // Check if all selected products have a discount value
        let allHaveDiscount = true;
        this.selectedProductsMap.forEach((product) => {
            if (!product.discountPercent || product.discountPercent <= 0) {
                allHaveDiscount = false;
            }
        });

        if (!allHaveDiscount) {
            this.error = 'Please enter a discount percentage (greater than 0) for all selected products.';
            return false;
        }

        // Save selections to state
        const productsArray = Array.from(this.selectedProductsMap.values());
        this.promotionState.value.updateProducts(productsArray);
        
        this.error = null;
        return true;
    }
}
