import { LightningElement, api, track, wire } from 'lwc';

import getProducts from '@salesforce/apex/PromotionCreatorCtrl.getProducts';

export default class PromotionWizardStep2 extends LightningElement {

    @api chosenProducts = []; // Passed from parent

    @track products = [];
    @track selectedProductsMap = new Map();
    
    pageNumber = 1;
    pageSize = 5;
    totalItemCount = 0;
    locator = null;
    isLoading = true;
    error = null;

    connectedCallback() {
        // Restore previously selected products from parent
        this.restoreSelectionsFromParent();
        this.loadProducts();
    }

    restoreSelectionsFromParent() {
        this.chosenProducts.forEach(product => {
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
                    isDisabled: !isSelected,
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
            this.selectedProductsMap.set(productId, {
                productId: productId,
                productName: product.name,
                category: product.category,
                discountPercent: product.discountPercent || 0
            });
        } else {
            this.selectedProductsMap.delete(productId);
        }

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
        discountValue = Math.max(0, Math.min(100, discountValue));

        this.products = this.products.map(p => {
            if (p.id === productId) {
                return { ...p, discountPercent: discountValue };
            }
            return p;
        });

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
            this.locator = null;
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
        if (this.selectedProductsMap.size === 0) {
            this.error = 'Please select at least one product.';
            return false;
        }

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

        // Dispatch event to update state in parent
        const productsArray = Array.from(this.selectedProductsMap.values());
        this.dispatchEvent(new CustomEvent('stateupdate', {
            detail: { key: 'chosenProducts', value: productsArray },
            bubbles: true,
            composed: true
        }));
        
        this.error = null;
        return true;
    }
}